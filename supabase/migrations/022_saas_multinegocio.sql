-- ============================================================
--  022 — Estructura SaaS multi-negocio (Fase 1A)
--  Migra el modelo de "datos por user_id" a "datos por negocio".
--
--  Modelo SIMPLE:
--    - Un usuario pertenece a UN solo negocio (tabla miembros, UNIQUE user_id).
--    - En esta fase todos los miembros son rol 'dueno' (el rol 'cobrador'
--      llega en la Fase 2).
--    - Sin negocio asignado (sin fila en miembros), el usuario NO ve ninguna
--      fila: seguro por defecto.
--
--  ESTA MIGRACIÓN: solo estructura + migración de datos + RLS por negocio.
--  Las RPC (crear_prestamo*, registrar_pago*, devengo, moras) NO se tocan
--  aquí; siguen fijando user_id = auth.uid() y operan igual. Se ajustan en
--  la Fase 1B. La frontera entre negocios queda garantizada por la RLS.
--
--  ORDEN INTERNO (cada paso asume el anterior):
--    1. tabla negocios
--    2. tabla miembros
--    3. negocio_id nullable en clientes/prestamos/cuotas/movimientos
--    4. migración de datos (un negocio por usuario existente)
--    5. negocio_id NOT NULL
--    6. helper mi_negocio() (SECURITY DEFINER, evita recursión en políticas)
--    7. reescritura de RLS por negocio
--    8. RLS de negocios y miembros
-- ============================================================

-- ----------------------------------------------------------------
--  1. NEGOCIOS — la unidad de tenencia de los datos.
--     Aquí se mudan el nombre y los métodos de pago que antes vivían
--     en `configuracion` (una fila por usuario).
-- ----------------------------------------------------------------
create table public.negocios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  metodos_pago text[] not null
               default array['efectivo', 'nequi', 'daviplata', 'transferencia']::text[],
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
--  2. MIEMBROS — vínculo usuario <-> negocio.
--     UNIQUE(user_id): un usuario pertenece a UN solo negocio.
--     rol: 'dueno' (esta fase) | 'cobrador' (Fase 2).
-- ----------------------------------------------------------------
create table public.miembros (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  rol        text not null default 'dueno' check (rol in ('dueno', 'cobrador')),
  created_at timestamptz not null default now()
);
create index on public.miembros (negocio_id);

-- ----------------------------------------------------------------
--  3. negocio_id en las tablas de datos. NULLABLE por ahora: se puebla
--     en el paso 4 y recién entonces se vuelve NOT NULL (paso 5).
-- ----------------------------------------------------------------
alter table public.clientes    add column negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.prestamos   add column negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.cuotas      add column negocio_id uuid references public.negocios(id) on delete cascade;
alter table public.movimientos add column negocio_id uuid references public.negocios(id) on delete cascade;

-- ----------------------------------------------------------------
--  4. MIGRACIÓN DE DATOS.
--     Para cada usuario que hoy posee datos (o tiene configuración),
--     se crea UN negocio, se le inscribe como 'dueno' y se le asigna
--     negocio_id a todas sus filas. Hoy hay un solo usuario real, así
--     que esto produce un negocio con todo lo existente; el bucle deja
--     la migración correcta aunque hubiera más de uno.
-- ----------------------------------------------------------------
do $$
declare
  v_user    uuid;
  v_neg     uuid;
  v_nombre  text;
  v_metodos text[];
begin
  for v_user in
    select uid from (
      select user_id as uid from public.clientes
      union select user_id from public.prestamos
      union select user_id from public.cuotas
      union select user_id from public.movimientos
      union select user_id from public.configuracion
    ) s
    where uid is not null
  loop
    select nombre_negocio, metodos_pago
      into v_nombre, v_metodos
      from public.configuracion
     where user_id = v_user;

    insert into public.negocios (nombre, metodos_pago)
    values (
      coalesce(nullif(btrim(v_nombre), ''), 'Mi negocio'),
      coalesce(v_metodos, array['efectivo', 'nequi', 'daviplata', 'transferencia']::text[])
    )
    returning id into v_neg;

    insert into public.miembros (negocio_id, user_id, rol)
    values (v_neg, v_user, 'dueno');

    update public.clientes    set negocio_id = v_neg where user_id = v_user;
    update public.prestamos   set negocio_id = v_neg where user_id = v_user;
    update public.cuotas      set negocio_id = v_neg where user_id = v_user;
    update public.movimientos set negocio_id = v_neg where user_id = v_user;
  end loop;
end $$;

-- ----------------------------------------------------------------
--  5. Ya pobladas todas las filas, negocio_id pasa a NOT NULL.
-- ----------------------------------------------------------------
alter table public.clientes    alter column negocio_id set not null;
alter table public.prestamos   alter column negocio_id set not null;
alter table public.cuotas      alter column negocio_id set not null;
alter table public.movimientos alter column negocio_id set not null;

create index on public.clientes    (negocio_id);
create index on public.prestamos   (negocio_id);
create index on public.cuotas      (negocio_id);
create index on public.movimientos (negocio_id);

-- ----------------------------------------------------------------
--  6. HELPER mi_negocio() — negocio del usuario autenticado.
--
--     SECURITY DEFINER a propósito: las políticas RLS de las tablas de
--     datos llaman a esta función, y la función a su vez lee `miembros`.
--     Si fuera SECURITY INVOKER, leer `miembros` aplicaría la RLS de
--     `miembros`, que podría a su vez consultar... → recursión. Al correr
--     como definer la lectura de `miembros` NO dispara RLS, rompiendo el
--     ciclo. Es el patrón recomendado por Supabase para este caso.
--     STABLE: el resultado no cambia dentro de una misma sentencia.
-- ----------------------------------------------------------------
create or replace function public.mi_negocio()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select negocio_id from public.miembros where user_id = auth.uid() limit 1;
$$;

-- Se usa dentro de las políticas RLS: el rol que consulta necesita EXECUTE.
revoke execute on function public.mi_negocio() from public;
grant execute on function public.mi_negocio() to authenticated;

-- ----------------------------------------------------------------
--  7. RLS por NEGOCIO en las tablas de datos.
--     Reemplaza las políticas "*_propia/_propios" por user_id. Una fila es
--     visible/editable si su negocio_id = mi_negocio(). Si mi_negocio() es
--     null (usuario sin negocio), `negocio_id = null` es NULL → nada visible.
-- ----------------------------------------------------------------
drop policy "clientes_propios"    on public.clientes;
drop policy "prestamos_propios"   on public.prestamos;
drop policy "movimientos_propios" on public.movimientos;
drop policy "cuotas_propias"      on public.cuotas;

create policy "clientes_negocio" on public.clientes
  for all using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy "prestamos_negocio" on public.prestamos
  for all using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy "movimientos_negocio" on public.movimientos
  for all using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy "cuotas_negocio" on public.cuotas
  for all using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

-- ----------------------------------------------------------------
--  8. RLS de negocios y miembros.
--     - negocios: el miembro ve y edita SU negocio (nombre, métodos).
--     - miembros: cada quien ve su propia fila de membresía.
--     No se exponen INSERT/DELETE por ahora (la creación de negocios y el
--     alta de miembros llega en el flujo de onboarding / Fase 1B).
-- ----------------------------------------------------------------
alter table public.negocios enable row level security;
alter table public.miembros enable row level security;

create policy "negocios_miembro_select" on public.negocios
  for select using (id = public.mi_negocio());

create policy "negocios_miembro_update" on public.negocios
  for update using (id = public.mi_negocio()) with check (id = public.mi_negocio());

create policy "miembros_propio_select" on public.miembros
  for select using (user_id = auth.uid());
