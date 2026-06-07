-- ============================================================
--  014 — Mora por cuota
--  Marca como 'vencida' las cuotas con más de 5 días de atraso y pone el
--  préstamo de cuotas en 'en_mora'; si ya no le quedan cuotas vencidas,
--  vuelve a 'activo' (mismo criterio de ida y vuelta que marcar_mora).
--  Sin recargo todavía (queda el espacio para agregarlo).
--  SECURITY DEFINER: mantenimiento (pg_cron o admin). Idempotente.
-- ============================================================

create or replace function public.marcar_cuotas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  -- Cuotas con +5 días de atraso pasan a 'vencida' (solo desde 'pendiente').
  update public.cuotas
     set estado = 'vencida'
   where estado = 'pendiente'
     and current_date > fecha_vence + 5;

  -- Préstamos de cuotas: en_mora si tienen alguna cuota vencida; si no, activo.
  -- Solo escribe cuando el estado cambia (idempotente).
  update public.prestamos p
     set estado = case
                    when exists (select 1 from public.cuotas c
                                  where c.prestamo_id = p.id and c.estado = 'vencida')
                    then 'en_mora' else 'activo'
                  end
   where p.tipo = 'cuotas'
     and p.estado in ('activo', 'en_mora')
     and p.estado <> case
                       when exists (select 1 from public.cuotas c
                                     where c.prestamo_id = p.id and c.estado = 'vencida')
                       then 'en_mora' else 'activo'
                     end;

  get diagnostics v_afectados = row_count; -- préstamos cuyo estado cambió
  return v_afectados;
end;
$$;

revoke execute on function public.marcar_cuotas_vencidas() from public, anon, authenticated;
