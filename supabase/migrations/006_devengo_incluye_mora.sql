-- ============================================================
--  006 — Devengo: incluir préstamos en mora
--  Reemplaza public.devengar_intereses() (definida en 005) para que
--  procese también los préstamos en mora: un préstamo en mora sigue
--  generando interés. Sigue ignorando 'pagado' y 'cancelado'.
--  Sin cambios en la idempotencia (ultimo_devengo < primer día del mes)
--  ni en el cálculo por modo.
--
--  REFERENCIA DE LA FÓRMULA: src/lib/motor-prestamos.ts
--  (interesDelPeriodo / devengarPeriodo). NO capitaliza.
-- ============================================================

create or replace function public.devengar_intereses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periodo   date := date_trunc('month', current_date)::date;
  v_afectados integer;
begin
  update public.prestamos
     set interes_pendiente = round(
           interes_pendiente
           + case when modo_interes = 'sobre_saldo'
                  then saldo_capital * tasa_mensual          -- interés sobre el saldo vigente
                  else capital_inicial * tasa_mensual        -- interés fijo sobre el capital inicial
             end, 2),
         ultimo_devengo = v_periodo
   where estado in ('activo', 'en_mora')
     and (ultimo_devengo is null or ultimo_devengo < v_periodo);

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;
