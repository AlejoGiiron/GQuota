import type { ButtonHTMLAttributes } from 'react'

export type VarianteBoton = 'principal' | 'secundario' | 'destructivo' | 'enlace'

const CLASE: Record<VarianteBoton, string> = {
  principal: 'btn-primary',
  secundario: 'btn-secondary',
  destructivo: 'btn-destructive',
  enlace: 'btn-enlace',
}

/**
 * Botón del sistema 2a. 44 px en el celular y 40 px en escritorio; `grande` es la
 * acción principal del celular (54 px). El principal lleva la marca; el
 * destructivo va en contorno rojo. Por defecto es type="button".
 */
export default function Boton({
  variante = 'principal',
  grande = false,
  type = 'button',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton; grande?: boolean }) {
  const clases = [CLASE[variante], grande && variante !== 'enlace' ? 'btn-grande' : '', className]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={clases} {...props} />
}
