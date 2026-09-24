-- ============================================================
--  035 — Ficha de cliente por enlace (fase 1A): configuración de la ficha,
--  tabla de solicitudes y RPC crear_solicitud.
--
--  El dueño escribe el celular de un prospecto y la app genera un enlace único
--  de 24 horas. El prospecto llena su ficha sin cuenta (Edge Function
--  ficha-publica, con service_role). Lo que llena queda como SOLICITUD: no es
--  cliente hasta que el dueño la apruebe (fase 1C).
--
--  ADITIVA: columna nueva en negocios (con valor por defecto) y tabla nueva.
--  No modifica datos existentes.
--
--  Seguridad:
--    - En la base solo se guarda el HASH (sha256) del token, nunca el token.
--    - solicitudes: RLS solo para el DUEÑO de su negocio (ver y modificar).
--      Ninguna política ni permiso para anon: invisible sin sesión.
--    - El cobrador no ve ni crea solicitudes (RLS + guard en la RPC).
-- ============================================================

-- ----------------------------------------------------------------
--  1. negocios.ficha_config — qué dato se pide y cómo.
--
--  Forma: { "version": 1, "lectura_automatica": bool,
--           "campos": { <campo>: "apagado" | "opcional" | "obligatorio" } }
--  Valores por defecto: los del diseño (design/paquete-2a, Configurar la ficha).
--  Reglas (las valida ficha_config_valida, como CHECK):
--    - Exactamente los 22 campos conocidos, cada uno con un modo válido.
--    - nombres, apellidos, cedula y celular: siempre obligatorios.
--    - Con la lectura automática activa, cedula_reverso es obligatoria.
--  El mismo valor por defecto vive en src/lib/ficha.ts; una prueba verifica que
--  coincidan (FICHA_POR_DEFECTO).
-- ----------------------------------------------------------------
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
      -- exactamente los campos conocidos (todos presentes y ninguno de más)
      (c -> 'campos') ?& array[
        'cedula_frente', 'cedula_reverso', 'selfie_cedula',
        'nombres', 'apellidos', 'cedula', 'celular', 'fecha_nacimiento', 'telefono_alterno', 'correo',
        'direccion_casa', 'barrio', 'ciudad', 'tipo_vivienda', 'tiempo_vivienda',
        'ocupacion', 'negocio_empresa', 'direccion_trabajo', 'ingresos', 'foto_fachada',
        'referencia_1', 'referencia_2'
      ]
      and (select count(*) from jsonb_object_keys(c -> 'campos')) = 22
      -- cada modo es válido
      and not exists (
        select 1 from jsonb_each(c -> 'campos') e
        where jsonb_typeof(e.value) is distinct from 'string'
           or (e.value #>> '{}') not in ('apagado', 'opcional', 'obligatorio')
      )
      -- siempre obligatorios
      and c -> 'campos' ->> 'nombres' = 'obligatorio'
      and c -> 'campos' ->> 'apellidos' = 'obligatorio'
      and c -> 'campos' ->> 'cedula' = 'obligatorio'
      and c -> 'campos' ->> 'celular' = 'obligatorio'
      -- la lectura automática necesita la foto del respaldo (tiene el código)
      and (not (c ->> 'lectura_automatica')::boolean or c -> 'campos' ->> 'cedula_reverso' = 'obligatorio')
  end
$$;

alter table public.negocios
  add column ficha_config jsonb not null default '{
    "version": 1,
    "lectura_automatica": true,
    "campos": {
      "cedula_frente": "obligatorio",
      "cedula_reverso": "obligatorio",
      "selfie_cedula": "obligatorio",
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

alter table public.negocios
  add constraint negocios_ficha_config_valida check (public.ficha_config_valida(ficha_config));

-- El dueño guarda la configuración por PostgREST con la política de UPDATE de
-- negocios que ya existe (028: solo el dueño); el CHECK rechaza lo inválido.

-- ----------------------------------------------------------------
--  2. Celular colombiano → formato con indicativo: '573001234567'.
--  Acepta 10 dígitos que empiezan por 3 (con o sin espacios/guiones) o el
--  número con 57 delante. Devuelve null si no es un celular válido.
--  Réplica en src/lib/solicitudes.ts (normalizarCelular), con pruebas.
-- ----------------------------------------------------------------
create or replace function public.normalizar_celular_co(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when d ~ '^3[0-9]{9}$' then '57' || d
    when d ~ '^573[0-9]{9}$' then d
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

-- ----------------------------------------------------------------
--  3. Tabla solicitudes.
--
--  estado: enviada · completada · anulada · aprobada · rechazada.
--  "Vencida" NO se guarda: es estado = 'enviada' con expira_en ya pasado.
--  Un solo enlace ENVIADO por celular y negocio (índice parcial único): generar
--  uno nuevo anula el anterior (lo hace crear_solicitud).
--  Columnas de la 1B (datos, origen, fotos, autorización) y de la 1C (revisión,
--  cliente_id) quedan creadas y vacías.
--  creado_por / revisada_por → auth.users con ON DELETE SET NULL: borrar un
--  usuario no borra solicitudes (a diferencia del user_id … cascade de otras
--  tablas, deuda anotada en CLAUDE.md).
-- ----------------------------------------------------------------
create table public.solicitudes (
  id                   uuid primary key default gen_random_uuid(),
  negocio_id           uuid not null references public.negocios(id) on delete cascade,
  telefono             text not null check (telefono ~ '^573[0-9]{9}$'),
  nombre_referencia    text check (nombre_referencia is null or char_length(nombre_referencia) between 1 and 80),
  token_hash           text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  estado               text not null default 'enviada'
                         check (estado in ('enviada', 'completada', 'anulada', 'aprobada', 'rechazada')),
  expira_en            timestamptz not null,
  creado_por           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  completada_en        timestamptz,
  -- Fase 1B (formulario del prospecto)
  datos                jsonb,
  origen               jsonb,
  fotos                jsonb,
  autorizacion_en      timestamptz,
  autorizacion_version text,
  -- Fase 1C (revisión del dueño)
  revisada_por         uuid references auth.users(id) on delete set null,
  revisada_en          timestamptz,
  cliente_id           uuid references public.clientes(id) on delete set null
);

create unique index solicitudes_una_enviada_por_celular
  on public.solicitudes (negocio_id, telefono)
  where estado = 'enviada';

create index solicitudes_negocio_fecha on public.solicitudes (negocio_id, created_at desc);

-- ----------------------------------------------------------------
--  4. RLS: solo el DUEÑO de su negocio ve y modifica sus solicitudes.
--  Sin política de INSERT (se crean solo con crear_solicitud) ni de DELETE.
--  anon: sin permisos a nivel de tabla (ni siquiera llega a la RLS).
-- ----------------------------------------------------------------
alter table public.solicitudes enable row level security;

create policy "solicitudes_dueno_select" on public.solicitudes
  for select using (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno');

create policy "solicitudes_dueno_update" on public.solicitudes
  for update using (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno')
           with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'dueno');

revoke all on public.solicitudes from anon;
revoke insert, delete, truncate, references, trigger on public.solicitudes from authenticated;

-- ----------------------------------------------------------------
--  5. crear_solicitud(celular, nombre) — solo el dueño.
--
--  - Token aleatorio de 256 bits (gen_random_bytes, CSPRNG) en base64url
--    (43 caracteres). En la tabla se guarda SOLO su sha256 en hex.
--  - expira_en = ahora + 24 horas.
--  - Anula las solicitudes ENVIADAS del mismo celular en este negocio (vencidas
--    incluidas: siguen en estado 'enviada').
--  - Devuelve el token UNA sola vez; no se puede recuperar después.
--
--  SECURITY DEFINER porque no hay política de INSERT: el negocio sale de
--  mi_negocio() (nunca del cliente) y el rol se exige aquí.
-- ----------------------------------------------------------------
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
  if v_telefono is null then
    raise exception 'El celular debe tener 10 dígitos y empezar por 3.';
  end if;
  if v_nombre is not null and char_length(v_nombre) > 80 then
    raise exception 'El nombre es muy largo (máximo 80 caracteres).';
  end if;

  -- 32 bytes aleatorios → base64url sin relleno.
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');

  -- Un solo enlace activo por celular: el anterior queda anulado.
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
