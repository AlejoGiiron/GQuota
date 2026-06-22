-- ============================================================
--  026 — Restaurar el interés del primer periodo (regresión de la 017)
--
--  La 015 hizo que todo préstamo 'abierto' naciera con el interés del primer
--  periodo ya cargado (interes_pendiente = round(capital_inicial *
--  tasa_mensual), ultimo_devengo = fecha de desembolso), en AMBOS modos. La
--  017 (codeudor) recreó crear_prestamo copiando una versión anterior SIN esa
--  inicialización y la pisó; la 024 (negocio_id) y la 025 (guard de cliente)
--  arrastraron el mismo cuerpo. Desde la 017, los abiertos nuevos nacían con
--  interes_pendiente = 0 y se podían saldar sin cobrar el primer interés.
--
--  Esta migración restaura el comportamiento de la 015 SOBRE la versión
--  vigente (la de la 025: con codeudor, negocio_id y guard de cliente). Solo
--  agrega las dos columnas de arranque; no cambia codeudor, negocio_id, el
--  guard ni ningún otro cálculo. Aplica SOLO a crear_prestamo (producto
--  'abierto'); 'cuotas' y 'cuota_fija' no llevan interes_pendiente.
--
--  Decisión (ver 015 y CLAUDE.md): el interés del primer periodo es siempre
--  capital_inicial * tasa_mensual, igual en sobre_saldo y sobre_capital_inicial
--  (al desembolso saldo = capital, así que interesDelPeriodo() del motor da lo
--  mismo en ambos modos). ultimo_devengo = desembolso para que el devengo de
--  ESTE mes no lo duplique (idempotencia: ultimo_devengo >= primer día del mes).
--  REFERENCIA DE LA FÓRMULA: src/lib/motor-prestamos.ts (interesDelPeriodo).
-- ============================================================

create or replace function public.crear_prestamo(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_tasa_mensual      numeric,
  p_modo_interes      text,
  p_fecha_desembolso  date,
  p_codeudor_nombre   text default null,
  p_codeudor_telefono text default null,
  p_codeudor_documento text default null
)
returns public.prestamos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_negocio  uuid := public.mi_negocio();
  v_prestamo public.prestamos;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if v_negocio is null then
    raise exception 'No perteneces a ningún negocio; no se puede crear el préstamo.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and negocio_id = v_negocio) then
    raise exception 'El cliente no pertenece a tu negocio.';
  end if;

  insert into public.prestamos (
    user_id, negocio_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, modo_interes, fecha_desembolso, estado,
    interes_pendiente, ultimo_devengo,
    codeudor_nombre, codeudor_telefono, codeudor_documento
  ) values (
    v_user, v_negocio, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, p_modo_interes, p_fecha_desembolso, 'activo',
    round(p_capital * p_tasa_mensual),  -- interés del primer periodo (ambos modos)
    p_fecha_desembolso,                 -- evita que el devengo de este mes lo duplique
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento
  )
  returning * into v_prestamo;

  insert into public.movimientos (
    user_id, negocio_id, prestamo_id, fecha, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior
  ) values (
    v_user, v_negocio, v_prestamo.id, p_fecha_desembolso, 'desembolso',
    p_capital, 0, 0,
    0, p_capital
  );

  return v_prestamo;
end;
$$;

grant execute on function public.crear_prestamo(uuid, numeric, numeric, text, date, text, text, text) to authenticated;
