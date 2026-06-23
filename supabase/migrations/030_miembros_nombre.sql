-- ============================================================
--  030 — Nombre del miembro (Fase 4A: crear cobradores)
--
--  Para identificar a cada cobrador en la lista de gestión (Fase 4B) y en la
--  UI, `miembros` necesita un nombre legible. NULLABLE a propósito: los
--  miembros existentes (el dueño actual, Luis) quedan con nombre null sin
--  romper nada; el alta de cobradores (Edge Function crear-cobrador) lo llena.
--
--  No toca RLS: `miembros_propio_select` (022) sigue dejando ver solo la fila
--  propia. La Edge Function escribe la fila con la service_role (bypassa RLS),
--  así que no hace falta una política de INSERT para miembros aquí.
-- ============================================================

alter table public.miembros add column nombre text;
