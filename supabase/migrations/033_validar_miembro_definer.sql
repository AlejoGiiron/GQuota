-- ============================================================
--  033 — Validar el cobrador objetivo con SECURITY DEFINER (fix de la 032)
--
--  La 032 agregó, en las RPC de creación y en asignar_cobrador (ambas SECURITY
--  INVOKER), una validación `exists (select 1 from miembros where id=p_cobrador_id
--  and negocio_id=... and activo)`. Pero `miembros` solo expone al usuario su
--  PROPIA fila (política miembros_propio_select de la 022): bajo la RLS del
--  invocador, el dueño NO "ve" la fila del cobrador objetivo, así que ese exists
--  daba falso y la asignación a cualquier cobrador fallaba SIEMPRE.
--
--  Fix: encapsular la verificación en un helper SECURITY DEFINER (lee miembros
--  sin RLS, como mi_negocio()/mi_miembro_id()) y usarlo en las 4 funciones. No
--  se relaja la RLS de miembros (los emails y el listado siguen detrás de la
--  Edge Function con service_role); solo se valida la pertenencia.
--
--  Las firmas son las MISMAS que dejó la 032, así que aquí basta create or replace.
-- ============================================================

-- ----------------------------------------------------------------
--  Helper: ¿p_miembro_id es una membresía ACTIVA del negocio p_negocio?
-- ----------------------------------------------------------------
create or replace function public.es_miembro_activo_del_negocio(
  p_miembro_id uuid,
  p_negocio    uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.miembros m
    where m.id = p_miembro_id and m.negocio_id = p_negocio and m.activo
  );
$$;

revoke execute on function public.es_miembro_activo_del_negocio(uuid, uuid) from public;
grant execute on function public.es_miembro_activo_del_negocio(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------
--  asignar_cobrador — misma lógica, validando con el helper.
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
  if p_cobrador_id is not null
     and not public.es_miembro_activo_del_negocio(p_cobrador_id, v_negocio) then
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

-- ----------------------------------------------------------------
--  crear_prestamo (abierto) — valida cobrador con el helper.
--  ⚠️ conserva el interés del primer periodo (regla 015/026).
-- ----------------------------------------------------------------
create or replace function public.crear_prestamo(
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
  if p_cobrador_id is not null
     and not public.es_miembro_activo_del_negocio(p_cobrador_id, v_negocio) then
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
    round(p_capital * p_tasa_mensual),
    p_fecha_desembolso,
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

-- ----------------------------------------------------------------
--  crear_prestamo_cuotas — valida cobrador con el helper.
-- ----------------------------------------------------------------
create or replace function public.crear_prestamo_cuotas(
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
  if p_cobrador_id is not null
     and not public.es_miembro_activo_del_negocio(p_cobrador_id, v_negocio) then
    raise exception 'El cobrador no es un miembro activo de tu negocio.';
  end if;
  if p_n_cuotas < 1 then
    raise exception 'El número de cuotas debe ser al menos 1.';
  end if;

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

-- ----------------------------------------------------------------
--  crear_prestamo_cuota_fija — valida cobrador con el helper.
-- ----------------------------------------------------------------
create or replace function public.crear_prestamo_cuota_fija(
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
  if p_cobrador_id is not null
     and not public.es_miembro_activo_del_negocio(p_cobrador_id, v_negocio) then
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

  v_total := p_n_cuotas * p_valor_cuota;

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
