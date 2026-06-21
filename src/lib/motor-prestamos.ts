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

// ============================================================
//  CUOTAS PACTADAS (préstamo tipo 'cuotas')
//  Modelo distinto al "abierto" de arriba: cronograma fijo de N cuotas
//  con interés plano pactado al inicio. El interés pactado NO baja;
//  adelantar capital nunca baja el total (solo lo redistribuye) y pagar
//  solo el interés lo SUBE (penalización). round = pesos enteros.
//  NO toca nada del modelo "abierto".
// ============================================================

export type FrecuenciaCuota = "diaria" | "semanal" | "quincenal" | "mensual";
export type EstadoCuota = "pendiente" | "pagada" | "vencida";

/** Una cuota del cronograma. capital e interés van por separado; monto = capital + interes. */
export interface Cuota {
  numero: number;
  capital: number;
  interes: number;
  estado: EstadoCuota;
}

export interface ResultadoPagoCuotas {
  cuotas: Cuota[];
  sobrante: number; // saldo a favor si pagó más que todo lo pendiente
}

// Cuántos meses representa cada cuota según la frecuencia (30 días = 1 mes,
// 4 semanas = 1 mes, quincena = ½ mes; un día = 1/30 de mes).
const MESES_POR_CUOTA: Record<FrecuenciaCuota, number> = {
  diaria: 1 / 30,
  semanal: 1 / 4,
  quincenal: 1 / 2,
  mensual: 1,
};

const pesos = (n: number): number => Math.round(n);

/**
 * Genera el cronograma de cuotas con interés plano pactado.
 * interesTotal = capital × tasaMensual × meses (meses = nCuotas × meses/cuota).
 * Interés repartido parejo; capital parejo en las primeras nCuotas-1 cuotas.
 * La ÚLTIMA cuota absorbe el redondeo de capital e interés, así ambos suman EXACTO.
 * (Las fechas de vencimiento se calculan al crear el préstamo, no aquí.)
 */
export function generarCronograma(
  capital: number,
  tasaMensual: number,
  frecuencia: FrecuenciaCuota,
  nCuotas: number
): Cuota[] {
  if (nCuotas < 1) throw new Error("El número de cuotas debe ser al menos 1.");
  if (capital <= 0) throw new Error("El capital debe ser mayor a cero.");

  const meses = nCuotas * MESES_POR_CUOTA[frecuencia];
  const interesTotal = pesos(capital * tasaMensual * meses);
  const interesPorCuota = pesos(interesTotal / nCuotas);
  const capitalPorCuota = pesos(capital / nCuotas);

  const cuotas: Cuota[] = [];
  for (let i = 1; i < nCuotas; i++) {
    cuotas.push({ numero: i, capital: capitalPorCuota, interes: interesPorCuota, estado: "pendiente" });
  }
  // Última cuota: lo que falte para cuadrar exacto.
  const capitalPrevio = capitalPorCuota * (nCuotas - 1);
  const interesPrevio = interesPorCuota * (nCuotas - 1);
  cuotas.push({
    numero: nCuotas,
    capital: capital - capitalPrevio,
    interes: interesTotal - interesPrevio,
    estado: "pendiente",
  });

  return cuotas;
}

/** Primera cuota aún no pagada (la vigente), o -1 si todas están pagadas. */
function indiceVigente(cuotas: Cuota[]): number {
  return cuotas.findIndex((c) => c.estado !== "pagada");
}

/**
 * Aplica un abono al cronograma.
 * Cubre la cuota vigente (primero su interés, luego su capital); el EXCEDENTE
 * baja SOLO el capital de las cuotas siguientes (nunca su interés). El total a
 * pagar no baja por adelantar: solo se redistribuye.
 */
export function aplicarPagoACuotas(cuotas: Cuota[], abono: number): ResultadoPagoCuotas {
  if (abono < 0) throw new Error("El abono no puede ser negativo.");

  const copia: Cuota[] = cuotas.map((c) => ({ ...c }));
  let restante = abono;

  const iv = indiceVigente(copia);
  if (iv === -1) return { cuotas: copia, sobrante: pesos(restante) };

  // 1) Cuota vigente: interés y luego capital.
  const vigente = copia[iv];
  const pagoInteres = Math.min(restante, vigente.interes);
  vigente.interes -= pagoInteres;
  restante -= pagoInteres;
  const pagoCapital = Math.min(restante, vigente.capital);
  vigente.capital -= pagoCapital;
  restante -= pagoCapital;
  if (vigente.capital === 0 && vigente.interes === 0) vigente.estado = "pagada";

  // 2) Excedente: baja SOLO el capital de las cuotas siguientes.
  for (let i = iv + 1; i < copia.length && restante > 0; i++) {
    const c = copia[i];
    if (c.estado === "pagada") continue;
    const pago = Math.min(restante, c.capital);
    c.capital -= pago;
    restante -= pago;
    if (c.capital === 0 && c.interes === 0) c.estado = "pagada";
  }

  return { cuotas: copia, sobrante: pesos(restante) };
}

/**
 * Paga únicamente el interés de la cuota vigente: esa cuota queda 'pagada' y su
 * capital se "corre" a una cuota NUEVA al final que REPITE el mismo interés que
 * traía la cuota impaga (penalización, no se recalcula con la tasa). El total SUBE.
 */
export function pagarSoloInteres(cuotas: Cuota[]): Cuota[] {
  const copia: Cuota[] = cuotas.map((c) => ({ ...c }));

  const iv = indiceVigente(copia);
  if (iv === -1) return copia;

  const vigente = copia[iv];
  const capitalCorrido = vigente.capital;
  const interesCorrido = vigente.interes;

  // Se da por pagado el interés; el capital se corre.
  vigente.capital = 0;
  vigente.interes = 0;
  vigente.estado = "pagada";

  const ultimoNumero = copia.reduce((max, c) => Math.max(max, c.numero), 0);
  copia.push({
    numero: ultimoNumero + 1,
    capital: capitalCorrido,
    interes: interesCorrido, // mismo interés que traía la cuota impaga
    estado: "pendiente",
  });

  return copia;
}

// ============================================================
//  CUOTA FIJA (préstamo tipo 'cuota_fija')
//  El más simple de los tres: el prestamista fija capital, nº de cuotas,
//  valor de cuota y frecuencia. NO hay tasa ni %. Cada cuota es un monto
//  fijo (el interés está inmerso, no se separa capital/interés).
//  El pago LLENA cuotas en orden: cada cuota guarda cuánto se le ha abonado.
//  SIN mora, SIN solo-interés, SIN recálculos. La frecuencia solo define
//  fechas de vencimiento (se calculan al crear, no aquí).
//  NO toca nada de 'abierto' ni de 'cuotas' pactadas.
// ============================================================

export type EstadoCuotaFija = "pendiente" | "parcial" | "pagada";

/** Una cuota de monto fijo. `abonado` es cuánto se le lleva pagado (0 ≤ abonado ≤ valor). */
export interface CuotaFija {
  numero: number;
  valor: number;
  abonado: number;
  estado: EstadoCuotaFija;
}

export interface ResultadoPagoFijo {
  cuotas: CuotaFija[];
  sobrante: number; // saldo a favor si el monto excede todo el saldo pendiente
}

/** Estado de una cuota fija según lo abonado vs su valor. */
function estadoCuotaFija(abonado: number, valor: number): EstadoCuotaFija {
  if (abonado <= 0) return "pendiente";
  if (abonado >= valor) return "pagada";
  return "parcial";
}

/**
 * Genera el cronograma de cuota fija: N cuotas iguales de `valorCuota`,
 * sin abonar (abonado 0, estado 'pendiente').
 * (Las fechas de vencimiento se calculan al crear el préstamo, no aquí.)
 */
export function generarCronogramaFijo(nCuotas: number, valorCuota: number): CuotaFija[] {
  if (nCuotas < 1) throw new Error("El número de cuotas debe ser al menos 1.");
  if (valorCuota <= 0) throw new Error("El valor de la cuota debe ser mayor a cero.");

  const cuotas: CuotaFija[] = [];
  for (let i = 1; i <= nCuotas; i++) {
    cuotas.push({ numero: i, valor: valorCuota, abonado: 0, estado: "pendiente" });
  }
  return cuotas;
}

/**
 * Derivados del préstamo de cuota fija. total = nCuotas × valorCuota;
 * ganancia = total − capital (puede ser negativa: la UI la usa para alertar).
 */
export function resumenCuotaFija(
  capital: number,
  nCuotas: number,
  valorCuota: number
): { total: number; ganancia: number } {
  const total = pesos(nCuotas * valorCuota);
  return { total, ganancia: pesos(total - capital) };
}

/**
 * Aplica un pago al cronograma de cuota fija: llena las cuotas pendientes/parciales
 * EN ORDEN, abonando a cada una min(restante, valor − abonado). Cierra las que
 * completa y deja la siguiente parcial si sobra. El sobrante (si el monto excede
 * todo el saldo) se devuelve. NO separa capital/interés ni recalcula nada.
 */
export function aplicarPagoFijo(cuotas: CuotaFija[], monto: number): ResultadoPagoFijo {
  if (monto < 0) throw new Error("El monto del pago no puede ser negativo.");

  const copia: CuotaFija[] = cuotas.map((c) => ({ ...c }));
  let restante = monto;

  for (const c of copia) {
    if (restante <= 0) break;
    const falta = c.valor - c.abonado;
    if (falta <= 0) continue; // cuota ya pagada
    const abono = Math.min(restante, falta);
    c.abonado += abono;
    restante -= abono;
    c.estado = estadoCuotaFija(c.abonado, c.valor);
  }

  return { cuotas: copia, sobrante: pesos(restante) };
}
