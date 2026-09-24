/**
 * Fotos del formulario del prospecto: se recomprimen en el navegador ANTES de
 * subir (~1600 px de lado mayor, JPEG). Volver a dibujar en un canvas descarta el
 * EXIF (GPS, modelo del teléfono, fecha): eso es lo que queremos.
 */

export const LADO_MAXIMO = 1600
/** El bucket acepta hasta 3 MB; se apunta por debajo. */
const PESO_OBJETIVO = 2_800_000

/** Dimensiones escaladas para que el lado mayor no pase de `max` (nunca agranda). */
export function dimensionesReducidas(ancho: number, alto: number, max = LADO_MAXIMO): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto)
  if (mayor <= max) return { ancho, alto }
  const f = max / mayor
  return { ancho: Math.round(ancho * f), alto: Math.round(alto * f) }
}

/** Recomprime a JPEG sin metadatos. Respeta la orientación que trae la foto. */
export async function comprimirFoto(archivo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  try {
    const { ancho, alto } = dimensionesReducidas(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Sin canvas')
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    for (const calidad of [0.85, 0.72, 0.6]) {
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', calidad))
      if (blob && blob.size <= PESO_OBJETIVO) return blob
    }
    throw new Error('La foto quedó muy pesada')
  } finally {
    bitmap.close()
  }
}
