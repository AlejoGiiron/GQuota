-- ============================================================
--  020 — RPC crear_prestamo_cuota_fija
--  Crea de forma atómica un préstamo tipo 'cuota_fija' + su movimiento de
--  desembolso + las N filas del cronograma (tabla cuotas). SECURITY INVOKER
--  (la RLS aplica; user_id = auth.uid()). Soporta codeudor opcional.
--
--  Modelo (ver CLAUDE.md): cuotas de monto fijo, sin tasa ni separación
--  capital/interés. Cada cuota guarda su VALOR en la columna `capital`
--  (interes = 0) y cuánto se le abona en `abonado`. La referencia de la
--  lógica es src/lib/motor-prestamos.ts (generarCronogramaFijo): si cambia
--  allá, cambiar aquí.
--
--  Fechas: desde el desembolso, +1 día (diaria), +7 (semanal), +15 (quincenal)
--  o +1 mes (mensual) por cuota. tasa_mensual = 0 (no aplica). saldo_capital
--  se inicializa con el TOTAL a cobrar (nº × valor); baja con cada pago.
-- ============================================================

create or replace function public.crear_prestamo_cuota_fija(
  p_cliente_id        uuid,
  p_capital           numeric,
  p_frecuencia        text,
  p_n_cuotas          int,
  p_valor_cuota       numeric,
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
  v_prestamo public.prestamos;
  v_total    numeric;
  v_paso     interval;
  i          int;
begin
  if v_user is null then
    raise exception 'No hay una sesión activa.';
  end if;
  if p_n_cuotas < 1 then
    raise exception 'El número de cuotas debe ser al menos 1.';
  end if;
  if p_valor_cuota <= 0 then
    raise exception 'El valor de la cuota debe ser mayor a cero.';
  end if;

  v_paso := case p_frecuencia
              when 'diaria'    then interval '1 day'
              when 'semanal'   then interval '7 days'
              when 'quincenal' then interval '15 days'
              when 'mensual'   then interval '1 month'
              else null
            end;
  if v_paso is null then
    raise exception 'Frecuencia inválida: %', p_frecuencia;
  end if;

  v_total := p_n_cuotas * p_valor_cuota; -- total a cobrar (= saldo inicial)

  insert into public.prestamos (
    user_id, cliente_id, capital_inicial, saldo_capital,
    tasa_mensual, tipo, valor_cuota, fecha_desembolso, estado,
    codeudor_nombre, codeudor_telefono, codeudor_documento
  ) values (
    v_user, p_cliente_id, p_capital, v_total,
    0, 'cuota_fija', p_valor_cuota, p_fecha_desembolso, 'activo',
    p_codeudor_nombre, p_codeudor_telefono, p_codeudor_documento
  )
  returning * into v_prestamo;

  insert into public.movimientos (
    user_id, prestamo_id, fecha, tipo,
    monto_total, monto_interes, monto_capital,
    saldo_anterior, saldo_posterior
  ) values (
    v_user, v_prestamo.id, p_fecha_desembolso, 'desembolso',
    p_capital, 0, 0, 0, p_capital
  );

  for i in 1..p_n_cuotas loop
    insert into public.cuotas (
      user_id, prestamo_id, numero, fecha_vence, capital, interes, abonado, estado
    ) values (
      v_user, v_prestamo.id, i,
      (p_fecha_desembolso + (i * v_paso))::date,
      p_valor_cuota, 0, 0, 'pendiente'
    );
  end loop;

  return v_prestamo;
end;
$$;

grant execute on function public.crear_prestamo_cuota_fija(uuid, numeric, text, int, numeric, date, text, text, text) to authenticated;
