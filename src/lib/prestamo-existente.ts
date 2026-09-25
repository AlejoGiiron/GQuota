/**
 * "Préstamo existente": un préstamo que ya venía pagándose antes de la app.
 * Lógica pura (con pruebas) para el formulario: fechas de cobro del abierto,
 * interés pendiente, resumen en vivo y aviso de atraso; y el texto de la ficha.
 *
 * Replica EXACTAMENTE lo que hace la RPC crear_prestamo_existente (migración 041)
 * y la regla de mora 2 con la fecha de Colombia: si cambia allá, cambiar aquí.
 */
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import type { Prestamo } from '@/types/db'

const ZONA_COLOMBIA = 'America/Bogota'
/** Días de gracia antes de que una cuota sin pagar ponga el préstamo en mora. */
const DIAS_GRACIA = 5

/** Fecha de hoy en Colombia (aaaa-mm-dd), la misma que usa la RPC. */
export function hoyColombia(ahora: Date = new Date()): string {
  // en-CA da el formato aaaa-mm-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_COLOMBIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Suma días a una fecha aaaa-mm-dd. */
export function sumarDias(fechaISO: string, n: number): string {
  const [y, m, d] = partes(fechaISO)
  const f = new Date(Date.UTC(y, m - 1, d + n))
  return iso(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate())
}

/** Suma meses con tope a fin de mes (igual que Postgres: fecha + n meses). */
export function sumarMeses(fechaISO: string, n: number): string {
  const [y, m, d] = partes(fechaISO)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const diasEnMes = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return iso(ny, nm, Math.min(d, diasEnMes))
}

/** Meses de calendario entre dos fechas (solo año y mes). */
export function mesesEntre(desdeISO: string, hastaISO: string): number {
  const [y1, m1] = partes(desdeISO)
  const [y2, m2] = partes(hastaISO)
  return y2 * 12 + m2 - (y1 * 12 + m1)
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  const [y1, m1, d1] = partes(desdeISO)
  const [y2, m2, d2] = partes(hastaISO)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

// ─────────────────────────── Abierto ───────────────────────────

/**
 * Cobros de interés del abierto que ya ocurrieron (hasta hoy, inclusive), del más
 * reciente al más antiguo. El cobro es el día del desembolso de cada mes siguiente
 * (acotado a fin de mes). Son las opciones de "Último cobro que le pagaron".
 */
export function cobrosPasados(fechaDesembolso: string, hoyISO: string): string[] {
  const cobros: string[] = []
  for (let k = 1; k <= mesesEntre(fechaDesembolso, hoyISO); k++) {
    const cobro = sumarMeses(fechaDesembolso, k)
    if (cobro <= hoyISO) cobros.push(cobro)
  }
  return cobros.reverse()
}

/** Próximo cobro de interés del abierto, después de hoy. */
export function proximoCobro(fechaDesembolso: string, hoyISO: string): string {
  let k = 1
  while (sumarMeses(fechaDesembolso, k) <= hoyISO) k++
  return sumarMeses(fechaDesembolso, k)
}

const redondear2 = (x: number) => Math.round(x * 100) / 100

export interface DatosAbierto {
  capital: number
  /** Saldo de capital de hoy (el capital, o menos si ya abonó a capital). */
  saldo: number
  /** Tasa mensual en decimal (0.10 = 10%). */
  tasa: number
  modo: 'sobre_saldo' | 'sobre_capital_inicial'
  fechaDesembolso: string
  /** Último cobro de intereses pagado; null = ninguno. */
  pagadoHasta: string | null
  hoy: string
}

/**
 * Interés pendiente de hoy, como si los pagos se hubieran registrado en la app:
 * el primer periodo se carga al crear (redondeado al peso) y se devenga uno más
 * cada 1.º de mes (a 2 decimales, sobre el saldo o sobre el monto); se restan
 * los cobros pagados.
 */
export function interesPendienteAbierto(d: DatosAbierto): number {
  const devengados = mesesEntre(d.fechaDesembolso, d.hoy) + 1
  const pagados = d.pagadoHasta ? mesesEntre(d.fechaDesembolso, d.pagadoHasta) : 0
  const base = d.modo === 'sobre_saldo' ? d.saldo : d.capital
  let total = 0
  for (let i = pagados + 1; i <= devengados; i++) {
    total += i === 1 ? Math.round(d.capital * d.tasa) : redondear2(base * d.tasa)
  }
  return redondear2(total)
}

/** Cobro del mes en curso (el día del desembolso, acotado a fin de mes). */
function cobroDelMes(fechaDesembolso: string, hoyISO: string): string {
  return sumarMeses(fechaDesembolso, mesesEntre(fechaDesembolso, hoyISO))
}

export interface ResumenAbierto {
  interesPendiente: number
  abonadoCapital: number
  proximoCobro: string
  /** Mismo criterio que marcar_mora (regla 2): el cobro de este mes ya pasó y no está pagado. */
  enMora: boolean
  /** Cobros ya ocurridos (antes de hoy) que quedan sin pagar, del más antiguo al más reciente. */
  cobrosSinPagar: string[]
}

export function resumenAbierto(d: DatosAbierto): ResumenAbierto {
  const cobroMes = cobroDelMes(d.fechaDesembolso, d.hoy)
  const pagadoHasta = d.pagadoHasta ?? ''
  return {
    interesPendiente: interesPendienteAbierto(d),
    abonadoCapital: d.capital - d.saldo,
    proximoCobro: proximoCobro(d.fechaDesembolso, d.hoy),
    enMora: cobroMes < d.hoy && cobroMes > d.fechaDesembolso && cobroMes > pagadoHasta,
    cobrosSinPagar: cobrosPasados(d.fechaDesembolso, d.hoy)
      .filter((c) => c < d.hoy && c > pagadoHasta)
      .reverse(),
  }
}

// ─────────────────────── Cuotas y cuota fija ───────────────────────

export interface CuotaPrevista {
  numero: number
  /** Vencimiento aaaa-mm-dd. */
  fecha: string
  /** Valor de la cuota (cuotas: capital + interés; cuota fija: el valor fijo). */
  valor: number
}

export type AtrasoCuota = 'al_dia' | 'vencida' | 'mora'

export interface ResumenCuotas {
  pagadoAntes: number
  cuotasRestantes: number
  /** Lo que falta por pagar (valor de las cuotas que quedan, menos el abono). */
  saldo: number
  /** Primera cuota sin pagar completa: su número, vencimiento y lo que le falta. */
  proxima: { numero: number; fecha: string; falta: number } | null
  /** Estado de esa cuota hoy (regla 2): vencida = ya pasó; mora = más de 5 días. */
  atraso: AtrasoCuota
  diasAtraso: number
  /** Cuotas sin pagar completas con vencimiento anterior a hoy. */
  cuotasAtrasadas: number
}

/** Resumen de un préstamo de cuotas o de cuota fija con N cuotas pagadas (y un abono a la siguiente). */
export function resumenCuotas(cuotas: ReadonlyArray<CuotaPrevista>, pagadas: number, abono: number, hoy: string): ResumenCuotas {
  const pagadasLista = cuotas.slice(0, pagadas)
  const quedan = cuotas.slice(pagadas)
  const pagadoAntes = pagadasLista.reduce((s, c) => s + c.valor, 0) + abono
  const siguiente = quedan[0]
  const diasAtraso = siguiente && siguiente.fecha < hoy ? diasEntre(siguiente.fecha, hoy) : 0
  return {
    pagadoAntes,
    cuotasRestantes: quedan.length,
    saldo: quedan.reduce((s, c) => s + c.valor, 0) - abono,
    proxima: siguiente ? { numero: siguiente.numero, fecha: siguiente.fecha, falta: siguiente.valor - abono } : null,
    atraso: diasAtraso > DIAS_GRACIA ? 'mora' : diasAtraso > 0 ? 'vencida' : 'al_dia',
    diasAtraso,
    cuotasAtrasadas: quedan.filter((c) => c.fecha < hoy).length,
  }
}

// ─────────────────────── Aviso antes de guardar ───────────────────────

export interface Aviso {
  tono: 'ok' | 'atraso' | 'mora'
  texto: string
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

/** Aviso de cuotas y cuota fija: si con lo declarado queda algo atrasado, se dice antes de guardar. */
export function avisoCuotas(r: ResumenCuotas, abono: number): Aviso {
  if (!r.proxima || r.atraso === 'al_dia') return { tono: 'ok', texto: 'Queda al día.' }
  const cuota = `La cuota N.º ${r.proxima.numero} del ${fmtFecha(r.proxima.fecha)} queda ${abono > 0 ? 'sin completar' : 'sin pagar'}`
  const otras = r.cuotasAtrasadas > 1 ? ` En total quedan ${r.cuotasAtrasadas} cuotas atrasadas.` : ''
  if (r.atraso === 'mora') {
    return { tono: 'mora', texto: `${cuota} y tiene ${r.diasAtraso} días de atraso: el préstamo entra en mora.${otras}` }
  }
  return {
    tono: 'atraso',
    texto: `${cuota}: sale en Cobros como vencida y el préstamo entra en mora si pasan más de ${DIAS_GRACIA} días.${otras}`,
  }
}

/** Aviso del abierto: cobros de interés que quedan sin pagar y si entra en mora. */
export function avisoAbierto(r: ResumenAbierto): Aviso {
  const n = r.cobrosSinPagar.length
  if (n === 0) return { tono: 'ok', texto: 'Queda al día.' }
  const incluye = n === 1 ? 'el interés pendiente lo incluye' : 'el interés pendiente los incluye'
  if (r.enMora) {
    const ultimo = r.cobrosSinPagar[n - 1]
    const otros = n > 1 ? ` En total quedan ${plural(n, 'cobro', 'cobros')} de interés sin pagar; ${incluye}.` : ''
    return { tono: 'mora', texto: `El cobro del ${fmtFecha(ultimo)} queda sin pagar: el préstamo entra en mora.${otros}` }
  }
  return {
    tono: 'atraso',
    texto: `Queda ${n === 1 ? '1 cobro' : `${n} cobros`} de interés sin pagar (desde el ${fmtFecha(r.cobrosSinPagar[0])}); ${incluye}.`,
  }
}

// ─────────────────────────── Ficha ───────────────────────────

/** ¿El préstamo se cargó como existente (con lo que ya había pagado)? */
export function esExistente(p: Pick<Prestamo, 'cuotas_pagadas_antes'>): boolean {
  return p.cuotas_pagadas_antes !== null
}

/** Línea de la ficha: qué pagó antes de registrarlo en la app. Null si no es existente. */
export function textoHistorial(
  p: Pick<Prestamo, 'tipo' | 'cuotas_pagadas_antes' | 'pagado_antes' | 'interes_pagado_hasta' | 'valor_cuota'>,
): string | null {
  if (p.cuotas_pagadas_antes === null) return null
  const n = p.cuotas_pagadas_antes
  const pagado = p.pagado_antes ?? 0
  const final = 'antes de registrarlo en la app.'

  if (p.tipo === 'abierto') {
    const intereses = p.interes_pagado_hasta
      ? `intereses pagados hasta el ${fmtFecha(p.interes_pagado_hasta)}`
      : 'sin cobros de interés pagados'
    const capital = pagado > 0 ? ` y ${fmtCOP(pagado)} abonados a capital` : ''
    return `Cargado con historial: ${intereses}${capital} ${final}`
  }

  const cuotas = n === 1 ? '1 cuota' : `${n} cuotas`
  if (n === 0 && pagado === 0) return `Cargado con historial: sin cuotas pagadas ${final}`
  if (p.tipo === 'cuota_fija') {
    const abono = pagado - n * (p.valor_cuota ?? 0)
    if (abono > 0) {
      const base = n === 0 ? `abonó ${fmtCOP(abono)} a la primera cuota` : `pagó ${cuotas} y abonó ${fmtCOP(abono)} a la siguiente`
      return `Cargado con historial: ${base} (${fmtCOP(pagado)} en total) ${final}`
    }
  }
  return `Cargado con historial: pagó ${cuotas} (${fmtCOP(pagado)}) ${final}`
}
