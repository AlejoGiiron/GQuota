-- ============================================================
--  039 — Ficha por enlace, fase 1C: revisar, aprobar o rechazar solicitudes.
--
--  1. solicitudes: resultado de la relectura del respaldo (verificacion), motivo
--     del rechazo y cuándo se borraron sus fotos. El dueño deja de poder
--     actualizar la tabla directo: todo pasa por las funciones de abajo (la app
--     no usaba ese permiso: reenviar va por crear_solicitud).
--  2. clientes: ficha (lo que se aprobó, con celular), origen de cada campo y la
--     solicitud de la que salió. Columnas vacías por defecto: los clientes que ya
--     existen (los de Luis) no cambian.
--  3. Storage: el dueño puede leer (URLs firmadas) las fotos de SU negocio. El
--     cobrador y anon, nada.
--  4. guardar_verificacion, aprobar_solicitud y rechazar_solicitud: SECURITY
--     DEFINER, solo el dueño de su negocio.
--  5. Limpieza: la Edge Function limpiar-solicitudes borra las fotos de enlaces
--     vencidos o anulados y de solicitudes rechazadas. La llama pg_net: al
--     rechazar (al instante) y cada noche con pg_cron (reintenta lo que faltó).
--     Las rechazadas se borran del todo a los 30 días. La URL y la clave de la
--     función viven en Vault (no en el repo).
--
--  NO cambia: préstamos, pagos, cuotas, las 8 RPC ni los tres jobs del cron.
--  solicitudes_activas sigue en false por defecto (la activa el dueño del
--  proyecto, negocio por negocio).
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- ── 1. solicitudes ────────────────────────────────────────────
alter table public.solicitudes
  add column verificacion text check (verificacion in ('verificado', 'discrepancia', 'sin_verificar')),
  add column verificacion_en timestamptz,
  -- Solo si hay discrepancia: { campo: valor leído del código } de los campos distintos.
  add column verificacion_detalle jsonb,
  add column motivo_rechazo text check (char_length(motivo_rechazo) <= 200),
  add column fotos_borradas_en timestamptz;

revoke update on table public.solicitudes from authenticated;
drop policy if exists solicitudes_dueno_update on public.solicitudes;

-- ── 2. clientes ───────────────────────────────────────────────
alter table public.clientes
  add column ficha jsonb,
  add column ficha_origen jsonb,
  add column solicitud_id uuid references public.solicitudes (id) on delete set null;

-- ── 3. Fotos: lectura solo para el dueño, en la carpeta de su negocio ──
create policy solicitudes_fotos_dueno_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'solicitudes'
    and (storage.foldername(name))[1] = (select public.mi_negocio())::text
    and (select public.mi_rol()) = 'dueno'
  );

-- ── 4a. Resultado de la relectura del respaldo ────────────────
create or replace function public.guardar_verificacion(p_solicitud uuid, p_resultado text, p_detalle jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio uuid := public.mi_negocio();
begin
  if auth.uid() is null or v_negocio is null or public.mi_rol() is distinct from 'dueno' then
    raise exception 'Solo el dueño puede revisar solicitudes.';
  end if;
  if p_resultado not in ('verificado', 'discrepancia', 'sin_verificar') then
    raise exception 'Resultado de verificación inválido.';
  end if;
  if p_resultado = 'discrepancia' and (
       jsonb_typeof(p_detalle) is distinct from 'object'
       or exists (select 1 from jsonb_each(p_detalle) e
                   where e.key not in ('cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'sexo', 'rh')
                      or jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') > 60)) then
    raise exception 'Detalle de la discrepancia inválido.';
  end if;

  update public.solicitudes s
     set verificacion = p_resultado,
         verificacion_en = now(),
         verificacion_detalle = case when p_resultado = 'discrepancia' then p_detalle end
   where s.id = p_solicitud
     and s.negocio_id = v_negocio
     and s.estado = 'completada';
  if not found then
    raise exception 'Esta solicitud no se puede revisar.';
  end if;
end;
$$;

-- ── 4b. Aprobar: crea el cliente (o lo vincula) en una sola transacción ──
create or replace function public.aprobar_solicitud(p_solicitud uuid, p_datos jsonb, p_cliente_existente uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_negocio   uuid := public.mi_negocio();
  s           public.solicitudes%rowtype;
  v_datos     jsonb := '{}'::jsonb;
  v_origen    jsonb := '{}'::jsonb;
  v_campo     text;
  v_valor     jsonb;
  v_cedula    text;
  v_existente uuid;
  v_cliente   uuid;
  c_identidad constant text[] := array['cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'sexo', 'rh'];
  c_campos    constant text[] := array[
    'cedula', 'nombres', 'apellidos', 'fecha_nacimiento', 'sexo', 'rh', 'telefono_alterno', 'correo',
    'direccion_casa', 'barrio', 'ciudad', 'tipo_vivienda', 'tiempo_vivienda',
    'ocupacion', 'negocio_empresa', 'direccion_trabajo', 'ingresos', 'referencia_1', 'referencia_2'];
begin
  if v_user is null or v_negocio is null or public.mi_rol() is distinct from 'dueno' then
    raise exception 'Solo el dueño puede aprobar solicitudes.';
  end if;

  select * into s from public.solicitudes x where x.id = p_solicitud and x.negocio_id = v_negocio for update;
  if not found then
    raise exception 'No encontramos la solicitud.';
  end if;
  if s.estado <> 'completada' then
    raise exception 'Esta solicitud ya fue revisada.';
  end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then
    raise exception 'Los datos de la solicitud no son válidos.';
  end if;

  -- Solo los campos de la ficha, recortados y sin vacíos.
  foreach v_campo in array c_campos loop
    v_valor := p_datos -> v_campo;
    continue when v_valor is null or v_valor = 'null'::jsonb;
    if v_campo in ('referencia_1', 'referencia_2') then
      if jsonb_typeof(v_valor) <> 'object' then
        raise exception 'La referencia no es válida.';
      end if;
      v_valor := jsonb_build_object(
        'nombre', left(btrim(coalesce(v_valor ->> 'nombre', '')), 80),
        'telefono', left(regexp_replace(coalesce(v_valor ->> 'telefono', ''), '\D', '', 'g'), 12),
        'parentesco', left(btrim(coalesce(v_valor ->> 'parentesco', '')), 40));
      continue when v_valor ->> 'nombre' = '';
    else
      if jsonb_typeof(v_valor) <> 'string' then
        raise exception 'El campo % no es texto.', v_campo;
      end if;
      continue when btrim(v_valor #>> '{}') = '';
      if char_length(btrim(v_valor #>> '{}')) > 120 then
        raise exception 'El campo % es muy largo.', v_campo;
      end if;
      v_valor := to_jsonb(btrim(v_valor #>> '{}'));
    end if;
    v_datos := v_datos || jsonb_build_object(v_campo, v_valor);
  end loop;

  if coalesce(v_datos ->> 'nombres', '') = '' or coalesce(v_datos ->> 'apellidos', '') = '' then
    raise exception 'Faltan los nombres o los apellidos.';
  end if;
  v_cedula := regexp_replace(coalesce(v_datos ->> 'cedula', ''), '\D', '', 'g');
  if v_cedula !~ '^[1-9][0-9]{4,9}$' then
    raise exception 'El número de cédula no es válido.';
  end if;
  v_datos := v_datos || jsonb_build_object('cedula', v_cedula);

  -- Origen de cada campo: lo calcula el servidor comparando con lo que envió el
  -- prospecto y con la relectura del dueño (no se confía en el navegador).
  foreach v_campo in array c_campos loop
    continue when not (v_datos ? v_campo);
    v_origen := v_origen || jsonb_build_object(v_campo,
      case
        when (s.datos -> v_campo) is distinct from (v_datos -> v_campo) then 'dueno'
        when v_campo = any (c_identidad) then
          case
            when s.verificacion = 'discrepancia' and coalesce(s.verificacion_detalle ? v_campo, false) then 'discrepancia'
            when s.verificacion in ('verificado', 'discrepancia') then 'cedula'
            else 'sin_verificar'
          end
        else 'prospecto'
      end);
  end loop;
  v_datos := v_datos || jsonb_build_object('celular', s.telefono);
  v_origen := v_origen || jsonb_build_object('celular', 'enlace');

  -- ¿Ya hay un cliente con esa cédula en el negocio? Se compara solo por dígitos.
  select c.id into v_existente
    from public.clientes c
   where c.negocio_id = v_negocio
     and regexp_replace(coalesce(c.documento, ''), '\D', '', 'g') = v_cedula
   order by c.created_at
   limit 1;

  if v_existente is not null and p_cliente_existente is null then
    return jsonb_build_object(
      'resultado', 'duplicado',
      'cliente', (select jsonb_build_object(
                    'id', c.id, 'nombre', c.nombre, 'desde', c.created_at,
                    'prestamos', (select count(*) from public.prestamos p where p.cliente_id = c.id))
                    from public.clientes c where c.id = v_existente));
  end if;
  if p_cliente_existente is not null and p_cliente_existente is distinct from v_existente then
    raise exception 'Ese cliente no tiene la misma cédula.';
  end if;

  if v_existente is null then
    insert into public.clientes (user_id, negocio_id, nombre, documento, telefono, direccion, ficha, ficha_origen, solicitud_id)
    values (
      v_user,
      v_negocio,
      left(btrim((v_datos ->> 'nombres') || ' ' || (v_datos ->> 'apellidos')), 120),
      replace(to_char(v_cedula::bigint, 'FM9,999,999,999'), ',', '.'),
      substr(s.telefono, 3, 3) || ' ' || substr(s.telefono, 6, 3) || ' ' || substr(s.telefono, 9, 4),
      v_datos ->> 'direccion_casa',
      v_datos,
      v_origen,
      s.id)
    returning id into v_cliente;
  else
    -- Vincular: los datos del cliente no se tocan. La ficha y las fotos solo se
    -- agregan si ese cliente no tenía una.
    update public.clientes c
       set ficha = v_datos, ficha_origen = v_origen, solicitud_id = s.id
     where c.id = v_existente and c.ficha is null;
    v_cliente := v_existente;
  end if;

  update public.solicitudes x
     set estado = 'aprobada', revisada_por = v_user, revisada_en = now(), cliente_id = v_cliente
   where x.id = s.id;

  return jsonb_build_object('resultado', 'aprobada', 'cliente_id', v_cliente, 'vinculado', v_existente is not null);
end;
$$;

-- ── 5. Limpieza de fotos (mantenimiento: sin permiso para la app) ──
create or replace function public.limpiar_solicitudes(p_solicitud uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_secreto text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'limpieza_solicitudes_url';
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'limpieza_solicitudes_secreto';
  -- Storage no se borra por SQL: la Edge Function lo hace. pg_net manda la
  -- petición cuando la transacción termina.
  if v_url is not null and v_secreto is not null then
    perform net.http_post(
      url := v_url,
      body := case when p_solicitud is null then '{}'::jsonb else jsonb_build_object('solicitud', p_solicitud) end,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-limpieza', v_secreto),
      timeout_milliseconds := 30000);
  end if;
  -- Ronda de la noche: las rechazadas hace más de 30 días se borran del todo
  -- (Ley 1581: no guardar más de lo necesario), si sus fotos ya se borraron.
  if p_solicitud is null then
    delete from public.solicitudes x
     where x.estado = 'rechazada'
       and x.revisada_en < now() - interval '30 days'
       and x.fotos_borradas_en is not null;
  end if;
end;
$$;

-- ── 4c. Rechazar: fotos borradas al instante, datos a los 30 días ──
create or replace function public.rechazar_solicitud(p_solicitud uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio uuid := public.mi_negocio();
  v_motivo  text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if auth.uid() is null or v_negocio is null or public.mi_rol() is distinct from 'dueno' then
    raise exception 'Solo el dueño puede rechazar solicitudes.';
  end if;
  if v_motivo is not null and char_length(v_motivo) > 200 then
    raise exception 'El motivo es muy largo (máximo 200 caracteres).';
  end if;

  update public.solicitudes s
     set estado = 'rechazada', motivo_rechazo = v_motivo, revisada_por = auth.uid(), revisada_en = now()
   where s.id = p_solicitud
     and s.negocio_id = v_negocio
     and s.estado = 'completada';
  if not found then
    raise exception 'Esta solicitud no se puede rechazar.';
  end if;

  perform public.limpiar_solicitudes(p_solicitud);
end;
$$;

-- Permisos: las tres de la revisión, solo con sesión; la limpieza, solo pg_cron.
revoke execute on function public.guardar_verificacion(uuid, text, jsonb) from public, anon;
grant execute on function public.guardar_verificacion(uuid, text, jsonb) to authenticated;
revoke execute on function public.aprobar_solicitud(uuid, jsonb, uuid) from public, anon;
grant execute on function public.aprobar_solicitud(uuid, jsonb, uuid) to authenticated;
revoke execute on function public.rechazar_solicitud(uuid, text) from public, anon;
grant execute on function public.rechazar_solicitud(uuid, text) to authenticated;
revoke execute on function public.limpiar_solicitudes(uuid) from public, anon, authenticated;

-- Ronda diaria a las 03:30 (Colombia), después de los tres jobs de siempre.
select cron.schedule('limpiar_solicitudes_diario', '30 8 * * *', 'select public.limpiar_solicitudes()');
