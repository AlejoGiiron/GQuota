-- ============================================================
--  013 — RPC registrar_pago_cuotas
--  Registra un pago contra el cronograma de un préstamo tipo 'cuotas',
--  de forma atómica. SECURITY INVOKER (la RLS aplica).
--
--  REPLICA EXACTAMENTE el comportamiento de aplicarPagoACuotas y
--  pagarSoloInteres de src/lib/motor-prestamos.ts (esa es la referencia;
--  si cambia allá, cambiar aquí):
--   - Pago normal/abono de más: cubre la cuota vigente (interés y luego
--     capital); el excedente baja SOLO el capital de las cuotas siguientes
--     (interés intacto). El total no baja.
--   - Solo interés (p_solo_interes): la cuota vigente queda pagada de
--     interés y su capital se corre a una cuota NUEVA al final que REPITE
--     el mismo interés (penalización). El total sube.
--  Registra el movimiento del pago. Si todas las cuotas quedan pagadas,
--  el préstamo pasa a 'pagado'.
-- ============================================================

create or replace function public.registrar_pago_cuotas(
  p_prestamo_id uuid,
  p_abono       numeric,
  p_metodo_pago text,
  p_solo_interes boolean
)
returns public.movimientos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_prestamo    public.prestamos;
  v_mov         public.movimientos;
  v_vig         public.cuotas;
  v_c           public.cuotas;
  v_saldo_ant   numeric;
  v_saldo_pos   numeric;
  v_int         numeric := 0;
  v_cap         numeric := 0;
  v_restante    numeric;
  v_pi          numeric;
  v_pc          numeric;
  v_tipo        text;
  v_monto_total numeric;
  v_max_num     int;
  v_ultima_fecha date;
  v_step        int;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;

  select * into v_prestamo from public.prestamos where id = p_prestamo_id; -- RLS: solo el suyo
  if not found then raise exception 'Préstamo no encontrado.'; end if;
  if v_prestamo.tipo <> 'cuotas' then raise exception 'El préstamo no es de cuotas.'; end if;

  v_saldo_ant := coalesce(
    (select sum(capital) from public.cuotas where prestamo_id = p_prestamo_id and estado <> 'pagada'), 0);

  -- cuota vigente: menor número aún no pagada
  select * into v_vig from public.cuotas
   where prestamo_id = p_prestamo_id and estado <> 'pagada'
   order by numero limit 1;
  if not found then raise exception 'No hay cuotas pendientes.'; end if;

  if p_solo_interes then
    v_int := v_vig.interes;
    v_cap := 0;
    update public.cuotas set interes = 0, capital = 0, estado = 'pagada' where id = v_vig.id;

    select max(numero), max(fecha_vence) into v_max_num, v_ultima_fecha
      from public.cuotas where prestamo_id = p_prestamo_id;
    -- paso = gap con la cuota previa (o desde el desembolso si solo había una)
    v_step := v_ultima_fecha - coalesce(
      (select fecha_vence from public.cuotas
        where prestamo_id = p_prestamo_id and fecha_vence < v_ultima_fecha
        order by fecha_vence desc limit 1),
      v_prestamo.fecha_desembolso);
    if v_step is null or v_step <= 0 then v_step := 30; end if;

    insert into public.cuotas (user_id, prestamo_id, numero, fecha_vence, capital, interes, estado)
    values (v_user, p_prestamo_id, v_max_num + 1, v_ultima_fecha + v_step, v_vig.capital, v_vig.interes, 'pendiente');

    v_tipo := 'interes';
    v_monto_total := v_int;
  else
    v_restante := p_abono;
    -- vigente: interés y luego capital
    v_pi := least(v_restante, v_vig.interes);
    v_pc := least(v_restante - v_pi, v_vig.capital);
    v_restante := v_restante - v_pi - v_pc;
    update public.cuotas
       set interes = interes - v_pi,
           capital = capital - v_pc,
           estado = case when (interes - v_pi) = 0 and (capital - v_pc) = 0 then 'pagada' else estado end
     where id = v_vig.id;
    v_int := v_pi;
    v_cap := v_pc;

    -- excedente: baja SOLO el capital de las cuotas siguientes
    for v_c in
      select * from public.cuotas
       where prestamo_id = p_prestamo_id and numero > v_vig.numero and estado <> 'pagada'
       order by numero
    loop
      exit when v_restante <= 0;
      v_pc := least(v_restante, v_c.capital);
      update public.cuotas
         set capital = capital - v_pc,
             estado = case when (capital - v_pc) = 0 and interes = 0 then 'pagada' else estado end
       where id = v_c.id;
      v_restante := v_restante - v_pc;
      v_cap := v_cap + v_pc;
    end loop;

    v_tipo := case when v_cap > 0 then 'cuota' else 'interes' end;
    v_monto_total := p_abono;
  end if;

  v_saldo_pos := coalesce(
    (select sum(capital) from public.cuotas where prestamo_id = p_prestamo_id and estado <> 'pagada'), 0);

  update public.prestamos
     set saldo_capital = v_saldo_pos,
         estado = case
                    when not exists (select 1 from public.cuotas
                                      where prestamo_id = p_prestamo_id and estado <> 'pagada')
                    then 'pagado' else estado end
   where id = p_prestamo_id;

  insert into public.movimientos (
    user_id, prestamo_id, tipo, monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior, metodo_pago
  ) values (
    v_user, p_prestamo_id, v_tipo, v_monto_total, v_int, v_cap,
    v_saldo_ant, v_saldo_pos, p_metodo_pago
  )
  returning * into v_mov;

  return v_mov;
end;
$$;

grant execute on function public.registrar_pago_cuotas(uuid, numeric, text, boolean) to authenticated;
