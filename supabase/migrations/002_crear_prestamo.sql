-- ============================================================
--  002 — RPC crear_prestamo
--  Crea un préstamo y su movimiento de desembolso de forma
--  atómica (una sola transacción: entran juntos o ninguno).
--  SECURITY INVOKER: corre como el usuario que llama, así la RLS
--  aplica y el user_id queda fijado a auth.uid().
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
    tasa_mensual, modo_interes, fecha_desembolso, estado
  ) values (
    v_user, p_cliente_id, p_capital, p_capital,
    p_tasa_mensual, p_modo_interes, p_fecha_desembolso, 'activo'
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
