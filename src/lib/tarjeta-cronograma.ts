// Tarjeta de cronograma del préstamo como imagen (PNG) generada en el navegador.
//
// Es una imagen NUEVA, distinta del comprobante de pago: resume el préstamo y
// su cronograma para compartirla por WhatsApp con el cliente. Reutiliza el mismo
// mecanismo de comprobante.ts (canvas + fuentes + escalado por devicePixelRatio +
// compartir/descargar), pero con altura VARIABLE: depende del nº de cuotas y de
// en cuántas columnas se reparten.
//
// Mismo contenido para cliente y cobrador. NO muestra saldo ni total a pagar en
// los préstamos por cuotas (decisión: solo capital prestado + avance); el préstamo
// "abierto" —que no tiene cuotas— sí muestra saldo y condiciones.

import {
  asegurarFuentes,
  compartirODescargarPNG,
  envolverTexto,
  rectRedondeado,
  slugCliente,
  COLOR,
  FUENTE_MONO,
  FUENTE_UI,
} from '@/lib/comprobante'
import { fmtCOP, fmtFecha } from '@/lib/formatters'

/** Una cuota tal como la dibuja la grilla (estado en palabra + color). */
export interface CuotaTarjeta {
  numero: number
  /** Fecha de vencimiento en crudo ('aaaa-mm-dd'); se formatea al dibujar. */
  fechaVence: string
  /** Estado de la cuota: 'pagada' | 'pendiente' | 'parcial' | 'vencida'. */
  estado: string
}

interface DatosTarjetaBase {
  negocio: string
  cliente: string
  fechaEmision: Date | string
}

/** Préstamo con cronograma ('cuotas' o 'cuota_fija'): grilla de cuotas. */
export interface DatosTarjetaCronograma extends DatosTarjetaBase {
  variante: 'cronograma'
  capital: number
  nCuotas: number
  /** Valor de una cuota; 0 → se omite el "de $valor". */
  valorCuota: number
  /** Cuotas pagadas (para el avance X / N). */
  pagadas: number
  /** Fecha de la próxima cuota pendiente en crudo, o null si está al día. */
  proximaFecha: string | null
  cuotas: CuotaTarjeta[]
}

/** Préstamo 'abierto': sin cuotas; muestra saldo y condiciones. */
export interface DatosTarjetaAbierto extends DatosTarjetaBase {
  variante: 'abierto'
  capital: number
  saldo: number
  tasaTexto: string
  modoTexto: string
}

export type DatosTarjeta = DatosTarjetaCronograma | DatosTarjetaAbierto

const AVISO = 'Si se pasa de la fecha acordada se cobra un valor adicional.'

const W = 760 // ancho lógico (un poco más que el comprobante, para las columnas)
const PAD = 48
const CONTENT_W = W - PAD * 2
const HEADER_H = 132
const TOP = 40 // padding superior del cuerpo
const BOTTOM = 40 // padding inferior

// Grilla de cuotas
const GAP = 20 // separación entre columnas
const HEADER_FILA_H = 26 // alto del encabezado "# Vence Estado"
const FILA_H = 30 // alto de cada fila de cuota

/**
 * Nº de columnas según la cantidad de cuotas, para aprovechar el ancho y que la
 * imagen no quede como una lista vertical larguísima:
 * ≤12 → 1 col · 13–24 → 2 col · 25+ → 3 col.
 */
function numColumnas(n: number): number {
  if (n <= 12) return 1
  if (n <= 24) return 2
  return 3
}

/** Estado de la cuota a palabra + color del design-system. */
function estiloEstado(estado: string): { palabra: string; color: string } {
  switch (estado) {
    case 'pagada':
      return { palabra: 'Pagado', color: COLOR.green700 }
    case 'parcial':
      return { palabra: 'Parcial', color: COLOR.amber }
    case 'vencida':
      return { palabra: 'Vencida', color: COLOR.red }
    default:
      return { palabra: 'Pendiente', color: COLOR.muted }
  }
}

/** Dibuja la grilla de cuotas repartida en columnas. Devuelve el alto consumido. */
function dibujarGrilla(
  ctx: CanvasRenderingContext2D,
  cuotas: CuotaTarjeta[],
  yTop: number,
): number {
  const cols = numColumnas(cuotas.length)
  const filasPorCol = Math.ceil(cuotas.length / cols)
  const colW = (CONTENT_W - (cols - 1) * GAP) / cols
  // Sub-posiciones dentro de una columna: número (izq), fecha, estado (der).
  const xFechaRel = 30

  for (let i = 0; i < cuotas.length; i++) {
    const col = Math.floor(i / filasPorCol)
    const fila = i % filasPorCol
    const x0 = PAD + col * (colW + GAP)
    const cuota = cuotas[i]

    // Encabezado de cada columna ("# Vence Estado"), una vez por columna.
    if (fila === 0) {
      ctx.font = `700 11px ${FUENTE_UI}`
      ctx.fillStyle = COLOR.muted
      ctx.letterSpacing = '0.5px'
      ctx.textAlign = 'left'
      ctx.fillText('#', x0, yTop + 14)
      ctx.fillText('VENCE', x0 + xFechaRel, yTop + 14)
      ctx.textAlign = 'right'
      ctx.fillText('ESTADO', x0 + colW, yTop + 14)
      ctx.letterSpacing = '0px'
    }

    const yFila = yTop + HEADER_FILA_H + fila * FILA_H + 20
    ctx.textAlign = 'left'
    ctx.font = `600 13px ${FUENTE_UI}`
    ctx.fillStyle = COLOR.text2
    ctx.fillText(String(cuota.numero), x0, yFila)
    ctx.font = `500 13px ${FUENTE_UI}`
    ctx.fillStyle = COLOR.ink
    ctx.fillText(fmtFecha(cuota.fechaVence), x0 + xFechaRel, yFila)
    const { palabra, color } = estiloEstado(cuota.estado)
    ctx.textAlign = 'right'
    ctx.font = `700 12px ${FUENTE_UI}`
    ctx.fillStyle = color
    ctx.fillText(palabra, x0 + colW, yFila)
  }

  return HEADER_FILA_H + filasPorCol * FILA_H
}

function dibujarTarjeta(datos: DatosTarjeta): HTMLCanvasElement {
  // ── Paso 1: medir lo de altura variable (cliente y aviso envueltos) ──
  const medidor = document.createElement('canvas').getContext('2d')
  if (!medidor) throw new Error('No se pudo preparar el lienzo del cronograma.')

  medidor.font = `700 22px ${FUENTE_UI}`
  const lineasCliente = envolverTexto(medidor, datos.cliente, CONTENT_W)
  medidor.font = `500 14px ${FUENTE_UI}`
  const lineasAviso = envolverTexto(medidor, AVISO, CONTENT_W - 36)

  const RESUMEN_H = datos.variante === 'cronograma' ? 150 : 116
  const avisoH = lineasAviso.length * 22 + 28

  // Alto del cuerpo, sumando en el mismo orden en que se dibuja.
  let cuerpoH = 30 // fila "Emitido"
  cuerpoH += 18 + lineasCliente.length * 30 + 16 // etiqueta CLIENTE + nombre
  cuerpoH += RESUMEN_H + 28 // caja resumen

  if (datos.variante === 'cronograma') {
    cuerpoH += 26 // título "Cronograma"
    const filasPorCol = Math.ceil(datos.cuotas.length / numColumnas(datos.cuotas.length))
    cuerpoH += HEADER_FILA_H + filasPorCol * FILA_H + 18
  } else {
    cuerpoH += 26 // título "Condiciones"
    cuerpoH += 2 * 34 + 8 // tasa + modo
  }
  cuerpoH += avisoH

  const H = HEADER_H + TOP + cuerpoH + BOTTOM

  // ── Paso 2: lienzo real, escalado por dpr para nitidez en retina/móvil ──
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo del cronograma.')
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'alphabetic'

  // Fondo
  ctx.fillStyle = COLOR.card
  ctx.fillRect(0, 0, W, H)

  // ── Encabezado verde ──
  ctx.fillStyle = COLOR.green
  ctx.fillRect(0, 0, W, HEADER_H)
  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR.blanco
  ctx.font = `800 30px ${FUENTE_UI}`
  ctx.fillText(`Préstamo ${datos.negocio}`, W / 2, 70, CONTENT_W)
  ctx.font = `700 14px ${FUENTE_UI}`
  ctx.letterSpacing = '2px'
  ctx.globalAlpha = 0.92
  ctx.fillText(
    datos.variante === 'cronograma' ? 'CRONOGRAMA DE PAGOS' : 'ESTADO DEL CRÉDITO',
    W / 2,
    104,
  )
  ctx.globalAlpha = 1
  ctx.letterSpacing = '0px'

  let y = HEADER_H + TOP

  // ── Emitido ──
  ctx.font = `600 13px ${FUENTE_UI}`
  ctx.fillStyle = COLOR.muted
  ctx.textAlign = 'right'
  ctx.fillText(`Emitido ${fmtFecha(datos.fechaEmision)}`, W - PAD, y)
  y += 30

  // ── Cliente ──
  ctx.textAlign = 'left'
  ctx.font = `600 12px ${FUENTE_UI}`
  ctx.fillStyle = COLOR.muted
  ctx.letterSpacing = '1px'
  ctx.fillText('CLIENTE', PAD, y)
  ctx.letterSpacing = '0px'
  y += 18
  ctx.font = `700 22px ${FUENTE_UI}`
  ctx.fillStyle = COLOR.ink
  for (const linea of lineasCliente) {
    ctx.fillText(linea, PAD, y + 14)
    y += 30
  }
  y += 16

  // ── Caja resumen ──
  ctx.fillStyle = COLOR.greenTint
  rectRedondeado(ctx, PAD, y, CONTENT_W, RESUMEN_H, 18)
  ctx.fill()

  if (datos.variante === 'cronograma') {
    ctx.textAlign = 'left'
    ctx.fillStyle = COLOR.green700
    ctx.font = `700 12px ${FUENTE_UI}`
    ctx.letterSpacing = '1.5px'
    ctx.fillText('PRESTADO', PAD + 24, y + 34)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = COLOR.ink
    ctx.font = `700 34px ${FUENTE_MONO}`
    ctx.fillText(fmtCOP(datos.capital), PAD + 24, y + 78, CONTENT_W - 48)
    ctx.fillStyle = COLOR.text2
    ctx.font = `500 15px ${FUENTE_UI}`
    const lineaCuotas =
      datos.valorCuota > 0
        ? `${datos.nCuotas} cuotas de ${fmtCOP(datos.valorCuota)}`
        : `${datos.nCuotas} cuotas`
    ctx.fillText(lineaCuotas, PAD + 24, y + 106)
    // Avance
    const proxima = datos.proximaFecha
      ? ` · próxima ${fmtFecha(datos.proximaFecha)}`
      : ' · al día'
    ctx.fillStyle = COLOR.green700
    ctx.font = `700 15px ${FUENTE_UI}`
    ctx.fillText(`${datos.pagadas} / ${datos.nCuotas}${proxima}`, PAD + 24, y + 132)
  } else {
    // Abierto: capital prestado a la izquierda, saldo actual a la derecha.
    const mitad = W / 2
    ctx.textAlign = 'left'
    ctx.fillStyle = COLOR.green700
    ctx.font = `700 12px ${FUENTE_UI}`
    ctx.letterSpacing = '1.5px'
    ctx.fillText('PRESTADO', PAD + 24, y + 34)
    ctx.fillText('SALDO ACTUAL', mitad + 12, y + 34)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = COLOR.ink
    ctx.font = `700 26px ${FUENTE_MONO}`
    ctx.fillText(fmtCOP(datos.capital), PAD + 24, y + 78, mitad - PAD - 36)
    ctx.fillText(fmtCOP(datos.saldo), mitad + 12, y + 78, mitad - PAD - 36)
  }
  y += RESUMEN_H + 28

  if (datos.variante === 'cronograma') {
    // ── Título + grilla ──
    ctx.textAlign = 'left'
    ctx.font = `700 14px ${FUENTE_UI}`
    ctx.fillStyle = COLOR.ink
    ctx.fillText('Cronograma de cuotas', PAD, y)
    y += 26
    const usado = dibujarGrilla(ctx, datos.cuotas, y)
    y += usado + 18
  } else {
    // ── Condiciones (tasa + modo) ──
    ctx.textAlign = 'left'
    ctx.font = `700 14px ${FUENTE_UI}`
    ctx.fillStyle = COLOR.ink
    ctx.fillText('Condiciones', PAD, y)
    y += 26
    const filas = [
      { etiqueta: 'Tasa mensual', valor: datos.tasaTexto },
      { etiqueta: 'Modo de interés', valor: datos.modoTexto },
    ]
    for (const fila of filas) {
      ctx.textAlign = 'left'
      ctx.font = `500 15px ${FUENTE_UI}`
      ctx.fillStyle = COLOR.text2
      ctx.fillText(fila.etiqueta, PAD, y)
      ctx.textAlign = 'right'
      ctx.font = `700 15px ${FUENTE_UI}`
      ctx.fillStyle = COLOR.ink
      ctx.fillText(fila.valor, W - PAD, y)
      y += 34
    }
    y += 8
  }

  // ── Aviso ──
  ctx.fillStyle = COLOR.amberTint
  rectRedondeado(ctx, PAD, y, CONTENT_W, avisoH, 12)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR.amber
  ctx.font = `500 14px ${FUENTE_UI}`
  let ly = y + 26
  for (const linea of lineasAviso) {
    ctx.fillText(linea, W / 2, ly)
    ly += 22
  }

  return canvas
}

/** Genera el PNG de la tarjeta (asegura las fuentes antes de dibujar). */
export async function generarPNGTarjeta(datos: DatosTarjeta): Promise<Blob> {
  await asegurarFuentes()
  const canvas = dibujarTarjeta(datos)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo generar la imagen del cronograma.')
  return blob
}

/**
 * Genera la tarjeta de cronograma y la comparte (móvil → WhatsApp) o la descarga
 * (escritorio). Lanza si la generación falla; el llamador muestra el toast.
 */
export async function compartirODescargarTarjeta(
  datos: DatosTarjeta,
  nombreArchivo: string,
): Promise<void> {
  const blob = await generarPNGTarjeta(datos)
  await compartirODescargarPNG(blob, nombreArchivo, {
    title: 'Cronograma del préstamo',
    text: `Cronograma del préstamo — ${datos.negocio}`,
  })
}

/** Nombre de archivo del PNG de la tarjeta, derivado del nombre del cliente. */
export function nombreArchivoTarjeta(cliente: string): string {
  return `cronograma-${slugCliente(cliente)}.png`
}
