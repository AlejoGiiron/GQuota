-- ============================================================
--  041 — "Préstamo existente" (Fase 2) y fecha de Colombia en la regla de mora 2.
--
--  1) Préstamo existente: un préstamo que ya venía pagándose antes de la app se
--     carga con lo que ya pagó, SIN que esos pagos entren en la caja de hoy ni en
--     la ganancia del mes. RPC nueva crear_prestamo_existente:
--       - crea el préstamo con la RPC de siempre (el desembolso queda con su
--         fecha real, como siempre);
--       - cuotas y cuota fija: registra lo ya pagado con las RPC de pago de
--         siempre (misma lógica) y borra en la misma transacción los movimientos
--         que esas RPC crean: son lo único que dejan con fecha de hoy (no hay
--         columnas de "fecha de pago" ni triggers). Las cuotas pagadas quedan
--         marcadas pagada_antes;
--       - abierto: fija el saldo de capital de hoy, el último cobro de intereses
--         pagado (interes_pagado_hasta) y el interés pendiente con la regla del
--         devengo mensual, como si esos pagos se hubieran registrado en la app.
--     Nace en regla de mora 2 (valor por defecto) y su estado se calcula al crearlo.
--
--  2) Regla de mora 2 con la fecha de Colombia: la BD usa la fecha UTC (después
--     de las 7 p. m. ya es "mañana"). marcar_mora() y marcar_cuotas_vencidas()
--     pasan a llamar a funciones internas que reciben la fecha:
--       - regla 1: la fecha UTC de siempre → EXACTAMENTE igual que antes;
--       - regla 2: la fecha de America/Bogota.
--     A la hora del cron (3:10 y 3:15 a. m.) las dos fechas son la misma.
--     El abierto de regla 2 además no cuenta el cobro del mes si ya estaba
--     pagado antes de la app (cobro <= interes_pagado_hasta).
--
--  Solo se AGREGA: columnas vacías por defecto; los préstamos que existen no
--  cambian. Las 8 RPC de siempre no cambian.
-- ============================================================

-- ── Datos nuevos ──
alter table public.prestamos
  add column pagado_antes         numeric,
  add column cuotas_pagadas_antes integer,
  add column interes_pagado_hasta date;

comment on column public.prestamos.pagado_antes is
  'Préstamo existente: lo pagado antes de la app. Cuotas y cuota fija: total pagado; abierto: capital abonado. Vacío en los demás.';
comment on column public.prestamos.cuotas_pagadas_antes is
  'Préstamo existente: cuotas pagadas antes de la app (en el abierto, cobros de interés pagados). Vacío en los demás.';
comment on column public.prestamos.interes_pagado_hasta is
  'Préstamo existente abierto: fecha del último cobro de intereses pagado antes de la app. Vacío en los demás.';

alter table public.cuotas
  add column pagada_antes boolean not null default false;

comment on column public.cuotas.pagada_antes is
  'La cuota se pagó antes de registrar el préstamo en la app (préstamo existente).';

-- ── marcar_mora con la fecha como parámetro ──
-- Misma consulta de la 040. Cambios: la fecha de "hoy" depende de la regla
-- (regla 1: p_hoy_utc; regla 2: p_hoy_co), la guarda de interes_pagado_hasta en
-- el abierto de regla 2, y p_prestamo para calcular un solo préstamo (al crearlo).
create or replace function public.marcar_mora_para(
  p_hoy_utc  date,
  p_hoy_co   date,
  p_prestamo uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  update public.prestamos p
     set estado = sub.nuevo
    from (
      select q.id,
             case when q.cobro < q.hoy and not q.pagado
                       -- Regla 2: el ciclo del mes cuenta solo si empezó después del
                       -- desembolso y no estaba pagado antes de la app.
                       and (q.regla_mora = 1
                            or (q.cobro > q.fecha_desembolso
                                and (q.interes_pagado_hasta is null or q.cobro > q.interes_pagado_hasta)))
                  then 'en_mora' else 'activo' end as nuevo
        from (
          select base.id,
                 base.hoy,
                 base.cobro,
                 base.regla_mora,
                 base.fecha_desembolso,
                 base.interes_pagado_hasta,
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
                     p3.interes_pagado_hasta,
                     h.hoy,
                     make_date(
                       extract(year from h.hoy)::int,
                       extract(month from h.hoy)::int,
                       least(coalesce(p3.dia_cobro, extract(day from p3.fecha_desembolso)::int),
                             extract(day from (date_trunc('month', h.hoy) + interval '1 month - 1 day'))::int)
                     ) as cobro
                from public.prestamos p3
                cross join lateral (
                  select case when p3.regla_mora = 1 then p_hoy_utc else p_hoy_co end as hoy
                ) h
               where p3.estado in ('activo', 'en_mora')
                 -- Regla 2: cuotas y cuota fija se marcan por sus cuotas, no por esta regla.
                 and (p3.regla_mora = 1 or p3.tipo = 'abierto')
                 and (p_prestamo is null or p3.id = p_prestamo)
            ) base
        ) q
    ) sub
   where p.id = sub.id
     and p.estado <> sub.nuevo;

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;

-- ── marcar_cuotas_vencidas con la fecha como parámetro ──
create or replace function public.marcar_cuotas_vencidas_para(
  p_hoy_utc  date,
  p_hoy_co   date,
  p_prestamo uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  -- Cuotas con +5 días de atraso pasan a 'vencida' (solo desde 'pendiente').
  -- Regla 1 (o cuota sin préstamo): fecha UTC, como antes. Regla 2: fecha de Colombia.
  update public.cuotas c
     set estado = 'vencida'
   where c.estado = 'pendiente'
     and (p_prestamo is null or c.prestamo_id = p_prestamo)
     and (case when coalesce((select p.regla_mora from public.prestamos p where p.id = c.prestamo_id), 1) = 1
               then p_hoy_utc else p_hoy_co end) > c.fecha_vence + 5;

  -- Estado del préstamo según sus cuotas (igual que la 040). Solo escribe cuando cambia.
  --   'cuotas' (regla 1 y 2): en_mora si tiene alguna cuota vencida.
  --   'cuota_fija' de regla 2: en_mora si tiene una vencida o una 'parcial' con más
  --   de 5 días de atraso (fecha de Colombia: este tipo aquí siempre es de regla 2).
  update public.prestamos p
     set estado = x.nuevo
    from (
      select p2.id,
             case
               when exists (select 1 from public.cuotas c
                             where c.prestamo_id = p2.id
                               and (c.estado = 'vencida'
                                    or (p2.tipo = 'cuota_fija' and c.estado = 'parcial' and p_hoy_co > c.fecha_vence + 5)))
               then 'en_mora' else 'activo'
             end as nuevo
        from public.prestamos p2
       where p2.estado in ('activo', 'en_mora')
         and (p2.tipo = 'cuotas' or (p2.tipo = 'cuota_fija' and p2.regla_mora = 2))
         and (p_prestamo is null or p2.id = p_prestamo)
    ) x
   where p.id = x.id
     and p.estado <> x.nuevo;

  get diagnostics v_afectados = row_count; -- préstamos cuyo estado cambió
  return v_afectados;
end;
$$;

-- ── Las funciones del cron: misma firma, ahora con la fecha de Colombia para la regla 2 ──
create or replace function public.marcar_mora()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.marcar_mora_para(current_date, (now() at time zone 'America/Bogota')::date);
end;
$$;

create or replace function public.marcar_cuotas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.marcar_cuotas_vencidas_para(current_date, (now() at time zone 'America/Bogota')::date);
end;
$$;

-- ── crear_prestamo_existente ──
create or replace function public.crear_prestamo_existente(
  p_tipo                 text,            -- 'abierto' | 'cuotas' | 'cuota_fija'
  p_cliente_id           uuid,
  p_capital              numeric,
  p_fecha_desembolso     date,
  p_tasa_mensual         numeric default null, -- abierto y cuotas
  p_modo_interes         text    default null, -- abierto
  p_frecuencia           text    default null, -- cuotas y cuota fija
  p_n_cuotas             integer default null, -- cuotas y cuota fija
  p_valor_cuota          numeric default null, -- cuota fija
  p_cuotas_pagadas       integer default 0,    -- cuotas y cuota fija: cuotas completas ya pagadas
  p_abonado_siguiente    numeric default 0,    -- cuota fija: abono a la cuota siguiente
  p_saldo_capital        numeric default null, -- abierto: saldo de capital de hoy
  p_interes_pagado_hasta date    default null, -- abierto: último cobro de intereses pagado (null = ninguno)
  p_codeudor_nombre      text    default null,
  p_codeudor_telefono    text    default null,
  p_codeudor_documento   text    default null,
  p_cobrador_id          uuid    default null
)
returns public.prestamos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy        date := (now() at time zone 'America/Bogota')::date;
  v_prestamo   public.prestamos;
  v_id         uuid;
  v_c          public.cuotas;
  v_mov        public.movimientos;
  v_monto      numeric;
  v_pagado     numeric := 0;
  v_pagadas    integer;
  v_parciales  integer;
  v_movs       integer;
  v_meses      integer;
  v_k          integer := 0;
  v_base       numeric;
  v_pendiente  numeric := 0;
  i            integer;
begin
  if auth.uid() is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if public.mi_negocio() is null then
    raise exception 'No perteneces a ningún negocio; no se puede crear el préstamo.';
  end if;
  if public.mi_rol() is distinct from 'dueno' then
    raise exception 'Solo el dueño puede crear préstamos.';
  end if;
  if p_tipo is null or p_tipo not in ('abierto', 'cuotas', 'cuota_fija') then
    raise exception 'Tipo de préstamo inválido.';
  end if;
  if p_capital is null or p_capital <= 0 then
    raise exception 'El capital debe ser mayor a cero.';
  end if;
  if p_fecha_desembolso is null or p_fecha_desembolso >= v_hoy then
    raise exception 'Un préstamo existente debe tener fecha de desembolso anterior a hoy.';
  end if;
  if p_tipo <> 'cuota_fija' and (p_tasa_mensual is null or p_tasa_mensual < 0) then
    raise exception 'Ingresa una tasa válida.';
  end if;
  if p_tipo = 'abierto' and (p_modo_interes is null or p_modo_interes not in ('sobre_saldo', 'sobre_capital_inicial')) then
    raise exception 'Modo de interés inválido.';
  end if;
  if p_tipo = 'cuota_fija' and (p_valor_cuota is null or p_valor_cuota <= 0) then
    raise exception 'El valor de la cuota debe ser mayor a cero.';
  end if;

  if p_tipo in ('cuotas', 'cuota_fija') then
    if p_n_cuotas is null or p_cuotas_pagadas is null
       or p_cuotas_pagadas < 0 or p_cuotas_pagadas >= p_n_cuotas then
      raise exception 'Las cuotas ya pagadas deben ser menos que el total de cuotas.';
    end if;
    if p_tipo = 'cuota_fija'
       and (p_abonado_siguiente is null or p_abonado_siguiente < 0 or p_abonado_siguiente >= p_valor_cuota) then
      raise exception 'El abono a la cuota siguiente debe ser menor que el valor de la cuota.';
    end if;
    if p_tipo = 'cuotas' and coalesce(p_abonado_siguiente, 0) <> 0 then
      raise exception 'El abono a la cuota siguiente solo aplica a la cuota fija.';
    end if;
  else
    if p_saldo_capital is null or p_saldo_capital <= 0 or p_saldo_capital > p_capital then
      raise exception 'El saldo de capital debe ser mayor a cero y no superar el capital prestado.';
    end if;
    -- Meses desde el desembolso: el primer periodo se carga al crear y se devenga
    -- uno más cada 1.º de mes (devengar_intereses).
    v_meses := (extract(year from v_hoy)::int * 12 + extract(month from v_hoy)::int)
             - (extract(year from p_fecha_desembolso)::int * 12 + extract(month from p_fecha_desembolso)::int);
    if p_interes_pagado_hasta is not null then
      -- Debe ser una fecha de cobro real (el día del desembolso en un mes posterior,
      -- acotado a fin de mes) y no posterior a hoy. k = cobros pagados.
      v_k := (extract(year from p_interes_pagado_hasta)::int * 12 + extract(month from p_interes_pagado_hasta)::int)
           - (extract(year from p_fecha_desembolso)::int * 12 + extract(month from p_fecha_desembolso)::int);
      if v_k < 1 or p_interes_pagado_hasta > v_hoy
         or p_interes_pagado_hasta <> (p_fecha_desembolso + make_interval(months => v_k))::date then
        raise exception 'La fecha del último cobro pagado no es una fecha de cobro válida.';
      end if;
    end if;
  end if;

  -- 1) El préstamo, con la RPC de siempre (valida dueño, cliente y cobrador; el
  --    desembolso queda con su fecha real).
  if p_tipo = 'cuotas' then
    v_prestamo := public.crear_prestamo_cuotas(
      p_cliente_id, p_capital, p_tasa_mensual, p_frecuencia, p_n_cuotas, p_fecha_desembolso,
      p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento, p_cobrador_id);
  elsif p_tipo = 'cuota_fija' then
    v_prestamo := public.crear_prestamo_cuota_fija(
      p_cliente_id, p_capital, p_frecuencia, p_n_cuotas, p_valor_cuota, p_fecha_desembolso,
      p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento, p_cobrador_id);
  else
    v_prestamo := public.crear_prestamo(
      p_cliente_id, p_capital, p_tasa_mensual, p_modo_interes, p_fecha_desembolso,
      p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento, p_cobrador_id);
  end if;
  v_id := v_prestamo.id;

  -- 2) Lo ya pagado.
  if p_tipo = 'cuotas' then
    -- Una llamada por cuota, por su valor exacto: un solo pago por el total dejaría el
    -- excedente solo en el capital de las siguientes (su interés quedaría sin pagar).
    for i in 1..p_cuotas_pagadas loop
      select * into v_c from public.cuotas
       where prestamo_id = v_id and estado <> 'pagada'
       order by numero limit 1;
      v_monto := v_c.capital + v_c.interes;
      if v_monto > 0 then
        v_mov := public.registrar_pago_cuotas(v_id, v_monto, null, false);
        v_pagado := v_pagado + v_mov.monto_total;
        delete from public.movimientos where id = v_mov.id;
      else
        update public.cuotas set estado = 'pagada' where id = v_c.id; -- cuota en 0 (capital mínimo)
      end if;
    end loop;
  elsif p_tipo = 'cuota_fija' then
    v_monto := coalesce((select sum(capital) from public.cuotas
                          where prestamo_id = v_id and numero <= p_cuotas_pagadas), 0)
             + coalesce(p_abonado_siguiente, 0);
    if v_monto > 0 then
      v_mov := public.registrar_pago_cuota_fija(v_id, v_monto, null);
      v_pagado := v_mov.monto_total;
      delete from public.movimientos where id = v_mov.id;
    end if;
  else
    v_base := case when p_modo_interes = 'sobre_saldo' then p_saldo_capital else p_capital end;
    -- Periodos devengados hasta hoy: 1 (al crear) + v_meses. Pagados: v_k.
    -- El primero es el que carga crear_prestamo; los demás, los de devengar_intereses.
    for i in (v_k + 1)..(v_meses + 1) loop
      v_pendiente := v_pendiente
                   + case when i = 1 then round(p_capital * p_tasa_mensual)
                          else round(v_base * p_tasa_mensual, 2) end;
    end loop;
    update public.prestamos
       set saldo_capital        = p_saldo_capital,
           interes_pendiente    = v_pendiente,
           -- El devengo de este mes ya está incluido: el cron no lo vuelve a sumar.
           ultimo_devengo       = greatest(p_fecha_desembolso, date_trunc('month', v_hoy)::date),
           interes_pagado_hasta = p_interes_pagado_hasta,
           pagado_antes         = p_capital - p_saldo_capital,
           cuotas_pagadas_antes = v_k
     where id = v_id;
  end if;

  if p_tipo in ('cuotas', 'cuota_fija') then
    -- Control: exactamente N pagadas (las N primeras) y ninguna parcial, salvo la
    -- cuota fija con abono (una sola, la siguiente).
    select count(*) filter (where estado = 'pagada' and numero <= p_cuotas_pagadas),
           count(*) filter (where estado = 'parcial')
      into v_pagadas, v_parciales
      from public.cuotas where prestamo_id = v_id;
    if v_pagadas <> p_cuotas_pagadas
       or (select count(*) from public.cuotas where prestamo_id = v_id and estado = 'pagada') <> p_cuotas_pagadas
       or v_parciales <> (case when p_tipo = 'cuota_fija' and p_abonado_siguiente > 0 then 1 else 0 end) then
      raise exception 'No se pudo registrar lo ya pagado (quedaron % cuotas pagadas y % parciales).', v_pagadas, v_parciales;
    end if;

    update public.cuotas set pagada_antes = true where prestamo_id = v_id and estado = 'pagada';
    update public.prestamos
       set pagado_antes = v_pagado,
           cuotas_pagadas_antes = p_cuotas_pagadas
     where id = v_id;
  end if;

  -- Control: del préstamo solo queda el movimiento de desembolso, con su fecha real.
  select count(*) into v_movs from public.movimientos where prestamo_id = v_id;
  if v_movs <> 1 or not exists (select 1 from public.movimientos
                                 where prestamo_id = v_id and tipo = 'desembolso' and fecha = p_fecha_desembolso) then
    raise exception 'No se pudo registrar el préstamo existente (movimientos inesperados).';
  end if;

  -- 3) Estado de hoy (regla 2, fecha de Colombia), solo de este préstamo: si quedó
  --    algo atrasado se ve desde ya, sin esperar al cron.
  if p_tipo = 'abierto' then
    perform public.marcar_mora_para(current_date, v_hoy, v_id);
  else
    perform public.marcar_cuotas_vencidas_para(current_date, v_hoy, v_id);
  end if;

  select * into v_prestamo from public.prestamos where id = v_id;
  if v_prestamo.regla_mora <> 2 then
    raise exception 'El préstamo existente debe nacer en la regla de mora 2.';
  end if;
  return v_prestamo;
end;
$$;

-- ── Permisos ──
-- Internas y de mantenimiento: solo el dueño de las funciones (pg_cron y las RPC definer).
revoke all on function public.marcar_mora_para(date, date, uuid) from public, anon, authenticated;
revoke all on function public.marcar_cuotas_vencidas_para(date, date, uuid) from public, anon, authenticated;
-- Se reafirma (create or replace conserva los permisos).
revoke execute on function public.marcar_mora() from public, anon, authenticated;
revoke execute on function public.marcar_cuotas_vencidas() from public, anon, authenticated;
-- La RPC nueva: solo usuarios con sesión (adentro valida que sea el dueño).
revoke all on function public.crear_prestamo_existente(
  text, uuid, numeric, date, numeric, text, text, integer, numeric, integer, numeric, numeric, date, text, text, text, uuid
) from public, anon;
grant execute on function public.crear_prestamo_existente(
  text, uuid, numeric, date, numeric, text, text, integer, numeric, integer, numeric, numeric, date, text, text, text, uuid
) to authenticated;
