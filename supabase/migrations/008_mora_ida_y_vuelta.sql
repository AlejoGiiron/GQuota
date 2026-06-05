-- ============================================================
--  008 — marcar_mora() ida y vuelta
--  Reemplaza public.marcar_mora() (definida en 007) para que también
--  devuelva a 'activo' los préstamos 'en_mora' que ya se pusieron al día
--  (su cobro del ciclo vigente está cubierto o aún no ha vencido).
--
--  MISMO CRITERIO de "vencido" que src/lib/cartera.ts (calcularVencidos):
--  día de cobro = dia_cobro o el día del desembolso, acotado al mes;
--  vencido si esa fecha de este mes < hoy y NO hay pago (interes/cuota)
--  con fecha >= la de cobro.
--    vencido  -> 'en_mora'
--    al día   -> 'activo'
--  No toca 'pagado' ni 'cancelado'. Solo escribe cuando el estado cambia,
--  así correrla dos veces no afecta nada (idempotente).
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
     set estado = sub.nuevo
    from (
      select q.id,
             case when q.cobro < current_date and not q.pagado then 'en_mora' else 'activo' end as nuevo
        from (
          select base.id,
                 base.cobro,
                 exists (
                   select 1
                     from public.movimientos m
                    where m.prestamo_id = base.id
                      and m.tipo in ('interes', 'cuota')
                      and m.fecha >= base.cobro
                 ) as pagado
            from (
              select p3.id,
                     make_date(
                       extract(year from current_date)::int,
                       extract(month from current_date)::int,
                       least(coalesce(p3.dia_cobro, extract(day from p3.fecha_desembolso)::int), v_dim)
                     ) as cobro
                from public.prestamos p3
               where p3.estado in ('activo', 'en_mora')
            ) base
        ) q
    ) sub
   where p.id = sub.id
     and p.estado <> sub.nuevo;

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;
