// Capa de cálculo del dashboard (cartera). Lógica pura y reutilizable:
// las pantallas no calculan métricas inline. Los cálculos de interés se
// delegan al motor (src/lib/motor-prestamos.ts); aquí no se reimplementan.

import { interesDelPeriodo, type ModoInteres } from '@/lib/motor-prestamos'
import type { Movimiento, Prestamo } from '@/types/database.types'

const ESTADO_ACTIVO = 'activo'
const ESTADO_MORA = 'en_mora'

/** Préstamos vigentes (con saldo por cobrar): activos o en mora. */
function esVigente(p: Prestamo): boolean {
  return p.estado === ESTADO_ACTIVO || p.estado === ESTADO_MORA
}

/** Interés del periodo vigente, vía el motor, según el modo del préstamo. */
function interesVigente(p: Prestamo): number {
  return interesDelPeriodo({
    capitalInicial: p.capital_inicial,
    saldoCapital: p.saldo_capital,
    tasaMensual: p.tasa_mensual,
    modoInteres: p.modo_interes as ModoInteres,
    interesPendiente: p.interes_pendiente,
  })
}

function sumar<T>(lista: T[], valor: (x: T) => number): number {
  return lista.reduce((acc, x) => acc + valor(x), 0)
}

function isoLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** Primer día del mes de `d`, en formato aaaa-mm-dd (para filtrar movimientos). */
export function primerDiaDelMes(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-01`
}

export interface MetricasCartera {
  totalPrestado: number
  prestamosActivos: number
  saldoPorCobrar: number
  clientesConActivo: number
  gananciaMes: number
  montoEnMora: number
  prestamosEnMora: number
}

/**
 * Métricas de la cartera. "Activos" = estado 'activo'; "en mora" = estado
 * 'en_mora' (buckets separados, como el dashboard aprobado). Ganancia del mes
 * = suma de monto_interes de los movimientos del mes en curso.
 */
export function calcularMetricas(
  prestamos: Prestamo[],
  movimientosDelMes: Movimiento[],
): MetricasCartera {
  const activos = prestamos.filter((p) => p.estado === ESTADO_ACTIVO)
  const enMora = prestamos.filter((p) => p.estado === ESTADO_MORA)
  return {
    totalPrestado: sumar(activos, (p) => p.capital_inicial),
    prestamosActivos: activos.length,
    saldoPorCobrar: sumar(activos, (p) => p.saldo_capital),
    clientesConActivo: new Set(activos.map((p) => p.cliente_id)).size,
    gananciaMes: sumar(movimientosDelMes, (m) => m.monto_interes),
    montoEnMora: sumar(enMora, (p) => p.saldo_capital),
    prestamosEnMora: enMora.length,
  }
}

export interface CobroHoy {
  prestamo: Prestamo
  montoACobrar: number
  cobrado: boolean
}

export interface ResumenCobrosHoy {
  items: CobroHoy[]
  programados: number
  cobrados: number
  porCobrar: number
}

/** Día de cobro efectivo del mes: dia_cobro si está, si no el día del desembolso. */
function diaDeCobro(p: Prestamo, diasEnMes: number): number {
  const base = p.dia_cobro ?? (Number(p.fecha_desembolso.slice(8, 10)) || 1)
  return Math.min(base, diasEnMes)
}

/**
 * Cobros que vencen hoy: préstamos vigentes cuyo día de cobro cae hoy.
 * `cobrado` = ya hay un pago (interés/cuota) registrado hoy para ese préstamo.
 * El monto a cobrar es el interés del periodo (vía motor).
 */
export function calcularCobrosHoy(
  prestamos: Prestamo[],
  movimientos: Movimiento[],
  hoy: Date,
): ResumenCobrosHoy {
  const dia = hoy.getDate()
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const hoyISO = isoLocal(hoy)

  const pagadosHoy = new Set(
    movimientos
      .filter((m) => m.fecha === hoyISO && (m.tipo === 'interes' || m.tipo === 'cuota'))
      .map((m) => m.prestamo_id),
  )

  const items: CobroHoy[] = prestamos
    .filter((p) => esVigente(p) && diaDeCobro(p, diasEnMes) === dia)
    .map((p) => ({
      prestamo: p,
      montoACobrar: interesVigente(p),
      cobrado: pagadosHoy.has(p.id),
    }))
    .sort((a, b) => Number(a.cobrado) - Number(b.cobrado)) // pendientes primero

  return {
    items,
    programados: items.length,
    cobrados: items.filter((i) => i.cobrado).length,
    porCobrar: sumar(
      items.filter((i) => !i.cobrado),
      (i) => i.montoACobrar,
    ),
  }
}

/** Préstamos vigentes ordenados por saldo descendente (top deudores). */
export function topDeudores(prestamos: Prestamo[], limite = 5): Prestamo[] {
  return prestamos
    .filter(esVigente)
    .sort((a, b) => b.saldo_capital - a.saldo_capital)
    .slice(0, limite)
}
