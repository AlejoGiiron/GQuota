/**
 * Solicitudes de ficha por enlace: celular, estado visual y textos. Lógica pura.
 */
import { fmtFecha } from '@/lib/formatters'

export type EstadoGuardado = 'enviada' | 'completada' | 'anulada' | 'aprobada' | 'rechazada'
/** "Vencida" no se guarda: es 'enviada' con expira_en ya pasado. */
export type EstadoVisual = 'por_revisar' | 'enviada' | 'vencida' | 'aprobada' | 'rechazada' | 'anulada'

/**
 * Celular colombiano → '573001234567'. Acepta 10 dígitos que empiezan por 3 (con
 * espacios, puntos o guiones) o el número con 57 delante. null si no es válido.
 * Réplica de normalizar_celular_co (migración 035).
 */
export function normalizarCelular(texto: string): string | null {
  const d = texto.replace(/\D/g, '')
  if (/^3\d{9}$/.test(d)) return `57${d}`
  if (/^573\d{9}$/.test(d)) return d
  return null
}

/** '573001234567' → '300 123 4567' (para mostrar). */
export function formatearCelular(telefono: string): string {
  const d = telefono.replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, '')
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : telefono
}

export function estadoVisual(estado: string, expiraEn: string, ahora: Date): EstadoVisual {
  switch (estado) {
    case 'enviada':
      return new Date(expiraEn).getTime() <= ahora.getTime() ? 'vencida' : 'enviada'
    case 'completada':
      return 'por_revisar'
    case 'aprobada':
    case 'rechazada':
    case 'anulada':
      return estado
    default:
      return 'anulada'
  }
}

const dos = (n: number) => String(n).padStart(2, '0')
/** 23/09 */
export const fechaCorta = (d: Date) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}`
/** 4:10 p. m. */
export function hora(d: Date): string {
  const h = d.getHours()
  return `${h % 12 === 0 ? 12 : h % 12}:${dos(d.getMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** Tiempo que le queda a un enlace: "22 h 42 min", "35 min", "menos de 1 min". */
export function tiempoRestante(expiraEn: string, ahora: Date): string {
  const min = Math.floor((new Date(expiraEn).getTime() - ahora.getTime()) / 60000)
  if (min < 1) return 'menos de 1 min'
  const h = Math.floor(min / 60)
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`
}

/** Texto de la columna "Enlace" según el estado. */
export function textoEnlace(
  s: { estado: string; expira_en: string; completada_en: string | null },
  ahora: Date,
): string {
  const visual = estadoVisual(s.estado, s.expira_en, ahora)
  if (visual === 'enviada') return `Vence en ${tiempoRestante(s.expira_en, ahora)}`
  if (visual === 'vencida') {
    const d = new Date(s.expira_en)
    return `Venció el ${fechaCorta(d)} a las ${hora(d)}`
  }
  if (visual === 'anulada') return 'Reemplazado por uno nuevo'
  if (!s.completada_en) return 'Usado'
  const d = new Date(s.completada_en)
  return visual === 'por_revisar' ? `Usado el ${fechaCorta(d)} a las ${hora(d)}` : `Usado el ${fechaCorta(d)}`
}

/** "vence hoy, 23/09/2026, a las 4:10 p. m." / "vence mañana, …" / "vence el …". */
export function textoVencimiento(expiraEn: string, ahora: Date): string {
  const d = new Date(expiraEn)
  const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const diaVence = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((diaVence.getTime() - dia.getTime()) / 86_400_000)
  const cuando = dias === 0 ? `hoy, ${fmtFecha(d)},` : dias === 1 ? `mañana, ${fmtFecha(d)},` : `el ${fmtFecha(d)}`
  return `vence ${cuando} a las ${hora(d)}`
}

/** Enlace público de la ficha. */
export function urlFicha(origen: string, token: string): string {
  return `${origen.replace(/\/$/, '')}/s/${token}`
}

/** Mensaje de WhatsApp del diseño (Nuevo prospecto). */
export function mensajeFicha(nombreReferencia: string | null, negocio: string, url: string): string {
  const saludo = nombreReferencia ? `Hola, ${nombreReferencia}.` : 'Hola.'
  return (
    `${saludo} Para estudiar su solicitud de préstamo con ${negocio}, por favor llene sus datos en este enlace: ${url}\n` +
    'El enlace vence en 24 horas. Tenga su cédula a la mano.'
  )
}
