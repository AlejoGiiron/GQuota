/**
 * Marca blanca: a partir de los dos colores que elige cada negocio (principal y
 * acento) calcula los tokens derivados del sistema de diseño 2a.
 *
 * Lógica pura (sin DOM). Reglas del Sistema (design/paquete-2a):
 *  - Texto sobre un color de marca: blanco o tinta, el de mayor contraste WCAG.
 *  - La marca usada como texto sobre blanco se oscurece hacia la tinta, en pasos
 *    de 5 %, hasta llegar a 4,5:1.
 *  - La marca suave es la marca al 12 % sobre blanco (fondo del ítem activo).
 *
 * Referencia de la implementación: design/paquete-2a/fuente/gq-comun.js (GQ.tokens).
 */

/** Tinta que se usa sobre marcas claras (texto oscuro sobre la marca). */
export const TINTA_SOBRE_MARCA = '#17150F'
const BLANCO = '#FFFFFF'
/** Contraste mínimo WCAG AA para texto normal. */
export const CONTRASTE_MINIMO_TEXTO = 4.5

export type TokenMarca =
  | '--marca'
  | '--marca-sobre'
  | '--marca-texto'
  | '--marca-suave'
  | '--acento'
  | '--acento-sobre'
  | '--acento-texto'

export type TokensDeMarca = Record<TokenMarca, string>

type Rgb = [number, number, number]

/** true si es un color hexadecimal de 3 o 6 dígitos, con o sin '#'. */
export function esHexValido(hex: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)
}

function aRgb(hex: string): Rgb {
  if (!esHexValido(hex)) throw new Error(`Color inválido: "${hex}"`)
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

/** Normaliza a '#RRGGBB' en mayúsculas. */
export function normalizarHex(hex: string): string {
  return '#' + aRgb(hex).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** Luminancia relativa WCAG 2.x. */
function luminancia([r, g, b]: Rgb): number {
  const canal = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** Relación de contraste WCAG entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(aRgb(a))
  const lb = luminancia(aRgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Mezcla lineal en sRGB: t = 0 devuelve `a`, t = 1 devuelve `b`. */
export function mezcla(a: string, b: string, t: number): string {
  const A = aRgb(a)
  const B = aRgb(b)
  return (
    '#' +
    A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/** Color para texto e íconos sobre `fondo`: blanco o tinta, el de mayor contraste. */
export function textoSobre(fondo: string): string {
  return contraste(BLANCO, fondo) >= contraste(TINTA_SOBRE_MARCA, fondo) ? BLANCO : TINTA_SOBRE_MARCA
}

/**
 * El color usado como texto sobre `fondo` (blanco por defecto). Si no llega a
 * 4,5:1, se mezcla con la tinta en pasos de 5 % hasta llegar.
 */
export function comoTexto(color: string, fondo = BLANCO): string {
  let t = 0
  let x = normalizarHex(color)
  while (contraste(x, fondo) < CONTRASTE_MINIMO_TEXTO && t < 1) {
    t += 0.05
    x = mezcla(color, TINTA_SOBRE_MARCA, t)
  }
  return x
}

/** Tokens de marca completos a partir de los dos colores del negocio. */
export function tokensDeMarca(principal: string, acento: string): TokensDeMarca {
  const marca = normalizarHex(principal)
  const acen = normalizarHex(acento)
  return {
    '--marca': marca,
    '--marca-sobre': textoSobre(marca),
    '--marca-texto': comoTexto(marca),
    '--marca-suave': mezcla(marca, BLANCO, 0.88),
    '--acento': acen,
    '--acento-sobre': textoSobre(acen),
    '--acento-texto': comoTexto(acen),
  }
}

/** Marca fija de esta fase (verde y ámbar de G-Quota). "Mi marca" la leerá de cada negocio. */
export const MARCA_G_QUOTA = { principal: '#047857', acento: '#D97706' } as const

const PALABRAS_A_SALTAR = new Set([
  'créditos', 'crédito', 'préstamos', 'préstamo', 'inversiones', 'multicréditos', 'finanzas',
  'la', 'el', 'los', 'las', 'de', 'del', 'y',
])

/**
 * Monograma del negocio para el logo cuando no hay imagen: un número si el nombre
 * lo tiene ("Créditos La 14" → "14"); si no, las iniciales de las palabras que
 * no son genéricas ("Préstamos Doña Rosa" → "DR"). El guion separa palabras
 * ("G-Quota" → "GQ"; en la referencia del paquete daba "G-").
 */
export function monograma(nombre: string): string {
  const palabras = nombre.trim().split(/[\s-]+/).filter(Boolean)
  if (palabras.length === 0) return '·'
  const numero = palabras.find((p) => /^\d+$/.test(p))
  if (numero) return numero.slice(0, 3)
  const propias = palabras.filter((p) => !PALABRAS_A_SALTAR.has(p.toLowerCase()))
  if (propias.length >= 2) return (propias[0][0] + propias[1][0]).toUpperCase()
  if (propias.length === 1) {
    return (palabras[0] === propias[0] ? propias[0].slice(0, 2) : palabras[0][0] + propias[0][0]).toUpperCase()
  }
  return (palabras[0][0] + (palabras[1]?.[0] ?? '')).toUpperCase()
}
