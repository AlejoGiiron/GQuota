-- ============================================================
--  040 — Regla de mora 2: un préstamo nuevo ya no cae en mora sin deberlo.
--
--  Error (reportado por Luis, 2026-09-25): marcar_mora() usaba para TODOS los
--  tipos la regla mensual del préstamo abierto (día del desembolso en el mes
--  actual, sin pago desde entonces → mora), sin mirar cuándo empezó el préstamo:
--    - un abierto o de cuota fija recién creado caía en mora desde el día
--      siguiente hasta fin de mes, aunque su primer cobro fuera el mes siguiente;
--    - la cuota fija se marcaba siempre con esa regla mensual, no por sus cuotas
--      (marcar_cuotas_vencidas solo recalculaba el tipo 'cuotas').
--
--  Regla 2 (prestamos.regla_mora = 2):
--    - abierto: el cobro del mes cuenta solo si es POSTERIOR al desembolso (el
--      primer cobro es el mes siguiente). Lo demás, igual.
--    - cuotas y cuota fija: su estado sale de sus cuotas (vencida = más de 5 días
--      de atraso; en cuota fija también una 'parcial' con más de 5 días), no de la
--      regla mensual.
--
--  SOLO préstamos nuevos: los que existen quedan en regla 1 y se calculan
--  EXACTAMENTE igual que antes (se prueba en el ensayo). Los nuevos nacen en
--  regla 2 por el valor por defecto de la columna: las 8 RPC no cambian. Pasar un
--  préstamo existente a regla 2 es una corrección aparte, con aprobación.
-- ============================================================

alter table public.prestamos
  add column regla_mora smallint not null default 1 check (regla_mora in (1, 2));
-- Los que existen quedaron en 1; los que se creen desde ahora, en 2.
alter table public.prestamos alter column regla_mora set default 2;

-- ── marcar_mora: la regla mensual, ahora solo para regla 1 y para el abierto de regla 2 ──
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
             case when q.cobro < current_date and not q.pagado
                       -- Regla 2: el ciclo del mes cuenta solo si empezó después del desembolso.
                       and (q.regla_mora = 1 or q.cobro > q.fecha_desembolso)
                  then 'en_mora' else 'activo' end as nuevo
        from (
          select base.id,
                 base.cobro,
                 base.regla_mora,
                 base.fecha_desembolso,
                 exists (
                   select 1
                     from public.movimientos m
                    where m.prestamo_id = base.id
                      and m.tipo in ('interes', 'cuota')
                      and m.fecha >= base.cobro
                 ) as pagado
            from (
              select p3.id,
                     p3.regla_mora,
                     p3.fecha_desembolso,
                     make_date(
                       extract(year from current_date)::int,
                       extract(month from current_date)::int,
                       least(coalesce(p3.dia_cobro, extract(day from p3.fecha_desembolso)::int), v_dim)
                     ) as cobro
                from public.prestamos p3
               where p3.estado in ('activo', 'en_mora')
                 -- Regla 2: cuotas y cuota fija se marcan por sus cuotas, no por esta regla.
                 and (p3.regla_mora = 1 or p3.tipo = 'abierto')
            ) base
        ) q
    ) sub
   where p.id = sub.id
     and p.estado <> sub.nuevo;

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;

-- ── marcar_cuotas_vencidas: además, la cuota fija de regla 2 ──
create or replace function public.marcar_cuotas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  -- Cuotas con +5 días de atraso pasan a 'vencida' (solo desde 'pendiente'). Sin cambios.
  update public.cuotas
     set estado = 'vencida'
   where estado = 'pendiente'
     and current_date > fecha_vence + 5;

  -- Estado del préstamo según sus cuotas. Solo escribe cuando cambia (idempotente).
  --   'cuotas' (regla 1 y 2): en_mora si tiene alguna cuota vencida. Como antes.
  --   'cuota_fija' de regla 2: en_mora si tiene una vencida o una 'parcial' con más
  --   de 5 días de atraso. La de regla 1 no se toca aquí (como antes).
  update public.prestamos p
     set estado = x.nuevo
    from (
      select p2.id,
             case
               when exists (select 1 from public.cuotas c
                             where c.prestamo_id = p2.id
                               and (c.estado = 'vencida'
                                    or (p2.tipo = 'cuota_fija' and c.estado = 'parcial' and current_date > c.fecha_vence + 5)))
               then 'en_mora' else 'activo'
             end as nuevo
        from public.prestamos p2
       where p2.estado in ('activo', 'en_mora')
         and (p2.tipo = 'cuotas' or (p2.tipo = 'cuota_fija' and p2.regla_mora = 2))
    ) x
   where p.id = x.id
     and p.estado <> x.nuevo;

  get diagnostics v_afectados = row_count; -- préstamos cuyo estado cambió
  return v_afectados;
end;
$$;

-- Mantenimiento: solo pg_cron (como postgres). Se reafirma (create or replace conserva los permisos).
revoke execute on function public.marcar_mora() from public, anon, authenticated;
revoke execute on function public.marcar_cuotas_vencidas() from public, anon, authenticated;
