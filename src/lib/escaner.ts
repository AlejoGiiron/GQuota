/**
 * Escáner en vivo del respaldo (lógica pura, con pruebas): el recuadro guía dentro
 * del cuadro de video y el ciclo de intentos por cuadro. Lo usa
 * src/components/ficha/EscanerCedula.tsx.
 *
 * El recuadro encuadra el CÓDIGO DE BARRAS, no la cédula entera: llenándolo, cada
 * módulo del PDF417 ocupa ~3 px en un video de 1080 px (con la cédula entera
 * quedaban ~2 px, en el límite de lectura).
 */
import type { Binarizador, Caja } from '@/lib/plan-lectura'

/** Proporción del recuadro: el PDF417 de la cédula es largo y bajo. */
export const PROPORCION_CODIGO = 3.5
/** Segundos sin leer antes de ofrecer consejos, foto o galería. */
export const SEGUNDOS_AYUDA = 15

/** Recuadro guía centrado, en píxeles del cuadro: 90 % del ancho o, si no cabe, 40 % del alto. */
export function guiaEnCuadro(ancho: number, alto: number): Caja {
  let w = ancho * 0.9
  let h = w / PROPORCION_CODIGO
  if (h > alto * 0.4) {
    h = alto * 0.4
    w = h * PROPORCION_CODIGO
  }
  return { x: Math.round((ancho - w) / 2), y: Math.round((alto - h) / 2), ancho: Math.round(w), alto: Math.round(h) }
}

/**
 * Zona que se lee: el recuadro con margen (8 % a los lados y la mitad de su alto
 * arriba y abajo), por si el código no quedó bien centrado o es más alto.
 */
export function zonaDeLectura(ancho: number, alto: number): Caja {
  const g = guiaEnCuadro(ancho, alto)
  const mx = g.ancho * 0.08
  const my = g.alto * 0.5
  const x = Math.max(0, Math.round(g.x - mx))
  const y = Math.max(0, Math.round(g.y - my))
  return { x, y, ancho: Math.min(ancho, Math.round(g.x + g.ancho + mx)) - x, alto: Math.min(alto, Math.round(g.y + g.alto + my)) - y }
}

/**
 * Qué prueba el cuadro número n: se alternan binarizador, gris con contraste y una
 * ampliación (un cuadro más lento no importa: vienen muchos).
 */
export function intentoDeCuadro(n: number): { binarizador: Binarizador; gris: boolean; ampliar: boolean } {
  const binarizadores: Binarizador[] = ['LocalAverage', 'GlobalHistogram', 'FixedThreshold']
  return { binarizador: binarizadores[n % 3], gris: Math.floor(n / 3) % 2 === 1, ampliar: Math.floor(n / 6) % 2 === 1 }
}
