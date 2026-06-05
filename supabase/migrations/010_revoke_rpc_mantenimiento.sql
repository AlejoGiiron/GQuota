-- ============================================================
--  010 — Hardening: cerrar las RPC de mantenimiento
--  devengar_intereses() y marcar_mora() son SECURITY DEFINER y solo
--  deben correr por pg_cron (rol postgres) o por un admin desde el SQL
--  editor. Por defecto Postgres concede EXECUTE a PUBLIC, lo que las
--  expondría vía PostgREST a anon/authenticated. Revocamos ese acceso.
--  pg_cron corre como postgres (dueño de la función), así que los jobs
--  programados siguen funcionando.
-- ============================================================

revoke execute on function public.devengar_intereses() from public, anon, authenticated;
revoke execute on function public.marcar_mora()        from public, anon, authenticated;
