/**
 * Lector del PDF417 de la cédula en el NAVEGADOR del prospecto (zxing-wasm).
 *
 * - Se carga solo cuando se usa (import dinámico): no entra al bundle de la app.
 * - El .wasm se sirve desde NUESTRO dominio (asset del build de Vite), nunca del
 *   CDN que zxing-wasm usa por defecto.
 * - Lee sobre la imagen a resolución completa, ANTES de comprimir.
 * - El contenido crudo del código nunca sale de aquí: se pasa a leerCamposCedula,
 *   que devuelve solo los campos y borra la huella del buffer.
 */
import { leerCamposCedula, type CamposCedula } from '@/lib/cedula'

type Zxing = typeof import('zxing-wasm/reader')
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

// Enderezado: zxing solo prueba giros de 90° y el PDF417 falla con pocos grados
// de inclinación (autoprueba del 2026-09-24). Se prueban giros pequeños.
const GIROS = [0, -4, 4, -8, 8, -12, 12]
/** Los intentos girados trabajan sobre una copia reducida para no tardar en el celular. */
const LADO_GIRADO = 2000

/** Lee los campos de la foto del respaldo; null si no se pudo (nunca lanza). */
export async function leerCedulaDeFoto(foto: Blob): Promise<CamposCedula | null> {
  let bitmap: ImageBitmap | null = null
  try {
    const { readBarcodes } = await cargarZxing()
    bitmap = await createImageBitmap(foto, { imageOrientation: 'from-image' })
    for (const grados of GIROS) {
      const datos = dibujar(bitmap, grados)
      if (!datos) continue
      const resultados = await readBarcodes(datos, { formats: ['PDF417'], tryHarder: true, tryRotate: true, maxNumberOfSymbols: 1 })
      for (const r of resultados) {
        if (!r.isValid) continue
        const campos = leerCamposCedula(r.bytes) // borra la huella de r.bytes
        r.bytes.fill(0)
        if (campos) return campos
      }
    }
    return null
  } catch {
    // Ningún error de lectura bloquea: el prospecto escribe a mano.
    return null
  } finally {
    bitmap?.close()
  }
}

function dibujar(bitmap: ImageBitmap, grados: number): ImageData | null {
  const escala = grados === 0 ? 1 : Math.min(1, LADO_GIRADO / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)
  const rad = (grados * Math.PI) / 180
  const cw = Math.round(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)))
  const ch = Math.round(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, cw, ch)
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate(rad)
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h)
  return ctx.getImageData(0, 0, cw, ch)
}
