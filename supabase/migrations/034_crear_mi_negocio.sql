-- ============================================================
--  034 — Registro self-service: crear_mi_negocio(nombre) (Fase 5)
--
--  Un prestamista nuevo se registra solo (signUp en Auth) y queda como DUEÑO de
--  un negocio nuevo y VACÍO. El problema: `negocios` y `miembros` tienen RLS
--  activa SIN política INSERT para usuarios normales (022, a propósito). Un
--  usuario recién logueado no puede insertar su negocio ni su membresía por
--  PostgREST directo.
--
--  Solución (Opción A, la más explícita y controlable): una RPC SECURITY DEFINER
--  que el usuario YA autenticado llama. Como definer corre con el rol dueño de la
--  función (bypassa RLS), así que puede crear el negocio y la membresía sin abrir
--  un INSERT público en esas tablas. ATÓMICA: negocio + miembro en una sola
--  transacción (la RPC es una sentencia); si algo falla, no queda nada a medias.
--
--  GUARD — un usuario, un negocio:
--    - Sesión activa (auth.uid() no nulo).
--    - Nombre del negocio no vacío.
--    - El usuario NO debe tener ya una fila en `miembros` (de NINGÚN negocio,
--      activa o inactiva). Refuerzo: miembros.user_id es UNIQUE (022), así que un
--      segundo intento (incluida una carrera de doble submit) rompe la unicidad y
--      la transacción entera revierte -> nunca dos negocios para el mismo usuario.
--
--  Recuperación ante fallo a mitad del registro: si el signUp quedó OK pero esta
--  RPC falló, el usuario queda autenticado SIN negocio. La app lo lleva a una
--  pantalla "crea tu negocio" que vuelve a llamar esta RPC; es idempotente en el
--  sentido de que solo crea si aún no hay membresía, así que reintentar es seguro.
-- ============================================================

create or replace function public.crear_mi_negocio(p_nombre text)
returns public.negocios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_nombre  text := nullif(btrim(p_nombre), '');
  v_negocio public.negocios;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_nombre is null then
    raise exception 'El nombre del negocio es obligatorio.';
  end if;
  -- Un usuario, un negocio: si ya es miembro de alguno (activo o no), no crea otro.
  if exists (select 1 from public.miembros where user_id = v_user) then
    raise exception 'Ya perteneces a un negocio.';
  end if;

  insert into public.negocios (nombre)
  values (v_nombre)
  returning * into v_negocio;

  -- Dueño del negocio recién creado. nombre = null: del dueño solo capturamos el
  -- nombre del NEGOCIO en el registro; su identidad visible es el email.
  insert into public.miembros (negocio_id, user_id, rol)
  values (v_negocio.id, v_user, 'dueno');

  return v_negocio;
exception
  -- Carrera de doble submit: el segundo insert en miembros viola el UNIQUE de
  -- user_id. Se traduce al mismo mensaje del guard (la transacción ya revirtió,
  -- así que no quedó un negocio huérfano del segundo intento).
  when unique_violation then
    raise exception 'Ya perteneces a un negocio.';
end;
$$;

-- Solo un usuario autenticado crea su propio negocio (anon no).
revoke execute on function public.crear_mi_negocio(text) from public, anon;
grant execute on function public.crear_mi_negocio(text) to authenticated;
