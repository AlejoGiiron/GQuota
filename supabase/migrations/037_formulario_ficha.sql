-- ============================================================
--  037 — Ficha por enlace, fase 1B: formulario del prospecto y fotos.
--
--  1. Reglas nuevas de las fotos en ficha_config (Ley 1581): el frente siempre
--     obligatorio; el respaldo NUNCA obligatorio (tiene la huella, dato sensible:
--     el prospecto lo entrega solo si lo autoriza aparte); la selfie apagada
--     (llega después, con su propia autorización).
--  2. negocios.contacto_datos: canal para que el titular ejerza sus derechos.
--     Obligatorio para crear enlaces (crear_solicitud lo exige).
--  3. solicitudes.autorizacion_respaldo: si autorizó la foto del respaldo.
--  4. Bucket privado `solicitudes` para las fotos (sin políticas: nadie entra con
--     la anon key ni con sesión; solo service_role desde la Edge Function).
--
--  NEGOCIOS EXISTENTES (incluido el de Luis): solo se ajusta su ficha_config a
--  las reglas nuevas (respaldo obligatorio → opcional, selfie → apagada). Es la
--  configuración de una función que no usan; sin esto, el CHECK nuevo haría
--  fallar cualquier guardado futuro en Configuración. No se toca ninguna otra
--  columna, ni préstamos, pagos, clientes ni el cron.
-- ============================================================

-- ── 1. Reglas de la ficha ─────────────────────────────────────
create or replace function public.ficha_config_valida(c jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(c) is distinct from 'object'
      or jsonb_typeof(c -> 'lectura_automatica') is distinct from 'boolean'
      or jsonb_typeof(c -> 'campos') is distinct from 'object'
    then false
    else
      (c -> 'campos') ?& array[
        'cedula_frente', 'cedula_reverso', 'selfie_cedula',
        'nombres', 'apellidos', 'cedula', 'celular', 'fecha_nacimiento', 'telefono_alterno', 'correo',
        'direccion_casa', 'barrio', 'ciudad', 'tipo_vivienda', 'tiempo_vivienda',
        'ocupacion', 'negocio_empresa', 'direccion_trabajo', 'ingresos', 'foto_fachada',
        'referencia_1', 'referencia_2'
      ]
      and (select count(*) from jsonb_object_keys(c -> 'campos')) = 22
      and not exists (
        select 1 from jsonb_each(c -> 'campos') e
        where jsonb_typeof(e.value) is distinct from 'string'
           or (e.value #>> '{}') not in ('apagado', 'opcional', 'obligatorio')
      )
      and c -> 'campos' ->> 'nombres' = 'obligatorio'
      and c -> 'campos' ->> 'apellidos' = 'obligatorio'
      and c -> 'campos' ->> 'cedula' = 'obligatorio'
      and c -> 'campos' ->> 'celular' = 'obligatorio'
      -- Fotos (037): frente obligatorio; respaldo nunca obligatorio; selfie apagada.
      and c -> 'campos' ->> 'cedula_frente' = 'obligatorio'
      and c -> 'campos' ->> 'cedula_reverso' <> 'obligatorio'
      and c -> 'campos' ->> 'selfie_cedula' = 'apagado'
      -- Sin foto del respaldo no hay código que leer.
      and (not (c ->> 'lectura_automatica')::boolean or c -> 'campos' ->> 'cedula_reverso' = 'opcional')
  end
$$;

revoke execute on function public.ficha_config_valida(jsonb) from public, anon;
grant execute on function public.ficha_config_valida(jsonb) to authenticated;

-- Ajusta SOLO la ficha_config de los negocios que no cumplen las reglas nuevas.
update public.negocios
   set ficha_config = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(ficha_config, '{campos,cedula_frente}', '"obligatorio"'),
             '{campos,selfie_cedula}', '"apagado"'),
           '{campos,cedula_reverso}',
           case when ficha_config -> 'campos' ->> 'cedula_reverso' = 'apagado' then '"apagado"'::jsonb else '"opcional"'::jsonb end),
         '{lectura_automatica}',
         to_jsonb((ficha_config ->> 'lectura_automatica')::boolean
                  and ficha_config -> 'campos' ->> 'cedula_reverso' <> 'apagado'))
 where not public.ficha_config_valida(ficha_config);

-- Mismo valor que FICHA_POR_DEFECTO en supabase/functions/_shared/ficha.ts (una prueba los compara).
alter table public.negocios
  alter column ficha_config set default '{
    "version": 1,
    "lectura_automatica": true,
    "campos": {
      "cedula_frente": "obligatorio",
      "cedula_reverso": "opcional",
      "selfie_cedula": "apagado",
      "nombres": "obligatorio",
      "apellidos": "obligatorio",
      "cedula": "obligatorio",
      "celular": "obligatorio",
      "fecha_nacimiento": "opcional",
      "telefono_alterno": "opcional",
      "correo": "apagado",
      "direccion_casa": "obligatorio",
      "barrio": "obligatorio",
      "ciudad": "obligatorio",
      "tipo_vivienda": "obligatorio",
      "tiempo_vivienda": "opcional",
      "ocupacion": "obligatorio",
      "negocio_empresa": "obligatorio",
      "direccion_trabajo": "obligatorio",
      "ingresos": "opcional",
      "foto_fachada": "opcional",
      "referencia_1": "obligatorio",
      "referencia_2": "opcional"
    }
  }'::jsonb;

-- ── 2. Contacto para datos personales ─────────────────────────
-- WhatsApp o correo del negocio para que el titular ejerza sus derechos
-- (conocer, actualizar, rectificar, suprimir, revocar). Lo muestra la
-- autorización del formulario. Nullable: los negocios existentes no lo tienen.
alter table public.negocios
  add column contacto_datos text
  check (contacto_datos is null or char_length(btrim(contacto_datos)) between 5 and 120);

-- ── 3. Autorización de la foto del respaldo ──────────────────
alter table public.solicitudes
  add column autorizacion_respaldo boolean;

-- ── 4. Bucket privado de fotos ────────────────────────────────
-- Ruta: <negocio_id>/<solicitud_id>/{frente,respaldo,fachada}.jpg
-- Sin políticas en storage.objects para este bucket: ni anon ni authenticated
-- pueden leer, listar ni subir. La subida es con URL firmada que emite la Edge
-- Function (service_role) tras validar el token. Tamaño y tipo los hace cumplir
-- Storage también con URL firmada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solicitudes', 'solicitudes', false, 3145728, array['image/jpeg']);

-- ── 5. crear_solicitud exige el contacto para datos personales ─
-- Misma firma y lógica de la 035; solo se agrega el guard del contacto.
create or replace function public.crear_solicitud(p_celular text, p_nombre text default null)
returns table (id uuid, token text, telefono text, nombre_referencia text, expira_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_negocio  uuid := public.mi_negocio();
  v_telefono text := public.normalizar_celular_co(p_celular);
  v_nombre   text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_token    text;
  v_id       uuid;
  v_expira   timestamptz := now() + interval '24 hours';
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio.';
  end if;
  if public.mi_rol() is distinct from 'dueno' then
    raise exception 'Solo el dueño puede crear enlaces de solicitud.';
  end if;
  if not exists (select 1 from public.negocios n where n.id = v_negocio and n.contacto_datos is not null) then
    raise exception 'Antes de crear enlaces, agregue en Configuración el contacto para datos personales.';
  end if;
  if v_telefono is null then
    raise exception 'El celular debe tener 10 dígitos y empezar por 3.';
  end if;
  if v_nombre is not null and char_length(v_nombre) > 80 then
    raise exception 'El nombre es muy largo (máximo 80 caracteres).';
  end if;

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');

  update public.solicitudes s
     set estado = 'anulada'
   where s.negocio_id = v_negocio
     and s.telefono = v_telefono
     and s.estado = 'enviada';

  insert into public.solicitudes (negocio_id, telefono, nombre_referencia, token_hash, expira_en, creado_por)
  values (v_negocio, v_telefono, v_nombre, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expira, v_user)
  returning solicitudes.id into v_id;

  return query select v_id, v_token, v_telefono, v_nombre, v_expira;
end;
$$;

revoke execute on function public.crear_solicitud(text, text) from public, anon;
grant execute on function public.crear_solicitud(text, text) to authenticated;
