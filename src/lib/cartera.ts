// Capa de cálculo del dashboard (cartera). Lógica pura y reutilizable:
// las pantallas no calculan métricas inline. Los cálculos de interés se
// delegan al motor (src/lib/motor-prestamos.ts); aquí no se reimplementan.

import { interesDelPeriodo, type ModoInteres } from '@/lib/motor-prestamos'
import type { CuotaDB, Movimiento, Prestamo } from '@/types/db'

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

// ── Criterio de "día de cobro" y "vencido" ──
// IMPORTANTE: este es el MISMO criterio que replica la función SQL
// public.marcar_mora() (migración 007). Si cambia aquí, cambiar allá.

/** Fecha de cobro del mes en curso (aaaa-mm-dd): dia_cobro o el día del desembolso, acotado al mes. */
function fechaCobroDelMes(p: Prestamo, hoy: Date): string {
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const dia = Math.min(p.dia_cobro ?? (Number(p.fecha_desembolso.slice(8, 10)) || 1), diasEnMes)
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${hoy.getFullYear()}-${mm}-${dd}`
}

/** ¿Hay un pago (interés/cuota) en este ciclo, es decir con fecha >= la de cobro? */
function pagadoEnCiclo(movimientos: Movimiento[], prestamoId: string, desdeISO: string): boolean {
  return movimientos.some(
    (m) =>
      m.prestamo_id === prestamoId &&
      (m.tipo === 'interes' || m.tipo === 'cuota') &&
      m.fecha >= desdeISO,
  )
}

function diasDeAtraso(cobroISO: string, hoy: Date): number {
  const [y, m, d] = cobroISO.split('-').map(Number)
  const cobro = new Date(y, m - 1, d)
  const hoySolo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((hoySolo.getTime() - cobro.getTime()) / 86_400_000)
}

/** Próxima cuota pendiente (menor número) por préstamo, de un set de cuotas no pagadas. */
function proximaCuotaPorPrestamo(cuotas: CuotaDB[]): Map<string, CuotaDB> {
  const map = new Map<string, CuotaDB>()
  for (const c of cuotas) {
    const actual = map.get(c.prestamo_id)
    if (!actual || c.numero < actual.numero) map.set(c.prestamo_id, c)
  }
  return map
}

/**
 * Cobros que vencen hoy. Para préstamos 'abierto' es la fecha de cobro del mes;
 * para préstamos de 'cuotas' es la fecha_vence de su PRÓXIMA cuota pendiente
 * (su monto a cobrar = capital + interés de esa cuota).
 */
export function calcularCobrosHoy(
  prestamos: Prestamo[],
  movimientos: Movimiento[],
  cuotas: CuotaDB[],
  hoy: Date,
): ResumenCobrosHoy {
  const hoyISO = isoLocal(hoy)
  const proxima = proximaCuotaPorPrestamo(cuotas)
  const items: CobroHoy[] = []

  for (const p of prestamos) {
    if (!esVigente(p)) continue
    if (p.tipo === 'cuotas') {
      const c = proxima.get(p.id)
      if (c && c.fecha_vence === hoyISO) {
        items.push({ prestamo: p, montoACobrar: c.capital + c.interes, cobrado: false })
      }
    } else if (p.tipo === 'cuota_fija') {
      // Cuota fija: la próxima cuota no saldada; a cobrar = lo que le falta (valor − abonado).
      const c = proxima.get(p.id)
      if (c && c.fecha_vence === hoyISO) {
        items.push({ prestamo: p, montoACobrar: c.capital - c.abonado, cobrado: false })
      }
    } else if (fechaCobroDelMes(p, hoy) === hoyISO) {
      items.push({
        prestamo: p,
        montoACobrar: interesVigente(p),
        cobrado: pagadoEnCiclo(movimientos, p.id, hoyISO),
      })
    }
  }

  items.sort((a, b) => Number(a.cobrado) - Number(b.cobrado)) // pendientes primero

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

export interface CobroVencido {
  prestamo: Prestamo
  montoACobrar: number
  diasAtraso: number
}

/**
 * Vencidos: préstamos vigentes cuya fecha de cobro del mes YA pasó y sin pago
 * en el ciclo. Mismo criterio que marcar_mora() en SQL. Ordenados por atraso.
 */
export function calcularVencidos(
  prestamos: Prestamo[],
  movimientos: Movimiento[],
  cuotas: CuotaDB[],
  hoy: Date,
): CobroVencido[] {
  const hoyISO = isoLocal(hoy)
  const proxima = proximaCuotaPorPrestamo(cuotas)
  const items: CobroVencido[] = []

  for (const p of prestamos) {
    if (!esVigente(p)) continue
    if (p.tipo === 'cuotas') {
      const c = proxima.get(p.id)
      if (c && c.fecha_vence < hoyISO) {
        items.push({
          prestamo: p,
          montoACobrar: c.capital + c.interes,
          diasAtraso: diasDeAtraso(c.fecha_vence, hoy),
        })
      }
    } else if (p.tipo === 'cuota_fija') {
      // Cuota fija: vencida si su próxima cuota no saldada quedó atrás. Sin recargo
      // por mora (Luis la maneja aparte): es solo el recordatorio de cobro.
      const c = proxima.get(p.id)
      if (c && c.fecha_vence < hoyISO) {
        items.push({
          prestamo: p,
          montoACobrar: c.capital - c.abonado,
          diasAtraso: diasDeAtraso(c.fecha_vence, hoy),
        })
      }
    } else {
      const cobroISO = fechaCobroDelMes(p, hoy)
      if (cobroISO < hoyISO && !pagadoEnCiclo(movimientos, p.id, cobroISO)) {
        items.push({
          prestamo: p,
          montoACobrar: interesVigente(p),
          diasAtraso: diasDeAtraso(cobroISO, hoy),
        })
      }
    }
  }

  return items.sort((a, b) => b.diasAtraso - a.diasAtraso)
}

/** Préstamos vigentes ordenados por saldo descendente (top deudores). */
export function topDeudores(prestamos: Prestamo[], limite = 5): Prestamo[] {
  return prestamos
    .filter(esVigente)
    .sort((a, b) => b.saldo_capital - a.saldo_capital)
    .slice(0, limite)
}
