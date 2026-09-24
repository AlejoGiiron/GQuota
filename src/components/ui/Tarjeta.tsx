import type { ReactNode } from 'react'

/**
 * Tarjeta: superficie blanca con borde y radio de 8 px, sin sombra (2a es plano).
 * Con `titulo` lleva encabezado (título de sección 16/600 y acciones a la derecha).
 */
export default function Tarjeta({
  titulo,
  acciones,
  sinRelleno = false,
  className = '',
  children,
}: {
  titulo?: ReactNode
  acciones?: ReactNode
  /** Sin padding interno (p. ej. cuando el contenido es una lista o una tabla). */
  sinRelleno?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`tarjeta overflow-hidden ${className}`}>
      {titulo && (
        <header className="tarjeta__encabezado">
          <h2 className="tarjeta__titulo">{titulo}</h2>
          {acciones && <div className="flex items-center gap-2">{acciones}</div>}
        </header>
      )}
      <div className={sinRelleno ? '' : 'p-4 md:p-5'}>{children}</div>
    </section>
  )
}
