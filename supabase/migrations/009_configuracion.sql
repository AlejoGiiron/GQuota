-- ============================================================
--  009 — Configuración del negocio (una fila por usuario)
--  Parámetros del negocio del prestamista. Multi-tenant por user_id
--  + RLS: cada usuario ve y edita solo su fila.
-- ============================================================

create table public.configuracion (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  nombre_negocio text,
  metodos_pago   text[] not null default array['efectivo', 'nequi', 'daviplata', 'transferencia']::text[],
  created_at     timestamptz not null default now()
);

alter table public.configuracion enable row level security;

create policy "configuracion_propia" on public.configuracion
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
