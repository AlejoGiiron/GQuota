-- ============================================================
--  003 — interes_pendiente en prestamos
--  Interés devengado y aún no pagado. El motor (aplicarPago) lo
--  consume primero; un pago cubre el interés pendiente y el resto
--  abona a capital. No capitaliza.
-- ============================================================

alter table public.prestamos
  add column interes_pendiente numeric(14,2) not null default 0;
