-- ============================================================
--  024 — RPC explícitas por negocio (Fase 1B)
--
--  La 1A (022/023) dejó negocio_id NOT NULL con default mi_negocio(), así que
--  hoy las RPC ya guardan el negocio correcto... pero IMPLÍCITAMENTE, vía el
--  default. Esta migración lo hace EXPLÍCITO y seguro:
--    - Cada INSERT (préstamo, cuotas, movimiento) asigna negocio_id =
--      mi_negocio() a mano, sin depender del default.
--    - Si el usuario no pertenece a ningún negocio (mi_negocio() is null), la
--      RPC FALLA con un error claro y NO crea nada huérfano.
--
--  NO cambia ningún cálculo: préstamos y pagos se comportan igual que antes
--  (mismas fórmulas, mismo reparto, mismas referencias a motor-prestamos.ts).
--  Solo se añade la asignación/validación de negocio.
--
--  Todas son SECURITY INVOKER: corren como el usuario, así que mi_negocio()
--  (SECURITY DEFINER) resuelve a SU negocio y la RLS `with check
--  (negocio_id = mi_negocio())` valida la fila. La frontera entre negocios
--  está garantizada: un usuario solo puede crear filas en su propio negocio,
--  y al pagar solo "ve" (RLS en el SELECT) los préstamos de su negocio.
--
--  ─────────────────────────────────────────────────────────────
--  FUNCIONES DE MANTENIMIENTO (devengar_intereses, marcar_mora,
--  marcar_cuotas_vencidas): NO se tocan en esta migración. Son SECURITY
--  DEFINER, corren por cron con el rol postgres (NO hay auth.uid(), así que
--  mi_negocio() no aplica) y SOLO hacen UPDATE de filas existentes (nunca
--  INSERT), por lo que no necesitan negocio_id. Son GLOBALES A PROPÓSITO:
--  el mantenimiento del sistema (devengo mensual, moras) procesa los
--  préstamos de TODOS los negocios en una sola corrida. Correcto y deliberado.
--  ─────────────────────────────────────────────────────────────
-- ============================================================

-- ── crear_prestamo (producto "abierto") — réplica de 017 + negocio ──
create or replace function public.crear_prestamo(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_tasa_mensual      numeric,
  p_modo_interes      text,
  p_fecha_desembolso  date,
  p_codeudor_nombre   text default null,
  p_codeudor_telefono text default null,
  p_codeudor_documento text default null
)
returns public.prestamos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_negocio  uuid := public.mi_negocio();
  v_prestamo public.prestamos;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio; no se puede crear el préstamo.';
  end if;

  insert into public.prestamos (
    user_id, negocio_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, modo_interes, fecha_desembolso, estado,
    codeudor_nombre, codeudor_telefono, codeudor_documento
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, p_modo_interes, p_fecha_desembolso, 'activo',
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento
  )
  returning * into v_prestamo;

  insert into public.movimientos (
    user_id, negocio_id, prestamo_id, fecha, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior
  ) values (
    v_user, v_negocio, v_prestamo.id, p_fecha_desembolso, 'desembolso',
    p_capital, 0, 0,
    0, p_capital
  );

  return v_prestamo;
end;
$$;

grant execute on function public.crear_prestamo(uuid, numeric, numeric, text, date, text, text, text) to authenticated;


-- ── crear_prestamo_cuotas (producto "cuotas") — réplica de 018 + negocio ──
-- REPARTO capital/interés IDÉNTICO a generarCronograma() en
-- src/lib/motor-prestamos.ts (esa es la referencia). Si cambia allá, cambiar aquí.
create or replace function public.crear_prestamo_cuotas(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_tasa_mensual      numeric,
  p_frecuencia        text,
  p_n_cuotas          int,
  p_fecha_desembolso  date,
  p_codeudor_nombre   text default null,
  p_codeudor_telefono text default null,
  p_codeudor_documento text default null
)
returns public.prestamos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_negocio        uuid := public.mi_negocio();
  v_prestamo       public.prestamos;
  v_meses_por_cuota numeric;
  v_meses          numeric;
  v_interes_total  numeric;
  v_interes_cuota  numeric;
  v_capital_cuota  numeric;
  v_paso           interval;
  i                int;
  v_cap            numeric;
  v_int            numeric;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio; no se puede crear el préstamo.';
  end if;
  if p_n_cuotas < 1 then
    raise exception 'El número de cuotas debe ser al menos 1.';
  end if;

  -- meses por cuota: 30 días = 1 mes, 4 semanas = 1 mes, quincena = ½ mes,
  -- un día = 1/30 de mes (igual que el motor).
  v_meses_por_cuota := case p_frecuencia
                         when 'diaria'    then 1.0 / 30
                         when 'semanal'   then 0.25
                         when 'quincenal' then 0.5
                         when 'mensual'   then 1
                         else null
                       end;
  if v_meses_por_cuota is null then
    raise exception 'Frecuencia inválida: %', p_frecuencia;
  end if;

  v_meses         := p_n_cuotas * v_meses_por_cuota;
  v_interes_total := round(p_capital * p_tasa_mensual * v_meses);
  v_interes_cuota := round(v_interes_total / p_n_cuotas);
  v_capital_cuota := round(p_capital / p_n_cuotas);

  v_paso := case p_frecuencia
              when 'diaria'    then interval '1 day'
              when 'semanal'   then interval '7 days'
              when 'quincenal' then interval '15 days'
              else                  interval '1 month'
            end;

  insert into public.prestamos (
    user_id, negocio_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, tipo, fecha_desembolso, estado,
    codeudor_nombre, codeudor_telefono, codeudor_documento
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, 'cuotas', p_fecha_desembolso, 'activo',
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento
  )
  returning * into v_prestamo;

  insert into public.movimientos (
    user_id, negocio_id, prestamo_id, fecha, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior
  ) values (
    v_user, v_negocio, v_prestamo.id, p_fecha_desembolso, 'desembolso',
    p_capital, 0, 0, 0, p_capital
  );

  for i in 1..p_n_cuotas loop
    if i < p_n_cuotas then
      v_cap := v_capital_cuota;
      v_int := v_interes_cuota;
    else
      -- la última cuota absorbe el redondeo (capital e interés cuadran exacto).
      v_cap := p_capital - v_capital_cuota * (p_n_cuotas - 1);
      v_int := v_interes_total - v_interes_cuota * (p_n_cuotas - 1);
    end if;

    insert into public.cuotas (
      user_id, negocio_id, prestamo_id, numero, fecha_vence, capital, interes, estado
    ) values (
      v_user, v_negocio, v_prestamo.id, i,
      (p_fecha_desembolso + (i * v_paso))::date,
      v_cap, v_int, 'pendiente'
    );
  end loop;

  return v_prestamo;
end;
$$;

grant execute on function public.crear_prestamo_cuotas(uuid, numeric, numeric, text, int, date, text, text, text) to authenticated;


-- ── crear_prestamo_cuota_fija (producto "cuota_fija") — réplica de 020 + negocio ──
-- Referencia: generarCronogramaFijo() en src/lib/motor-prestamos.ts.
create or replace function public.crear_prestamo_cuota_fija(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_frecuencia        text,
  p_n_cuotas          int,
  p_valor_cuota       numeric,
  p_fecha_desembolso  date,
  p_codeudor_nombre   text default null,
  p_codeudor_telefono text default null,
  p_codeudor_documento text default null
)
returns public.prestamos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_negocio  uuid := public.mi_negocio();
  v_prestamo public.prestamos;
  v_total    numeric;
  v_paso     interval;
  i          int;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio; no se puede crear el préstamo.';
  end if;
  if p_n_cuotas < 1 then
    raise exception 'El número de cuotas debe ser al menos 1.';
  end if;
  if p_valor_cuota <= 0 then
    raise exception 'El valor de la cuota debe ser mayor a cero.';
  end if;

  v_paso := case p_frecuencia
              when 'diaria'    then interval '1 day'
              when 'semanal'   then interval '7 days'
              when 'quincenal' then interval '15 days'
              when 'mensual'   then interval '1 month'
              else null
            end;
  if v_paso is null then
    raise exception 'Frecuencia inválida: %', p_frecuencia;
  end if;

  v_total := p_n_cuotas * p_valor_cuota; -- total a cobrar (= saldo inicial)

  insert into public.prestamos (
    user_id, negocio_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, tipo, valor_cuota, fecha_desembolso, estado,
    codeudor_nombre, codeudor_telefono, codeudor_documento
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, v_total,
    0, 'cuota_fija', p_valor_cuota, p_fecha_desembolso, 'activo',
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento
  )
  returning * into v_prestamo;

  insert into public.movimientos (
    user_id, negocio_id, prestamo_id, fecha, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior
  ) values (
    v_user, v_negocio, v_prestamo.id, p_fecha_desembolso, 'desembolso',
    p_capital, 0, 0, 0, p_capital
  );

  for i in 1..p_n_cuotas loop
    insert into public.cuotas (
      user_id, negocio_id, prestamo_id, numero, fecha_vence, capital, interes, abonado, estado
    ) values (
      v_user, v_negocio, v_prestamo.id, i,
      (p_fecha_desembolso + (i * v_paso))::date,
      p_valor_cuota, 0, 0, 'pendiente'
    );
  end loop;

  return v_prestamo;
end;
$$;

grant execute on function public.crear_prestamo_cuota_fija(uuid, numeric, text, int, numeric, date, text, text, text) to authenticated;


-- ── registrar_pago (producto "abierto") — réplica de 004 + negocio ──
create or replace function public.registrar_pago(
  p_prestamo_id                uuid,
  p_monto                      numeric,
  p_metodo_pago                text,
  p_tipo                       text,
  p_monto_interes              numeric,
  p_monto_capital              numeric,
  p_saldo_anterior             numeric,
  p_saldo_posterior            numeric,
  p_interes_pendiente_restante numeric
)
returns public.movimientos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_negocio    uuid := public.mi_negocio();
  v_movimiento public.movimientos;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio.';
  end if;

  -- Bajo RLS, este select solo ve los préstamos del negocio del usuario; un
  -- préstamo de otro negocio simplemente "no existe" para él (frontera).
  if not exists (select 1 from public.prestamos where id = p_prestamo_id) then
    raise exception 'Préstamo no encontrado.';
  end if;

  insert into public.movimientos (
    user_id, negocio_id, prestamo_id, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior, metodo_pago
  ) values (
    v_user, v_negocio, p_prestamo_id, p_tipo,
    p_monto, p_monto_interes, p_monto_capital,
    p_saldo_anterior, p_saldo_posterior, p_metodo_pago
  )
  returning * into v_movimiento;

  update public.prestamos
     set saldo_capital     = p_saldo_posterior,
         interes_pendiente = p_interes_pendiente_restante,
         estado            = case when p_saldo_posterior = 0 then 'pagado' else estado end
   where id = p_prestamo_id;

  return v_movimiento;
end;
$$;

grant execute on function public.registrar_pago(
  uuid, numeric, text, text, numeric, numeric, numeric, numeric, numeric
) to authenticated;


-- ── registrar_pago_cuotas (producto "cuotas") — réplica de 013 + negocio ──
-- Referencia: aplicarPagoACuotas / pagarSoloInteres en motor-prestamos.ts.
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
  v_negocio     uuid := public.mi_negocio();
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
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio.';
  end if;

  select * into v_prestamo from public.prestamos where id = p_prestamo_id; -- RLS: solo el de su negocio
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

    insert into public.cuotas (user_id, negocio_id, prestamo_id, numero, fecha_vence, capital, interes, estado)
    values (v_user, v_negocio, p_prestamo_id, v_max_num + 1, v_ultima_fecha + v_step, v_vig.capital, v_vig.interes, 'pendiente');

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
    user_id, negocio_id, prestamo_id, tipo, monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior, metodo_pago
  ) values (
    v_user, v_negocio, p_prestamo_id, v_tipo, v_monto_total, v_int, v_cap,
    v_saldo_ant, v_saldo_pos, p_metodo_pago
  )
  returning * into v_mov;

  return v_mov;
end;
$$;

grant execute on function public.registrar_pago_cuotas(uuid, numeric, text, boolean) to authenticated;


-- ── registrar_pago_cuota_fija (producto "cuota_fija") — réplica de 021 + negocio ──
-- Referencia: aplicarPagoFijo en src/lib/motor-prestamos.ts.
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
  v_negocio     uuid := public.mi_negocio();
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
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio.';
  end if;
  if p_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  select * into v_prestamo from public.prestamos where id = p_prestamo_id; -- RLS: solo el de su negocio
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
    user_id, negocio_id, prestamo_id, tipo, monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior, metodo_pago
  ) values (
    v_user, v_negocio, p_prestamo_id, 'cuota', v_aplicado, 0, v_aplicado,
    v_saldo_ant, v_saldo_pos, p_metodo_pago
  )
  returning * into v_mov;

  return v_mov;
end;
$$;

grant execute on function public.registrar_pago_cuota_fija(uuid, numeric, text) to authenticated;
