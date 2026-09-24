import type { ReactNode } from 'react'

/**
 * Estados del sistema: color fijo (no depende de la marca), forma de ícono propia
 * y palabra. Se distinguen aunque la marca sea verde o roja, y también sin color.
 */
export type Estado = 'pagado' | 'al-dia' | 'por-vencer' | 'mora' | 'parcial' | 'pendiente' | 'inactivo'

// Nombres de clase COMPLETOS (no armados con plantillas): Tailwind purga de
// @layer components las clases que no encuentra literalmente en el código.
const CLASE: Record<Estado, string> = {
  pagado: 'estado estado--pagado',
  'al-dia': 'estado estado--al-dia',
  'por-vencer': 'estado estado--por-vencer',
  mora: 'estado estado--mora',
  parcial: 'estado estado--parcial',
  pendiente: 'estado estado--pendiente',
  inactivo: 'estado estado--inactivo',
}

const PALABRA: Record<Estado, string> = {
  pagado: 'Pagado',
  'al-dia': 'Al día',
  'por-vencer': 'Por vencer',
  mora: 'En mora',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
  inactivo: 'Inactivo',
}

const CIRCULO = 'M8 1.6a6.4 6.4 0 1 1 0 12.8a6.4 6.4 0 1 1 0-12.8Z'
const TRIANGULO = 'M8 1.8L14.8 13.9H1.2Z'
const CHULO = 'M5 8.2l2 2 4-4.3'

// Formas de design/paquete-2a (GQ.E). `relleno`: la forma va llena y la marca en blanco.
const FORMA: Record<Estado, { forma: string; relleno: boolean; marca?: string; marcaLlena?: boolean }> = {
  pagado: { forma: CIRCULO, relleno: true, marca: CHULO },
  'al-dia': { forma: CIRCULO, relleno: false, marca: CHULO },
  'por-vencer': { forma: CIRCULO, relleno: false, marca: 'M8 4.8V8l2.2 1.5' },
  mora: { forma: TRIANGULO, relleno: true, marca: 'M8 6.3v3.1M8 11.7v.1' },
  parcial: { forma: CIRCULO, relleno: false, marca: 'M8 1.6a6.4 6.4 0 0 0 0 12.8Z', marcaLlena: true },
  pendiente: { forma: CIRCULO, relleno: false },
  inactivo: { forma: CIRCULO, relleno: false, marca: 'M5.2 10.8l5.6-5.6' },
}

/** Solo el ícono del estado (para cuadrículas de cuotas); siempre acompañado de texto cerca. */
export function IconoEstado({ estado, tamano = 14 }: { estado: Estado; tamano?: number }) {
  const f = FORMA[estado]
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d={f.forma}
        fill={f.relleno ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {f.marca && (
        <path
          d={f.marca}
          fill={f.marcaLlena ? 'currentColor' : 'none'}
          stroke={f.relleno ? '#FFFFFF' : 'currentColor'}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

/**
 * Etiqueta de estado: SIEMPRE ícono + palabra. La palabra por defecto se puede
 * reemplazar ("Vencida · 2 días", "Vence hoy", "Pagada") manteniendo el estado.
 */
export default function EtiquetaEstado({ estado, children }: { estado: Estado; children?: ReactNode }) {
  return (
    <span className={CLASE[estado]}>
      <IconoEstado estado={estado} />
      {children ?? PALABRA[estado]}
    </span>
  )
}
