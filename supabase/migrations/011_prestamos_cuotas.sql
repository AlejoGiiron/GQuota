-- ============================================================
--  011 — Préstamos por cuotas
--  Agrega el tipo de préstamo y la tabla del cronograma de cuotas.
--  Ver "Decisiones de arquitectura — Modelo de préstamos por cuotas"
--  en CLAUDE.md. La lógica de la fórmula vive en src/lib/motor-prestamos.ts.
--  Esta migración es solo esquema (no crea cronogramas ni registra pagos).
-- ============================================================

-- Tipo de préstamo: 'abierto' (el modelo actual) | 'cuotas' (nuevo).
-- Default 'abierto' para no alterar los préstamos existentes.
alter table public.prestamos
  add column tipo text not null default 'abierto'
  check (tipo in ('abierto', 'cuotas'));

-- Cronograma de cuotas pactadas (solo para préstamos tipo 'cuotas').
-- capital e interés van por separado; monto de la cuota = capital + interes.
create table public.cuotas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  prestamo_id uuid not null references public.prestamos(id) on delete cascade,
  numero      int not null,
  fecha_vence date not null,
  capital     numeric(14,2) not null,
  interes     numeric(14,2) not null,
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'pagada', 'vencida')),
  created_at  timestamptz not null default now()
);
create index on public.cuotas (prestamo_id);

-- RLS por usuario, mismo patrón que las demás tablas.
alter table public.cuotas enable row level security;

create policy "cuotas_propias" on public.cuotas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
