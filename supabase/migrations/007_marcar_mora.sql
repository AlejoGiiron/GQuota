-- ============================================================
--  007 — Transición a 'en_mora'
--  Marca como 'en_mora' los préstamos 'activo' cuya fecha de cobro
--  del mes ya venció sin pago en el ciclo.
--
--  MISMO CRITERIO de "vencido" que src/lib/cartera.ts (calcularVencidos):
--  día de cobro = dia_cobro o el día del desembolso, acotado al mes;
--  vencido si esa fecha de este mes < hoy y NO hay pago (interes/cuota)
--  con fecha >= la de cobro. Si cambia allá, cambiar aquí.
--
--  Idempotente: solo toca estado 'activo'; correrla de nuevo no afecta a
--  los que ya están en mora. SECURITY DEFINER: mantenimiento del sistema
--  (pg_cron o admin), procesa todos los usuarios; no se expone a la app.
-- ============================================================

create or replace function public.marcar_mora()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
  v_dim       integer := extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day'))::int;
begin
  update public.prestamos p
     set estado = 'en_mora'
   where p.estado = 'activo'
     and make_date(
           extract(year from current_date)::int,
           extract(month from current_date)::int,
           least(coalesce(p.dia_cobro, extract(day from p.fecha_desembolso)::int), v_dim)
         ) < current_date
     and not exists (
       select 1
         from public.movimientos m
        where m.prestamo_id = p.id
          and m.tipo in ('interes', 'cuota')
          and m.fecha >= make_date(
                extract(year from current_date)::int,
                extract(month from current_date)::int,
                least(coalesce(p.dia_cobro, extract(day from p.fecha_desembolso)::int), v_dim)
              )
     );

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;
