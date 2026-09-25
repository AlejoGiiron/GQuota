-- ============================================================
--  RESTAURACIÓN: marcar_mora() y marcar_cuotas_vencidas() como estaban ANTES de la 041.
--
--  Copia EXACTA de la base (pg_get_functiondef), tomada el 2026-09-25 justo antes de
--  aplicar la migración 041. Es la versión de la migración 040 (regla de mora 2 con la
--  fecha UTC). md5(pg_get_functiondef):
--    marcar_mora             40017cbfa53b79ea95df78d3456c9565
--    marcar_cuotas_vencidas  536edb13c6f25d52ec405ba4eccd48de
--  Permisos de entonces: solo postgres (pg_cron) y service_role.
--
--  NO es una migración: no está en supabase/migrations y no se aplica sola.
--  Cómo restaurar (solo con aprobación): correr este archivo completo contra la base,
--  p. ej. npx supabase db query --linked --file supabase/restauracion/antes-041_funciones-mora.sql
--  Deja la regla de mora como en la 040; lo demás de la 041 (columnas nuevas, funciones
--  *_para y crear_prestamo_existente) puede quedarse: nada de lo restaurado lo usa.
--  Ojo: un préstamo existente de regla 2 con interes_pagado_hasta perdería esa guarda
--  en la mora (volvería a contar el cobro del mes ya pagado antes de la app).
-- ============================================================

begin;

CREATE OR REPLACE FUNCTION public.marcar_mora()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.marcar_cuotas_vencidas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

revoke execute on function public.marcar_mora() from public, anon, authenticated;
revoke execute on function public.marcar_cuotas_vencidas() from public, anon, authenticated;

commit;
