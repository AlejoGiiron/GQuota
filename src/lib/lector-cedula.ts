/**
 * Lector del PDF417 de la cédula en el NAVEGADOR (zxing-wasm): del prospecto (foto
 * o escáner en vivo) y del dueño (relectura de la 1C).
 *
 * - Se carga solo cuando se usa (import dinámico): no entra al bundle de la app.
 * - El .wasm se sirve desde NUESTRO dominio (asset del build de Vite), nunca del
 *   CDN que zxing-wasm usa por defecto.
 * - Foto: escalera de intentos con tope de tiempo (src/lib/plan-lectura.ts).
 * - El contenido crudo del código nunca sale de aquí: se pasa a leerCamposCedula,
 *   que devuelve solo los campos y borra la huella del buffer.
 */
import { leerCamposCedula, type CamposCedula } from '@/lib/cedula'
import { LADO_RECORTE, cajaConMargen, planDeLectura, type Binarizador, type Caja } from '@/lib/plan-lectura'

type Zxing = typeof import('zxing-wasm/reader')
type Resultado = Awaited<ReturnType<Zxing['readBarcodes']>>[number]
let zxing: Promise<Zxing> | null = null

function cargarZxing(): Promise<Zxing> {
  zxing ??= Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]).then(
    ([modulo, { default: wasmUrl }]) => {
      modulo.prepareZXingModule({
        overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith('.wasm') ? wasmUrl : prefijo + ruta) },
      })
      return modulo
    },
  )
  return zxing
}

/** Tope de tiempo de la escalera de una foto (luego: "no se pudo leer"). */
export const PRESUPUESTO_FOTO_MS = 10_000

/** De los resultados, los campos del primero válido; borra los bytes (huella incluida). */
function campos(resultados: Resultado[]): CamposCedula | null {
  for (const r of resultados) {
    if (!r.isValid) continue
    const c = leerCamposCedula(r.bytes) // borra la huella de r.bytes
    r.bytes.fill(0)
    if (c) return c
  }
  return null
}

type Fuente = CanvasImageSource & { width: number; height: number }
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function lienzo(ancho: number, alto: number): Ctx | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(ancho, alto).getContext('2d', { willReadFrequently: true })
  }
  const c = document.createElement('canvas')
  c.width = ancho
  c.height = alto
  return c.getContext('2d', { willReadFrequently: true })
}

/** Dibuja la fuente (o una caja de ella) escalada y girada, sobre blanco. */
export function dibujarParaLector(fuente: Fuente, escala: number, grados: number, caja?: Caja): ImageData | null {
  const sx = caja?.x ?? 0
  const sy = caja?.y ?? 0
  const sw = caja?.ancho ?? fuente.width
  const sh = caja?.alto ?? fuente.height
  const w = Math.max(1, Math.round(sw * escala))
  const h = Math.max(1, Math.round(sh * escala))
  const rad = (grados * Math.PI) / 180
  const cw = Math.round(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)))
  const ch = Math.round(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)))
  const ctx = lienzo(cw, ch)
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, cw, ch)
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate(rad)
  ctx.drawImage(fuente, sx, sy, sw, sh, -w / 2, -h / 2, w, h)
  return ctx.getImageData(0, 0, cw, ch)
}

/** Gris con el contraste estirado (percentiles 1 y 99), sobre el mismo ImageData. */
export function grisParaLector(img: ImageData): ImageData {
  const d = img.data
  const n = d.length / 4
  const hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    const g = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8
    d[i * 4] = g
    hist[g]++
  }
  let acc = 0
  let lo = 0
  let hi = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc <= n * 0.01) lo = v
    if (acc <= n * 0.99) hi = v
  }
  const rango = Math.max(1, hi - lo)
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((d[i * 4] - lo) * 255) / rango)))
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v
  }
  return img
}

const cederTurno = () => new Promise((ok) => setTimeout(ok, 0))

/**
 * Lee los campos de una imagen ya decodificada con la escalera de intentos.
 * null si no se pudo dentro del presupuesto (nunca lanza).
 */
export async function leerCedulaDeImagen(fuente: Fuente, presupuestoMs = PRESUPUESTO_FOTO_MS): Promise<CamposCedula | null> {
  try {
    const { readBarcodes } = await cargarZxing()
    const inicio = performance.now()
    let caja: Caja | null = null
    let primero = true
    for (const intento of planDeLectura(fuente.width, fuente.height)) {
      if (performance.now() - inicio > presupuestoMs) break
      if (intento.recorte && !caja) continue
      const escala = intento.recorte && caja ? Math.min(3, LADO_RECORTE / Math.max(caja.ancho, caja.alto)) : intento.escala
      const img = dibujarParaLector(fuente, escala, intento.grados, intento.recorte ? (caja ?? undefined) : undefined)
      if (!img) continue
      const resultados = await readBarcodes(intento.prep === 'gris' ? grisParaLector(img) : img, {
        formats: ['PDF417'],
        tryHarder: true,
        tryRotate: true,
        tryInvert: false,
        tryDownscale: true,
        binarizer: intento.binarizador,
        // El primer intento pide también lo detectado con error: de ahí sale el recorte.
        returnErrors: primero,
        maxNumberOfSymbols: 1,
      })
      if (primero) {
        primero = false
        const visto = resultados.find((r) => !r.isValid && r.format === 'PDF417')
        if (visto) {
          const p = visto.position
          caja = cajaConMargen([p.topLeft, p.topRight, p.bottomLeft, p.bottomRight], img.width, img.height)
        }
      }
      const c = campos(resultados)
      if (c) return c
      await cederTurno() // la pantalla sigue respondiendo en el celular
    }
    return null
  } catch {
    // Ningún error de lectura bloquea: el prospecto elige cómo seguir.
    return null
  }
}

/** Abre una foto con su orientación EXIF. null si el navegador no la decodifica (p. ej. HEIC). */
export async function abrirFoto(foto: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(foto, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
}

/** Lee los campos de la foto del respaldo; null si no se pudo (nunca lanza). */
export async function leerCedulaDeFoto(foto: Blob, presupuestoMs = PRESUPUESTO_FOTO_MS): Promise<CamposCedula | null> {
  const bitmap = await abrirFoto(foto)
  if (!bitmap) return null
  try {
    return await leerCedulaDeImagen(bitmap, presupuestoMs)
  } finally {
    bitmap.close()
  }
}

/**
 * Un cuadro del escáner en vivo: un intento rápido (el cuadro siguiente prueba
 * otro binarizador y otra escala). null si no leyó.
 */
export async function leerCedulaDeCuadro(img: ImageData, binarizador: Binarizador): Promise<CamposCedula | null> {
  try {
    const { readBarcodes } = await cargarZxing()
    const resultados = await readBarcodes(img, {
      formats: ['PDF417'],
      tryHarder: true,
      tryRotate: true,
      tryInvert: false,
      tryDownscale: true,
      binarizer: binarizador,
      maxNumberOfSymbols: 1,
    })
    return campos(resultados)
  } catch {
    return null
  }
}

/** Precarga zxing (al abrir la cámara, para que el primer cuadro no espere). */
export function precargarLector(): void {
  void cargarZxing()
}
