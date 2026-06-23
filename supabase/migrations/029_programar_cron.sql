-- ============================================================
--  029 — Programar los cron de mantenimiento (pg_cron)
--  Programa las tres funciones de mantenimiento, todas idempotentes y
--  SECURITY DEFINER (ver 006/008/014); corren globales sin auth.uid().
--
--    devengar_intereses      08:00 UTC = 03:00 COT   diario
--    marcar_mora             08:10 UTC = 03:10 COT   diario
--    marcar_cuotas_vencidas  08:15 UTC = 03:15 COT   diario
--
--  pg_cron corre en UTC; Colombia es UTC-5, así que estos horarios caen
--  de madrugada en Colombia. El DEVENGO va primero (antes que las moras),
--  con minutos de separación, según el orden acordado.
--
--  Cadencia diaria (no mensual) a propósito: devengar_intereses está
--  anclada al mes calendario (ultimo_devengo < primer día del mes) y es
--  idempotente, así que correrla a diario solo actúa una vez por mes y se
--  auto-corrige si un día falla el cron. marcar_mora y marcar_cuotas_vencidas
--  también son idempotentes.
--
--  Idempotente: cron.schedule(nombre, ...) hace upsert por nombre; reaplicar
--  esta migración reemplaza el job, no lo duplica.
-- ============================================================

create extension if not exists pg_cron;

-- Devengo de intereses (mes calendario; idempotente → diario).
select cron.schedule(
  'devengar_intereses_diario',
  '0 8 * * *',
  $$select public.devengar_intereses();$$
);

-- Mora del producto "abierto" por fecha de cobro (idempotente → diario).
select cron.schedule(
  'marcar_mora_diario',
  '10 8 * * *',
  $$select public.marcar_mora();$$
);

-- Mora por cuota vencida (+5 días de gracia; idempotente → diario).
select cron.schedule(
  'marcar_cuotas_vencidas_diario',
  '15 8 * * *',
  $$select public.marcar_cuotas_vencidas();$$
);
