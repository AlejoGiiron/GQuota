-- ============================================================
--  019 — Tercer tipo de préstamo: 'cuota_fija'
--  El más simple: cuotas de monto fijo, sin tasa ni separación
--  capital/interés. El pago LLENA cuotas en orden y cada una guarda
--  cuánto se le ha abonado. Ver "Decisiones de arquitectura" en CLAUDE.md.
--  La lógica de cálculo vive en src/lib/motor-prestamos.ts (generarCronogramaFijo,
--  resumenCuotaFija, aplicarPagoFijo). Esta migración es SOLO esquema:
--  NO crea la RPC de crear ni la de pago (eso es Fase B).
--
--  Cambios aditivos: no altera datos existentes (abonado default 0; las
--  cuotas pactadas y los préstamos 'abierto'/'cuotas' siguen igual).
-- ============================================================

-- 1) prestamos.tipo: agregar 'cuota_fija' al check (hoy 'abierto' | 'cuotas').
alter table public.prestamos
  drop constraint if exists prestamos_tipo_check;
alter table public.prestamos
  add constraint prestamos_tipo_check
  check (tipo in ('abierto', 'cuotas', 'cuota_fija'));

-- 2) prestamos.valor_cuota: el monto fijo de cada cuota. NULLABLE: solo lo usa
--    'cuota_fija'; en 'abierto' y 'cuotas' queda null.
alter table public.prestamos
  add column if not exists valor_cuota numeric(14,2);

-- 3) cuotas.abonado: cuánto se le lleva pagado a la cuota. NOT NULL default 0.
--    Lo usa 'cuota_fija'; las cuotas pactadas no lo tocan (queda en 0).
alter table public.cuotas
  add column if not exists abonado numeric(14,2) not null default 0;

-- 4) cuotas.estado: permitir 'parcial' (cuota fija) además de los actuales.
alter table public.cuotas
  drop constraint if exists cuotas_estado_check;
alter table public.cuotas
  add constraint cuotas_estado_check
  check (estado in ('pendiente', 'parcial', 'pagada', 'vencida'));
