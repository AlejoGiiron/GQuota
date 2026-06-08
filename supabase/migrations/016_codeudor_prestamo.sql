-- ============================================================
--  016 — Codeudor opcional en el préstamo
--  Tres columnas NULLABLE en prestamos: un préstamo puede no tener
--  codeudor (es opcional). Son datos sueltos del préstamo, NO una
--  entidad/cliente. No tocan cálculos, motor, devengo ni pagos.
--  RLS sin cambios: viven en la misma fila del préstamo, ya protegida
--  por user_id.
-- ============================================================

alter table public.prestamos
  add column if not exists codeudor_nombre    text,
  add column if not exists codeudor_telefono  text,
  add column if not exists codeudor_documento text;
