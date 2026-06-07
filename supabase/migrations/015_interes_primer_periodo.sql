-- ============================================================
--  015 — Interés del primer periodo al desembolsar (préstamos 'abierto')
--  Reemplaza crear_prestamo (definida en 002) para que TODO préstamo
--  'abierto' nazca con el interés del primer periodo ya cargado.
--
--  Decisión de negocio: el interés del primer periodo se debe siempre desde
--  el desembolso, en AMBOS modos (sobre_capital_inicial y sobre_saldo), y es
--  siempre capital_inicial * tasa_mensual (ver interesDelPeriodo en
--  src/lib/motor-prestamos.ts). Por eso el arranque NO distingue modo_interes;
--  la diferencia entre modos solo aplica del 2.º periodo en adelante, y eso ya
--  lo maneja devengar_intereses (006).
--
--  - interes_pendiente inicial = round(capital_inicial * tasa_mensual)
--  - ultimo_devengo = fecha de desembolso, para que el devengo de ESTE mes no
--    lo vuelva a sumar (idempotencia: ultimo_devengo >= primer día del mes).
--  No cambia la firma ni toca crear_prestamo_cuotas (las cuotas son otro modelo).
-- ============================================================

create or replace function public.crear_prestamo(
  p_cliente_id      uuid,
  p_capital         numeric,
  p_tasa_mensual    numeric,
  p_modo_interes    text,
  p_fecha_desembolso date
)
returns public.prestamos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_prestamo public.prestamos;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;

  insert into public.prestamos (
    user_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, modo_interes, fecha_desembolso, estado,
    interes_pendiente, ultimo_devengo
  ) values (
    v_user, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, p_modo_interes, p_fecha_desembolso, 'activo',
    round(p_capital * p_tasa_mensual),  -- interés del primer periodo (ambos modos)
    p_fecha_desembolso                  -- evita que el devengo de este mes lo duplique
  )
  returning * into v_prestamo;

  insert into public.movimientos (
    user_id, prestamo_id, fecha, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior
  ) values (
    v_user, v_prestamo.id, p_fecha_desembolso, 'desembolso',
    p_capital, 0, 0,
    0, p_capital
  );

  return v_prestamo;
end;
$$;

grant execute on function public.crear_prestamo(uuid, numeric, numeric, text, date) to authenticated;
