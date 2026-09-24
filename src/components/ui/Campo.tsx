import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

/** Props que Campo le pasa al control para enlazar etiqueta, ayuda y error. */
export type PropsControl = {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

const IconoError = (
  <svg className="h-[13px] w-[13px] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.8L14.8 13.9H1.2Z" fill="currentColor" />
    <path d="M8 6.3v3.1M8 11.7v.1" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

/**
 * Campo del formulario: etiqueta arriba, el control y debajo la ayuda o el error.
 * El control se pasa como función para recibir id y atributos ARIA:
 *
 *   <Campo etiqueta="Celular" error={error}>
 *     {(p) => <input className="input" {...p} value={v} onChange={…} />}
 *   </Campo>
 */
export default function Campo({
  etiqueta,
  ayuda,
  error,
  children,
}: {
  etiqueta: ReactNode
  ayuda?: ReactNode
  error?: string | null
  children: (props: PropsControl) => ReactNode
}) {
  const id = useId()
  const idAyuda = `${id}-ayuda`
  const idError = `${id}-error`
  const describedBy = [error ? idError : '', ayuda ? idAyuda : ''].filter(Boolean).join(' ')

  return (
    <div className="campo">
      <label htmlFor={id} className="campo__etiqueta">
        {etiqueta}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {error && (
        <p id={idError} className="campo__error">
          {IconoError}
          {error}
        </p>
      )}
      {ayuda && (
        <p id={idAyuda} className="campo__ayuda">
          {ayuda}
        </p>
      )}
    </div>
  )
}

/** Entrada de monto: 52 px, cifra grande tabular y el signo $ delante. */
export function EntradaMonto({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-medium text-tinta-3"
        aria-hidden="true"
      >
        $
      </span>
      <input inputMode="numeric" className={`input input-monto pl-8 ${className}`} {...props} />
    </div>
  )
}
