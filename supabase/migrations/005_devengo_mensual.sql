-- ============================================================
--  005 — Devengo mensual del interés
--  Agrega prestamos.ultimo_devengo y la función devengar_intereses().
--
--  REFERENCIA DE LA FÓRMULA: src/lib/motor-prestamos.ts
--  (interesDelPeriodo / devengarPeriodo). Esta función replica esa
--  misma lógica en SQL para poder correr en la base (pg_cron). Si la
--  fórmula cambia en el motor, actualizar también aquí. NO capitaliza:
--  el interés se acumula en interes_pendiente, nunca al capital.
-- ============================================================

alter table public.prestamos
  add column ultimo_devengo date;

-- Devenga el interés del mes en curso a TODOS los préstamos activos que
-- aún no se han devengado este mes. Idempotente: correrla otra vez el
-- mismo mes no vuelve a sumar (filtra por ultimo_devengo).
-- SECURITY DEFINER: es mantenimiento del sistema (la corre pg_cron o un
-- admin desde el SQL editor), procesa todos los usuarios. No se expone a
-- los roles de la app.
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
   where estado = 'activo'
     and (ultimo_devengo is null or ultimo_devengo < v_periodo);

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;
