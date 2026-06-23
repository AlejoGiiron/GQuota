-- ============================================================
--  031 — Miembros inactivos (Fase 4B+): reactivar cobradores
--
--  Hasta ahora "quitar" un cobrador borraba su fila en `miembros` y baneaba su
--  cuenta. Eso hacía la salida PERMANENTE: re-agregar el mismo email quedaba
--  bloqueado (la cuenta de Auth sigue existiendo con ese correo). Para poder
--  REACTIVAR a un ex-cobrador sin crear cuenta nueva ni perder su historial, se
--  conserva la fila y se marca inactiva.
--
--  Modelo:
--    - miembros.activo boolean (default true). "quitar" = activo=false + banear.
--      "reactivar" = activo=true + des-banear (lo hace la Edge Function).
--    - mi_negocio()/mi_rol() pasan a exigir activo=true: un miembro inactivo NO
--      pertenece a ningún negocio activo, así que NO ve ni puede nada (igual que
--      cuando se le borraba la fila). La frontera por negocio_id no cambia para
--      los miembros activos: para ellos estas funciones devuelven lo mismo.
-- ============================================================

alter table public.miembros add column activo boolean not null default true;

-- Útil para listar/contar por negocio distinguiendo activos.
create index on public.miembros (negocio_id, activo);

-- ----------------------------------------------------------------
--  mi_negocio() — ahora solo cuenta la membresía ACTIVA.
--  Se mantiene SECURITY DEFINER + STABLE + search_path (igual que la 022); solo
--  cambia el cuerpo. create or replace conserva los privilegios; se re-asierta
--  el revoke/grant por disciplina (idempotente).
-- ----------------------------------------------------------------
create or replace function public.mi_negocio()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select negocio_id from public.miembros
   where user_id = auth.uid() and activo
   limit 1;
$$;

revoke execute on function public.mi_negocio() from public;
grant execute on function public.mi_negocio() to authenticated;

-- ----------------------------------------------------------------
--  mi_rol() — gemela: solo el rol de la membresía ACTIVA.
-- ----------------------------------------------------------------
create or replace function public.mi_rol()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.miembros
   where user_id = auth.uid() and activo
   limit 1;
$$;

revoke execute on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;
