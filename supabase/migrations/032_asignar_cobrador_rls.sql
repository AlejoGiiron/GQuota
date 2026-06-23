-- ============================================================
--  032 — Asignar préstamos a cobradores + RLS por asignación (Fase 3A)
--
--  Modelo (decisión cerrada):
--    - prestamos.cobrador_id -> miembros(id), NULLABLE. Un préstamo puede estar
--      asignado a un miembro del negocio, o sin asignar (null).
--    - Solo el DUEÑO asigna/reasigna/desasigna (RPC asignar_cobrador).
--    - El DUEÑO ve TODO su negocio (asignado o no, incluso si el cobrador del
--      préstamo quedó inactivo). El COBRADOR ve SOLO los préstamos asignados a su
--      membresía activa, y las cuotas/movimientos/clientes DE ESOS préstamos.
--    - Préstamo sin cobrador o asignado a un cobrador INACTIVO -> solo el dueño.
--
--  Recursión de políticas: cuotas/movimientos/clientes necesitan mirar
--  `prestamos` para decidir visibilidad. Para no disparar la RLS de prestamos
--  dentro de esas políticas (y razonar la regla en un solo lugar), la visibilidad
--  se encapsula en helpers SECURITY DEFINER (puedo_ver_prestamo /
--  cliente_visible_para_cobrador), gemelos de mi_negocio()/mi_rol()/mi_miembro_id().
--
--  ORDEN (cada paso asume el anterior):
--    1. columna prestamos.cobrador_id
--    2. helper mi_miembro_id()
--    3. helpers de visibilidad (puedo_ver_prestamo, cliente_visible_para_cobrador)
--    4. RLS de prestamos (select/update por rol+asignación)
--    5. RLS de cuotas y movimientos (visibles si su préstamo es visible)
--    6. RLS de clientes (cobrador ve solo clientes con préstamo asignado a él)
--    7. RPC asignar_cobrador (asignar / reasignar / desasignar — solo dueño)
--    8. RPC de creación: cobrador_id opcional
-- ============================================================

-- ----------------------------------------------------------------
--  1. cobrador_id en prestamos. NULLABLE; los préstamos existentes quedan null
--     (sin asignar). on delete set null: si un día se borrara la membresía, el
--     préstamo queda sin asignar (hoy las membresías no se borran, se inactivan).
-- ----------------------------------------------------------------
alter table public.prestamos
  add column cobrador_id uuid references public.miembros(id) on delete set null;
create index on public.prestamos (cobrador_id);

-- ----------------------------------------------------------------
--  2. mi_miembro_id() — id de la membresía ACTIVA del usuario actual.
--     Gemela de mi_negocio()/mi_rol(): SECURITY DEFINER (lee miembros sin RLS,
--     sin recursión) + STABLE. Devuelve null para usuarios sin membresía activa
--     (inactivos incluidos) -> un cobrador inactivo no resuelve y no ve nada.
-- ----------------------------------------------------------------
create or replace function public.mi_miembro_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.miembros
   where user_id = auth.uid() and activo
   limit 1;
$$;

revoke execute on function public.mi_miembro_id() from public;
grant execute on function public.mi_miembro_id() to authenticated;

-- ----------------------------------------------------------------
--  3a. puedo_ver_prestamo(id) — ¿el usuario actual puede ver este préstamo?
--      Dueño: cualquier préstamo de su negocio (asignado o no, aunque su
--      cobrador esté inactivo). Cobrador: solo si está asignado a su membresía
--      activa. SECURITY DEFINER: el SELECT a prestamos NO dispara la RLS de
--      prestamos (evita recursión cuando esto se usa en políticas de cuotas/
--      movimientos) y deja la regla de visibilidad en un solo sitio.
-- ----------------------------------------------------------------
create or replace function public.puedo_ver_prestamo(p_prestamo_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.prestamos p
    where p.id = p_prestamo_id
      and p.negocio_id = public.mi_negocio()
      and (public.mi_rol() = 'dueno' or p.cobrador_id = public.mi_miembro_id())
  );
$$;

revoke execute on function public.puedo_ver_prestamo(uuid) from public;
grant execute on function public.puedo_ver_prestamo(uuid) to authenticated;

-- ----------------------------------------------------------------
--  3b. cliente_visible_para_cobrador(id) — ¿el cobrador tiene ALGÚN préstamo de
--      este cliente asignado a él? EXISTS sobre préstamos asignados a su
--      membresía (cobrador_id = mi_miembro_id()), NO sobre todos los del negocio:
--      así el cobrador ve al cliente compartido pero solo por la vía de SU
--      asignación. SECURITY DEFINER por la misma razón (no recursión vía prestamos).
--      Para un dueño no se usa (su rama de la política ya lo cubre).
-- ----------------------------------------------------------------
create or replace function public.cliente_visible_para_cobrador(p_cliente_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.prestamos p
    where p.cliente_id = p_cliente_id
      and p.cobrador_id = public.mi_miembro_id()
  );
$$;

revoke execute on function public.cliente_visible_para_cobrador(uuid) from public;
grant execute on function public.cliente_visible_para_cobrador(uuid) to authenticated;

-- ----------------------------------------------------------------
--  4. RLS de PRESTAMOS por rol + asignación.
--     SELECT/UPDATE: dueño = todo el negocio; cobrador = solo asignados a él.
--     (Estrechar el UPDATE — antes abierto a todo el negocio — evita que un
--     cobrador toque saldos de préstamos ajenos; sigue pudiendo registrar pagos
--     de los suyos, que es lo que actualiza saldo/interés.)
--     INSERT/DELETE (solo dueño) NO cambian: se conservan de la 027.
-- ----------------------------------------------------------------
drop policy "prestamos_select_negocio" on public.prestamos;
drop policy "prestamos_update_negocio" on public.prestamos;

create policy "prestamos_select" on public.prestamos
  for select using (
    negocio_id = public.mi_negocio()
    and (public.mi_rol() = 'dueno' or cobrador_id = public.mi_miembro_id())
  );

create policy "prestamos_update" on public.prestamos
  for update using (
    negocio_id = public.mi_negocio()
    and (public.mi_rol() = 'dueno' or cobrador_id = public.mi_miembro_id())
  ) with check (
    negocio_id = public.mi_negocio()
    and (public.mi_rol() = 'dueno' or cobrador_id = public.mi_miembro_id())
  );

-- ----------------------------------------------------------------
--  5. RLS de CUOTAS y MOVIMIENTOS: una fila es visible/escribible si su préstamo
--     es visible para el usuario. FOR ALL: el cobrador necesita INSERT/UPDATE en
--     ambas para registrar pagos (la ruta solo-interés inserta una cuota NUEVA;
--     el WITH CHECK la valida contra el préstamo asignado, así que pasa).
--     Las RPC registrar_pago* son security invoker, así que ESTA RLS se aplica a
--     sus escrituras: por eso debe permitir lo del cobrador sobre lo suyo.
-- ----------------------------------------------------------------
drop policy "cuotas_negocio" on public.cuotas;
create policy "cuotas_por_prestamo" on public.cuotas
  for all
  using (public.puedo_ver_prestamo(prestamo_id))
  with check (public.puedo_ver_prestamo(prestamo_id));

drop policy "movimientos_negocio" on public.movimientos;
create policy "movimientos_por_prestamo" on public.movimientos
  for all
  using (public.puedo_ver_prestamo(prestamo_id))
  with check (public.puedo_ver_prestamo(prestamo_id));

-- ----------------------------------------------------------------
--  6. RLS de CLIENTES (solo SELECT cambia; escritura sigue solo-dueño de la 027).
--     Dueño: todos los del negocio. Cobrador: solo clientes con ALGÚN préstamo
--     asignado a él (caso fino del cliente compartido: ve al cliente, pero sus
--     préstamos los filtra la RLS de prestamos -> solo ve los asignados a él).
-- ----------------------------------------------------------------
drop policy "clientes_select_negocio" on public.clientes;
create policy "clientes_select" on public.clientes
  for select using (
    negocio_id = public.mi_negocio()
    and (public.mi_rol() = 'dueno' or public.cliente_visible_para_cobrador(id))
  );
-- clientes_insert_dueno / clientes_update_dueno / clientes_delete_dueno (027)
-- se conservan: el cobrador NO puede crear/editar/borrar clientes.

-- ----------------------------------------------------------------
--  7. asignar_cobrador — asignar / reasignar / DESASIGNAR (null). Solo el dueño.
--     security invoker: el UPDATE pasa por la RLS de prestamos (rama dueño).
--     Valida: préstamo de su negocio; y si p_cobrador_id no es null, que sea un
--     miembro ACTIVO del MISMO negocio (no de otro, no inactivo).
-- ----------------------------------------------------------------
create or replace function public.asignar_cobrador(
  p_prestamo_id uuid,
  p_cobrador_id uuid default null
)
returns public.prestamos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_negocio  uuid := public.mi_negocio();
  v_prestamo public.prestamos;
begin
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio.';
  end if;
  if public.mi_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede asignar cobradores.';
  end if;
  if not exists (
    select 1 from public.prestamos where id = p_prestamo_id and negocio_id = v_negocio
  ) then
    raise exception 'El préstamo no pertenece a tu negocio.';
  end if;
  if p_cobrador_id is not null and not exists (
    select 1 from public.miembros m
    where m.id = p_cobrador_id and m.negocio_id = v_negocio and m.activo
  ) then
    raise exception 'El cobrador no es un miembro activo de tu negocio.';
  end if;

  update public.prestamos
     set cobrador_id = p_cobrador_id
   where id = p_prestamo_id and negocio_id = v_negocio
  returning * into v_prestamo;

  return v_prestamo;
end;
$$;

revoke execute on function public.asignar_cobrador(uuid, uuid) from public, anon;
grant execute on function public.asignar_cobrador(uuid, uuid) to authenticated;

-- ============================================================
--  8. RPC de creación: cobrador_id OPCIONAL.
--     Se recrean las versiones VIGENTES (027) AGREGANDO el parámetro p_cobrador_id
--     al final (default null) y, si viene, validándolo como miembro activo del
--     negocio. Como agregar un parámetro crea otra firma, se DROPEA la firma vieja
--     antes (las llamadas del front por nombre resuelven a la nueva, el parámetro
--     nuevo cae a su default).
--     ⚠️ crear_prestamo conserva el interés del primer periodo (regla 015/026).
-- ============================================================

-- ── crear_prestamo (producto "abierto") ──
drop function public.crear_prestamo(uuid, numeric, numeric, text, date, text, text, text);
create function public.crear_prestamo(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_tasa_mensual      numeric,
  p_modo_interes      text,
  p_fecha_desembolso  date,
  p_codeudor_nombre   text default null,
  p_codeudor_telefono text default null,
  p_codeudor_documento text default null,
  p_cobrador_id       uuid default null
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
  if p_cobrador_id is not null and not exists (
    select 1 from public.miembros m where m.id = p_cobrador_id and m.negocio_id = v_negocio and m.activo
  ) then
    raise exception 'El cobrador no es un miembro activo de tu negocio.';
  end if;

  insert into public.prestamos (
    user_id, negocio_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, modo_interes, fecha_desembolso, estado,
    interes_pendiente, ultimo_devengo,
    codeudor_nombre, codeudor_telefono, codeudor_documento, cobrador_id
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, p_modo_interes, p_fecha_desembolso, 'activo',
    round(p_capital * p_tasa_mensual),  -- interés del primer periodo (ambos modos)
    p_fecha_desembolso,                 -- evita que el devengo de este mes lo duplique
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento, p_cobrador_id
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

  return v_prestamo;
end;
$$;

grant execute on function public.crear_prestamo(uuid, numeric, numeric, text, date, text, text, text, uuid) to authenticated;


-- ── crear_prestamo_cuotas (producto "cuotas") ──
-- REPARTO capital/interés IDÉNTICO a generarCronograma() en motor-prestamos.ts.
drop function public.crear_prestamo_cuotas(uuid, numeric, numeric, text, int, date, text, text, text);
create function public.crear_prestamo_cuotas(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_tasa_mensual      numeric,
  p_frecuencia        text,
  p_n_cuotas          int,
  p_fecha_desembolso  date,
  p_codeudor_nombre   text default null,
  p_codeudor_telefono text default null,
  p_codeudor_documento text default null,
  p_cobrador_id       uuid default null
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
  if p_cobrador_id is not null and not exists (
    select 1 from public.miembros m where m.id = p_cobrador_id and m.negocio_id = v_negocio and m.activo
  ) then
    raise exception 'El cobrador no es un miembro activo de tu negocio.';
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
    codeudor_nombre, codeudor_telefono, codeudor_documento, cobrador_id
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, 'cuotas', p_fecha_desembolso, 'activo',
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento, p_cobrador_id
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

grant execute on function public.crear_prestamo_cuotas(uuid, numeric, numeric, text, int, date, text, text, text, uuid) to authenticated;


-- ── crear_prestamo_cuota_fija (producto "cuota_fija") ──
-- Referencia: generarCronogramaFijo() en motor-prestamos.ts.
drop function public.crear_prestamo_cuota_fija(uuid, numeric, text, int, numeric, date, text, text, text);
create function public.crear_prestamo_cuota_fija(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_frecuencia        text,
  p_n_cuotas          int,
  p_valor_cuota       numeric,
  p_fecha_desembolso  date,
  p_codeudor_nombre   text default null,
  p_codeudor_telefono text default null,
  p_codeudor_documento text default null,
  p_cobrador_id       uuid default null
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
  if p_cobrador_id is not null and not exists (
    select 1 from public.miembros m where m.id = p_cobrador_id and m.negocio_id = v_negocio and m.activo
  ) then
    raise exception 'El cobrador no es un miembro activo de tu negocio.';
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
    codeudor_nombre, codeudor_telefono, codeudor_documento, cobrador_id
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, v_total,
    0, 'cuota_fija', p_valor_cuota, p_fecha_desembolso, 'activo',
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento, p_cobrador_id
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

grant execute on function public.crear_prestamo_cuota_fija(uuid, numeric, text, int, numeric, date, text, text, text, uuid) to authenticated;
