-- ============================================================
--  004 — RPC registrar_pago
--  Persiste un pago de forma atómica: inserta el movimiento y
--  actualiza el préstamo (saldo_capital, interes_pendiente, estado).
--  NO recalcula la fórmula: solo guarda el desglose que ya calculó
--  el motor (src/lib/motor-prestamos.ts) en el cliente.
--  SECURITY INVOKER: corre como el usuario; la RLS aplica.
-- ============================================================

create or replace function public.registrar_pago(
  p_prestamo_id                uuid,
  p_monto                      numeric,
  p_metodo_pago                text,
  p_tipo                       text,
  p_monto_interes              numeric,
  p_monto_capital              numeric,
  p_saldo_anterior             numeric,
  p_saldo_posterior            numeric,
  p_interes_pendiente_restante numeric
)
returns public.movimientos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_movimiento public.movimientos;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;

  -- Bajo RLS, este select solo ve los préstamos del usuario.
  if not exists (select 1 from public.prestamos where id = p_prestamo_id) then
    raise exception 'Préstamo no encontrado.';
  end if;

  insert into public.movimientos (
    user_id, prestamo_id, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior, metodo_pago
  ) values (
    v_user, p_prestamo_id, p_tipo,
    p_monto, p_monto_interes, p_monto_capital,
    p_saldo_anterior, p_saldo_posterior, p_metodo_pago
  )
  returning * into v_movimiento;

  update public.prestamos
     set saldo_capital     = p_saldo_posterior,
         interes_pendiente = p_interes_pendiente_restante,
         estado            = case when p_saldo_posterior = 0 then 'pagado' else estado end
   where id = p_prestamo_id;

  return v_movimiento;
end;
$$;

grant execute on function public.registrar_pago(
  uuid, numeric, text, text, numeric, numeric, numeric, numeric, numeric
) to authenticated;
