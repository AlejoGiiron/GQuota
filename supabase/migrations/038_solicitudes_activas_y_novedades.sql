-- ============================================================
--  038 — Solicitudes solo en los negocios que las activen, y guía de novedades.
--
--  1. negocios.solicitudes_activas: la ficha por enlace (fase 1) queda apagada en
--     todos los negocios que existen, menos LAB (pruebas de la 1B y la 1C). Regla
--     del CLAUDE.md: lo nuevo solo aplica a los negocios que lo activen.
--  2. crear_solicitud exige la función activa (la Edge Function ficha-publica
--     también: con la función apagada, un enlace responde "no disponible").
--  3. novedades_usuario: qué guía de novedades le falta ver a cada usuario. Se
--     registra en la base (no en el navegador) para que no se repita en otro
--     celular. La versión 'diseno-2a' queda pendiente para todos los usuarios que
--     existen hoy; quien se cree después no tiene fila y no la ve.
--
--  NO cambia: préstamos, pagos, cuotas, clientes, miembros, las 8 RPC ni el cron.
-- ============================================================

-- ── 1. Interruptor por negocio ────────────────────────────────
alter table public.negocios
  add column solicitudes_activas boolean not null default false;

-- LAB - Negocio Prueba.
update public.negocios
   set solicitudes_activas = true
 where id = '00a381b0-1c7b-42d7-b265-0e569aba6a69';

-- ── 2. crear_solicitud exige la función activa ────────────────
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
  if not exists (select 1 from public.negocios n where n.id = v_negocio and n.solicitudes_activas) then
    raise exception 'Las solicitudes por enlace no están activas en este negocio.';
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

-- ── 3. Guía de novedades ──────────────────────────────────────
create table public.novedades_usuario (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  version       text        not null check (char_length(version) between 1 and 40),
  estado        text        not null default 'pendiente' check (estado in ('pendiente', 'vista')),
  -- "Ver después" la corre a mañana; la guía sale sola cuando llega esta fecha.
  mostrar_desde timestamptz not null default now(),
  primary key (user_id, version)
);

alter table public.novedades_usuario enable row level security;

-- Cada usuario lee y actualiza solo lo suyo, y solo el estado y la fecha. Las
-- filas las crea la migración de cada versión: la app no inserta ni borra.
revoke all on table public.novedades_usuario from public, anon, authenticated;
grant select on table public.novedades_usuario to authenticated;
grant update (estado, mostrar_desde) on table public.novedades_usuario to authenticated;

create policy novedades_usuario_select on public.novedades_usuario
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy novedades_usuario_update on public.novedades_usuario
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Versión 'diseno-2a' (sistema de diseño 2a): pendiente para todos los de hoy.
insert into public.novedades_usuario (user_id, version)
select u.id, 'diseno-2a'
  from auth.users u
on conflict do nothing;
