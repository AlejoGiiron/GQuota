-- ============================================================
--  027 — Roles 'dueno' y 'cobrador' con efecto en la BASE
--
--  La Fase 1 dejó el campo miembros.rol (default 'dueno'). Esta migración le
--  da efecto en la capa de seguridad real (RPC + RLS). La UI lo refleja aparte;
--  la base es la que MANDA: un cobrador que llame una operación prohibida
--  directamente debe ser rechazado aquí.
--
--  Permisos:
--    - Cobrador PUEDE: registrar pagos (3 tipos), ver clientes y préstamos.
--    - Cobrador NO PUEDE: crear préstamos, crear/editar/eliminar clientes.
--    - Dueño: todo.
--  (La restricción del cobrador a "su ruta" es Fase 3; aquí ve todo el negocio.)
-- ============================================================

-- ----------------------------------------------------------------
--  mi_rol() — rol del miembro autenticado (gemela de mi_negocio()).
--
--  SECURITY DEFINER a propósito: se usa dentro de las políticas RLS de
--  clientes/prestamos, y lee `miembros`. Como definer, esa lectura NO dispara
--  la RLS de `miembros` → sin recursión (igual razonamiento que mi_negocio()).
--  STABLE: no cambia dentro de una misma sentencia. Devuelve null si el usuario
--  no es miembro de ningún negocio (y entonces ninguna política de rol pasa).
-- ----------------------------------------------------------------
create or replace function public.mi_rol()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.miembros where user_id = auth.uid() limit 1;
$$;

revoke execute on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;

-- ----------------------------------------------------------------
--  RLS por rol en CLIENTES.
--  Los clientes se crean/editan por INSERT/UPDATE/DELETE directos (no RPC), así
--  que el rol se hace cumplir en la política. SELECT abierto a todo el negocio
--  (el cobrador necesita verlos para cobrar); escribir solo el dueño.
-- ----------------------------------------------------------------
drop policy "clientes_negocio" on public.clientes;

create policy "clientes_select_negocio" on public.clientes
  for select using (negocio_id = public.mi_negocio());

create policy "clientes_insert_dueno" on public.clientes
  for insert with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno');

create policy "clientes_update_dueno" on public.clientes
  for update using (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno')
           with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno');

create policy "clientes_delete_dueno" on public.clientes
  for delete using (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno');

-- ----------------------------------------------------------------
--  RLS por rol en PRESTAMOS.
--  SELECT: todo el negocio (cobrador los ve para cobrar).
--  UPDATE: todo el negocio — los pagos (registrar_pago*) actualizan
--          saldo_capital/interes_pendiente/estado del préstamo, y el cobrador
--          SÍ puede pagar. (No se limita por columna; el cálculo lo hace el
--          motor/RPC, no la UI.)
--  INSERT/DELETE: solo el dueño (crear un préstamo es del dueño; no hay borrado
--          en la app, pero se cierra el bypass directo por PostgREST).
-- ----------------------------------------------------------------
drop policy "prestamos_negocio" on public.prestamos;

create policy "prestamos_select_negocio" on public.prestamos
  for select using (negocio_id = public.mi_negocio());

create policy "prestamos_update_negocio" on public.prestamos
  for update using (negocio_id = public.mi_negocio())
           with check (negocio_id = public.mi_negocio());

create policy "prestamos_insert_dueno" on public.prestamos
  for insert with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno');

create policy "prestamos_delete_dueno" on public.prestamos
  for delete using (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno');

-- NOTA: movimientos y cuotas NO cambian (siguen a nivel de negocio, ambos
-- roles). El cobrador necesita INSERT en movimientos (pago) y en cuotas (el
-- pago de solo-interés crea una cuota nueva), así que ahí no se restringe rol.

-- ============================================================
--  Guard de rol en las 3 RPC de creación de préstamos.
--  Se recrean (create or replace) las versiones VIGENTES (crear_prestamo de la
--  026 con interés del primer periodo; cuotas y cuota_fija de la 025), AGREGANDO
--  al inicio: si mi_rol() <> 'dueno' → excepción. Doble red con la RLS de
--  prestamos (insert solo dueño). Cálculo intacto.
-- ============================================================

-- ── crear_prestamo (producto "abierto") ──
-- ⚠️ Conserva el interés del primer periodo (regla de la 015/026): NO quitar.
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
  if public.mi_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede crear préstamos.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and negocio_id = v_negocio) then
    raise exception 'El cliente no pertenece a tu negocio.';
  end if;

  insert into public.prestamos (
    user_id, negocio_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, modo_interes, fecha_desembolso, estado,
    interes_pendiente, ultimo_devengo,
    codeudor_nombre, codeudor_telefono, codeudor_documento
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, p_modo_interes, p_fecha_desembolso, 'activo',
    round(p_capital * p_tasa_mensual),  -- interés del primer periodo (ambos modos)
    p_fecha_desembolso,                 -- evita que el devengo de este mes lo duplique
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


-- ── crear_prestamo_cuotas (producto "cuotas") ──
-- REPARTO capital/interés IDÉNTICO a generarCronograma() en motor-prestamos.ts.
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
  if public.mi_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede crear préstamos.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and negocio_id = v_negocio) then
    raise exception 'El cliente no pertenece a tu negocio.';
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


-- ── crear_prestamo_cuota_fija (producto "cuota_fija") ──
-- Referencia: generarCronogramaFijo() en motor-prestamos.ts.
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
  if public.mi_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede crear préstamos.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and negocio_id = v_negocio) then
    raise exception 'El cliente no pertenece a tu negocio.';
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
