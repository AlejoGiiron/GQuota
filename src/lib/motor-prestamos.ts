// motor-prestamos.ts
// Motor de cálculo de préstamos.
//
// Soporta DOS formas de cobro del interés, controladas por `modoInteres`:
//   - 'sobre_saldo'           -> interés = saldo de capital vigente × tasa (baja al abonar)
//   - 'sobre_capital_inicial' -> interés = capital inicial × tasa (fijo hasta el final)
//
// Supuestos del MVP (ajustables si el negocio lo pide):
//   - El interés se devenga una vez por periodo (mes), sin prorrateo por días.
//   - El interés no pagado se acumula en `interesPendiente` y NO capitaliza:
//     no se suma al capital ni genera interés adicional.
//   - Montos en pesos; se redondea a 2 decimales. En producción conviene
//     trabajar en enteros (pesos sin centavos) o con una librería decimal
//     para evitar errores de punto flotante.

export type ModoInteres = "sobre_saldo" | "sobre_capital_inicial";

export interface Prestamo {
  capitalInicial: number; // monto desembolsado originalmente
  saldoCapital: number; // cuánto falta por abonar a capital
  tasaMensual: number; // 0.10 = 10% mensual
  modoInteres: ModoInteres;
  interesPendiente: number; // interés devengado y aún no pagado
}

export interface ResultadoPago {
  montoInteres: number; // parte del pago aplicada a interés
  montoCapital: number; // parte del pago aplicada a capital
  excedente: number; // sobrante si pagó de más (saldo a favor)
  saldoAnterior: number;
  saldoPosterior: number;
  interesPendienteRestante: number;
  prestamoSaldado: boolean;
}

const redondear = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/** Interés que genera el préstamo en un periodo (un mes), según su modo. */
export function interesDelPeriodo(p: Prestamo): number {
  const base =
    p.modoInteres === "sobre_saldo" ? p.saldoCapital : p.capitalInicial;
  return redondear(base * p.tasaMensual);
}

/**
 * Devenga (acumula) el interés de un periodo al interés pendiente.
 * Llamar una vez por mes. No capitaliza: el interés no se suma al capital.
 */
export function devengarPeriodo(p: Prestamo): Prestamo {
  return {
    ...p,
    interesPendiente: redondear(p.interesPendiente + interesDelPeriodo(p)),
  };
}

/**
 * Aplica un pago al préstamo.
 * El pago cubre primero el interés pendiente; lo que sobra abona a capital.
 * Si aún sobra después de saldar el capital, se reporta como excedente.
 */
export function aplicarPago(
  p: Prestamo,
  montoPago: number
): { prestamo: Prestamo; resultado: ResultadoPago } {
  if (montoPago < 0) throw new Error("El monto del pago no puede ser negativo.");

  const montoInteres = Math.min(montoPago, p.interesPendiente);
  const sobrante = redondear(montoPago - montoInteres);

  const montoCapital = Math.min(sobrante, p.saldoCapital);
  const excedente = redondear(sobrante - montoCapital);

  const saldoPosterior = redondear(p.saldoCapital - montoCapital);
  const interesPendienteRestante = redondear(p.interesPendiente - montoInteres);
  const prestamoSaldado = saldoPosterior === 0;

  const prestamo: Prestamo = {
    ...p,
    saldoCapital: saldoPosterior,
    interesPendiente: interesPendienteRestante,
  };

  const resultado: ResultadoPago = {
    montoInteres,
    montoCapital,
    excedente,
    saldoAnterior: p.saldoCapital,
    saldoPosterior,
    interesPendienteRestante,
    prestamoSaldado,
  };

  return { prestamo, resultado };
}
