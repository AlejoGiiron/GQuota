-- ============================================================
--  021 — RPC registrar_pago_cuota_fija
--  Registra un pago contra un préstamo tipo 'cuota_fija', de forma atómica.
--  SECURITY INVOKER (la RLS aplica).
--
--  REPLICA EXACTAMENTE aplicarPagoFijo de src/lib/motor-prestamos.ts (esa es
--  la referencia; si cambia allá, cambiar aquí): llena las cuotas
--  pendientes/parciales EN ORDEN, abonando a cada una min(restante, valor −
--  abonado) y actualizando su estado (pendiente/parcial/pagada). El valor de
--  la cuota vive en `capital`; lo pagado en `abonado`. NO separa
--  capital/interés, NO hay solo-interés, NO hay mora.
--
--  Registra el movimiento del pago (tipo 'cuota', monto = lo aplicado; un
--  sobrante por encima del saldo no se registra). Si el saldo llega a 0, el
--  préstamo pasa a 'pagado'.
-- ============================================================

create or replace function public.registrar_pago_cuota_fija(
  p_prestamo_id uuid,
  p_monto       numeric,
  p_metodo_pago text
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
  v_c           public.cuotas;
  v_saldo_ant   numeric;
  v_saldo_pos   numeric;
  v_restante    numeric;
  v_abono       numeric;
  v_aplicado    numeric;
  v_falta       numeric;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if p_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  select * into v_prestamo from public.prestamos where id = p_prestamo_id; -- RLS: solo el suyo
  if not found then raise exception 'Préstamo no encontrado.'; end if;
  if v_prestamo.tipo <> 'cuota_fija' then raise exception 'El préstamo no es de cuota fija.'; end if;

  v_saldo_ant := coalesce(
    (select sum(capital - abonado) from public.cuotas where prestamo_id = p_prestamo_id), 0);
  if v_saldo_ant <= 0 then raise exception 'Este préstamo ya está saldado.'; end if;

  -- Llena las cuotas no pagadas en orden (igual que aplicarPagoFijo).
  v_restante := p_monto;
  for v_c in
    select * from public.cuotas
     where prestamo_id = p_prestamo_id and estado <> 'pagada'
     order by numero
  loop
    exit when v_restante <= 0;
    v_falta := v_c.capital - v_c.abonado;
    if v_falta <= 0 then continue; end if;
    v_abono := least(v_restante, v_falta);
    update public.cuotas
       set abonado = abonado + v_abono,
           estado = case
                      when (abonado + v_abono) >= capital then 'pagada'
                      when (abonado + v_abono) > 0 then 'parcial'
                      else 'pendiente'
                    end
     where id = v_c.id;
    v_restante := v_restante - v_abono;
  end loop;

  v_aplicado := p_monto - v_restante; -- lo realmente abonado (un sobrante no se registra)

  v_saldo_pos := coalesce(
    (select sum(capital - abonado) from public.cuotas where prestamo_id = p_prestamo_id), 0);

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
    v_user, p_prestamo_id, 'cuota', v_aplicado, 0, v_aplicado,
    v_saldo_ant, v_saldo_pos, p_metodo_pago
  )
  returning * into v_mov;

  return v_mov;
end;
$$;

grant execute on function public.registrar_pago_cuota_fija(uuid, numeric, text) to authenticated;
