/**
 * Plan de intentos para leer el PDF417 de una foto del respaldo (lógica pura, con
 * pruebas). Lo usa src/lib/lector-cedula.ts.
 *
 * Por qué una escalera: un código "en el límite" (foto comprimida por WhatsApp,
 * poca resolución) se lee o no según pequeñas diferencias de píxeles. Diagnóstico
 * del 2026-09-24 con una cédula real: la foto tal cual no leía en el navegador
 * (ChecksumError), pero sí leían 28 de 180 variantes: ampliar ×1,25–×2, gris con
 * el contraste estirado, otros binarizadores o girar 2°. Cada intento tarda
 * decenas de milisegundos; el lector corta por tiempo.
 */

export type Binarizador = 'LocalAverage' | 'GlobalHistogram' | 'FixedThreshold'
export type Preparacion = 'color' | 'gris'
export type Intento = {
  /** Giro pequeño para enderezar (zxing solo prueba giros de 90°). */
  grados: number
  /** Escala sobre la imagen (o sobre el recorte, si `recorte`). */
  escala: number
  prep: Preparacion
  binarizador: Binarizador
  /** Sobre el recorte del código que zxing detectó sin poder leerlo. */
  recorte?: true
}

/** Ningún intento AMPLÍA una imagen por encima de este lado (memoria y tiempo en el celular). */
export const LADO_MAXIMO_INTENTO = 3200
/** Lado al que se lleva el recorte del código detectado. */
export const LADO_RECORTE = 1600

// Combinaciones en orden de utilidad medida (primero la de siempre).
const COMBOS: ReadonlyArray<readonly [Preparacion, Binarizador]> = [
  ['color', 'LocalAverage'],
  ['gris', 'FixedThreshold'],
  ['color', 'GlobalHistogram'],
  ['gris', 'LocalAverage'],
]

/** Intentos en orden, para una imagen de ancho × alto. */
export function planDeLectura(ancho: number, alto: number): Intento[] {
  const lado = Math.max(ancho, alto)
  const cabe = (e: number) => e * lado <= LADO_MAXIMO_INTENTO
  // Foto grande (cámara de 12 MP): a resolución completa y reducida a 2400.
  // Foto chica o mediana (WhatsApp, guardada): tal cual y ampliada.
  const rectas = lado > 2600 ? [1, 2400 / lado] : [1, ...[1.5, 1.25, 2].filter(cabe)]
  const giradas = lado > 2600 ? [2000 / lado] : [1, 1.5].filter(cabe)

  const plan: Intento[] = []
  for (const escala of rectas) for (const [prep, binarizador] of COMBOS) plan.push({ grados: 0, escala, prep, binarizador })
  // Si zxing vio el código pero no lo leyó: ese recorte, ampliado.
  for (const grados of [0, 2, -2]) for (const [prep, binarizador] of COMBOS) plan.push({ grados, escala: 1, prep, binarizador, recorte: true })
  for (const grados of [2, -2, 4, -4]) for (const escala of giradas) for (const [prep, binarizador] of COMBOS.slice(0, 2)) plan.push({ grados, escala, prep, binarizador })
  for (const grados of [8, -8, 12, -12]) for (const [prep, binarizador] of COMBOS.slice(0, 2)) plan.push({ grados, escala: giradas[0], prep, binarizador })
  return plan
}

export type Caja = { x: number; y: number; ancho: number; alto: number }

/**
 * Caja del código detectado (esquinas de zxing) con un margen del 12 %, dentro de
 * la imagen. null si es demasiado chica para servir.
 */
export function cajaConMargen(
  esquinas: ReadonlyArray<{ x: number; y: number }>,
  ancho: number,
  alto: number,
  margen = 0.12,
): Caja | null {
  const xs = esquinas.map((p) => p.x)
  const ys = esquinas.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const mx = (x1 - x0) * margen
  const my = (y1 - y0) * margen + (x1 - x0) * 0.04
  const x = Math.max(0, Math.floor(x0 - mx))
  const y = Math.max(0, Math.floor(y0 - my))
  const caja = { x, y, ancho: Math.min(ancho, Math.ceil(x1 + mx)) - x, alto: Math.min(alto, Math.ceil(y1 + my)) - y }
  return caja.ancho >= 40 && caja.alto >= 12 ? caja : null
}
