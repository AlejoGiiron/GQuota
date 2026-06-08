// Comprobante de pago como imagen (PNG) generada en el navegador.
//
// Es un recibo maquetado que el prestamista comparte con el cliente por WhatsApp
// (le llega como foto). Se dibuja en un <canvas> para tener control total de la
// estética del design-system y nitidez garantizada (escalado por devicePixelRatio),
// sin depender de librerías de captura del DOM (que en Safari móvil —el caso de uso—
// son flojas con fuentes e imágenes en blanco).
//
// Lo ve el CLIENTE: simple, SIN desglose interés/capital (info interna del negocio).

import { fmtCOP } from '@/lib/formatters'

/** Una fila etiqueta/valor del bloque "estado de su crédito". */
export interface FilaComprobante {
  etiqueta: string
  valor: string
}

export interface DatosComprobante {
  /** Nombre del negocio (de configuración). */
  negocio: string
  cliente: string
  /** Referencia corta del préstamo (ver referenciaPrestamo). */
  referencia: string
  /** Fecha en que se genera el comprobante (dd/mm/aaaa). */
  fechaEmision: string
  /** Monto pagado (se muestra grande y destacado). */
  monto: number
  /** Fecha del pago (dd/mm/aaaa). */
  fechaPago: string
  /** Etiqueta del método de pago (Efectivo, Nequi…). */
  metodo: string
  /** Estado del crédito tras el pago (saldo / cuotas restantes…). */
  estado: FilaComprobante[]
  /** Mensaje cordial destacado, p. ej. al saldar el crédito. */
  mensajeEstado?: string | null
  /** Nota de pie en tono "usted". */
  pie: string
}

// ── Colores del design-system (src/index.css :root). No inventar. ──
const COLOR = {
  card: '#ffffff',
  green: '#047857',
  green700: '#036249',
  greenTint: '#ecfdf5',
  ink: '#16241f',
  text2: '#475a53',
  muted: '#8b9a93',
  line: '#ece8e1',
  blanco: '#ffffff',
} as const

const FUENTE_UI = "'Plus Jakarta Sans', system-ui, sans-serif"
const FUENTE_MONO = "'JetBrains Mono', ui-monospace, monospace"

const W = 720 // ancho lógico del ticket (vertical, se ve bien en un chat)
const PAD = 56
const CONTENT_W = W - PAD * 2

/**
 * Pide al navegador que cargue las fuentes del design-system ANTES de dibujar.
 * Sin esto, el primer comprobante puede salir con la fuente por defecto (las web
 * fonts cargan async): es el equivalente en canvas a la "primera captura en blanco".
 */
async function asegurarFuentes(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`800 32px ${FUENTE_UI}`),
      document.fonts.load(`700 22px ${FUENTE_UI}`),
      document.fonts.load(`600 13px ${FUENTE_UI}`),
      document.fonts.load(`500 15px ${FUENTE_UI}`),
      document.fonts.load(`700 50px ${FUENTE_MONO}`),
    ])
    await document.fonts.ready
  } catch {
    /* si falla, se dibuja con las fuentes disponibles (degradación aceptable) */
  }
}

/** Parte un texto en líneas que caben en maxWidth, según la fuente activa del ctx. */
function envolverTexto(ctx: CanvasRenderingContext2D, texto: string, maxWidth: number): string[] {
  const palabras = texto.split(' ')
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra
    if (ctx.measureText(tentativa).width > maxWidth && actual) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = tentativa
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

function rectRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Dibuja el comprobante y devuelve el canvas. La altura se calcula según el
 * contenido (líneas envueltas del cliente, estado y pie).
 */
function dibujarComprobante(datos: DatosComprobante): HTMLCanvasElement {
  // ── Paso 1: medir para conocer la altura (líneas envueltas) ──
  const medidor = document.createElement('canvas').getContext('2d')
  if (!medidor) throw new Error('No se pudo preparar el lienzo del comprobante.')

  medidor.font = `700 22px ${FUENTE_UI}`
  const lineasCliente = envolverTexto(medidor, datos.cliente, CONTENT_W)

  let lineasMensaje: string[] = []
  if (datos.mensajeEstado) {
    medidor.font = `700 16px ${FUENTE_UI}`
    lineasMensaje = envolverTexto(medidor, datos.mensajeEstado, CONTENT_W - 48)
  }

  medidor.font = `500 14px ${FUENTE_UI}`
  const lineasPie = envolverTexto(medidor, datos.pie, CONTENT_W)

  const HEADER_H = 156
  const AMOUNT_H = 156
  const MENSAJE_H = lineasMensaje.length > 0 ? lineasMensaje.length * 26 + 28 : 0

  // Suma de la altura del cuerpo, en el mismo orden en que se dibuja abajo.
  let H = HEADER_H + 44 // header + padding superior del cuerpo
  H += 36 // fila referencia / emisión
  H += 22 + lineasCliente.length * 30 + 30 // etiqueta + nombre + separador
  H += AMOUNT_H + 36
  if (datos.estado.length > 0) H += 30 + datos.estado.length * 34 + 4
  if (MENSAJE_H > 0) H += MENSAJE_H + 24
  H += 30 // separador antes del pie
  H += lineasPie.length * 24
  H += 48 // padding inferior

  // ── Paso 2: lienzo real, escalado por dpr para nitidez en retina/móvil ──
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo del comprobante.')
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
  ctx.font = `800 32px ${FUENTE_UI}`
  ctx.fillText(datos.negocio, W / 2, 78, CONTENT_W)
  ctx.font = `700 15px ${FUENTE_UI}`
  ctx.letterSpacing = '2px'
  ctx.globalAlpha = 0.92
  ctx.fillText('COMPROBANTE DE PAGO', W / 2, 116)
  ctx.globalAlpha = 1
  ctx.letterSpacing = '0px'

  let y = HEADER_H + 44

  // ── Referencia / emisión ──
  ctx.font = `600 13px ${FUENTE_UI}`
  ctx.fillStyle = COLOR.muted
  ctx.textAlign = 'left'
  ctx.fillText(`Ref. ${datos.referencia}`, PAD, y)
  ctx.textAlign = 'right'
  ctx.fillText(`Emitido ${datos.fechaEmision}`, W - PAD, y)
  y += 36

  // ── Cliente ──
  ctx.textAlign = 'left'
  ctx.font = `600 12px ${FUENTE_UI}`
  ctx.fillStyle = COLOR.muted
  ctx.letterSpacing = '1px'
  ctx.fillText('CLIENTE', PAD, y)
  ctx.letterSpacing = '0px'
  y += 22
  ctx.font = `700 22px ${FUENTE_UI}`
  ctx.fillStyle = COLOR.ink
  for (const linea of lineasCliente) {
    ctx.fillText(linea, PAD, y + 14)
    y += 30
  }
  y += 18

  // Separador
  ctx.strokeStyle = COLOR.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 12

  // ── Bloque del monto ──
  ctx.fillStyle = COLOR.greenTint
  rectRedondeado(ctx, PAD, y, CONTENT_W, AMOUNT_H, 18)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR.green700
  ctx.font = `700 13px ${FUENTE_UI}`
  ctx.letterSpacing = '1.5px'
  ctx.fillText('PAGO RECIBIDO', W / 2, y + 42)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = COLOR.ink
  ctx.font = `700 50px ${FUENTE_MONO}`
  ctx.fillText(fmtCOP(datos.monto), W / 2, y + 100, CONTENT_W - 32)
  ctx.fillStyle = COLOR.text2
  ctx.font = `500 15px ${FUENTE_UI}`
  ctx.fillText(`${datos.fechaPago} · ${datos.metodo}`, W / 2, y + 134)
  y += AMOUNT_H + 36

  // ── Estado del crédito ──
  if (datos.estado.length > 0) {
    ctx.textAlign = 'left'
    ctx.font = `600 12px ${FUENTE_UI}`
    ctx.fillStyle = COLOR.muted
    ctx.letterSpacing = '1px'
    ctx.fillText('ESTADO DE SU CRÉDITO', PAD, y)
    ctx.letterSpacing = '0px'
    y += 30
    for (const fila of datos.estado) {
      ctx.textAlign = 'left'
      ctx.font = `500 15px ${FUENTE_UI}`
      ctx.fillStyle = COLOR.text2
      ctx.fillText(fila.etiqueta, PAD, y)
      ctx.textAlign = 'right'
      ctx.font = `700 16px ${FUENTE_UI}`
      ctx.fillStyle = COLOR.ink
      ctx.fillText(fila.valor, W - PAD, y)
      y += 34
    }
    y += 4
  }

  // ── Mensaje destacado (al día / cordial) ──
  if (lineasMensaje.length > 0) {
    const boxH = lineasMensaje.length * 26 + 28
    ctx.fillStyle = COLOR.greenTint
    rectRedondeado(ctx, PAD, y, CONTENT_W, boxH, 14)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillStyle = COLOR.green700
    ctx.font = `700 16px ${FUENTE_UI}`
    let ly = y + 26
    for (const linea of lineasMensaje) {
      ctx.fillText(linea, W / 2, ly)
      ly += 26
    }
    y += boxH + 24
  }

  // Separador
  ctx.strokeStyle = COLOR.line
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 30

  // ── Pie ──
  ctx.textAlign = 'center'
  ctx.font = `500 14px ${FUENTE_UI}`
  ctx.fillStyle = COLOR.muted
  for (const linea of lineasPie) {
    ctx.fillText(linea, W / 2, y)
    y += 24
  }

  return canvas
}

/** Genera el PNG del comprobante (asegura las fuentes antes de dibujar). */
export async function generarPNGComprobante(datos: DatosComprobante): Promise<Blob> {
  await asegurarFuentes()
  const canvas = dibujarComprobante(datos)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('No se pudo generar la imagen del comprobante.')
  return blob
}

/** ¿El navegador puede COMPARTIR archivos (Web Share con files)? Si no, se descarga. */
export function puedeCompartirImagen(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    const prueba = new File([new Uint8Array()], 'x.png', { type: 'image/png' })
    return navigator.canShare({ files: [prueba] })
  } catch {
    return false
  }
}

function descargar(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Genera el comprobante y lo comparte (Web Share, móvil → WhatsApp) o, si el
 * navegador no soporta compartir archivos (escritorio), lo descarga como PNG.
 * Lanza si la generación falla; el llamador muestra el toast de error.
 */
export async function compartirODescargarComprobante(
  datos: DatosComprobante,
  nombreArchivo: string,
): Promise<void> {
  const blob = await generarPNGComprobante(datos)
  const file = new File([blob], nombreArchivo, { type: 'image/png' })

  if (puedeCompartirImagen()) {
    try {
      await navigator.share({
        files: [file],
        title: 'Comprobante de pago',
        text: `Comprobante de pago — ${datos.negocio}`,
      })
      return
    } catch (e) {
      // El usuario canceló el menú de compartir: no descargamos por encima.
      if (e instanceof DOMException && e.name === 'AbortError') return
      // Cualquier otro fallo de compartir: caemos a descarga.
    }
  }
  descargar(blob, nombreArchivo)
}

/** Referencia corta y estable del préstamo a partir de su id (uuid). */
export function referenciaPrestamo(id: string): string {
  return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

/** Nombre de archivo del PNG, derivado del nombre del cliente. */
export function nombreArchivoComprobante(cliente: string): string {
  const slug = cliente
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `comprobante-${slug || 'cliente'}.png`
}
