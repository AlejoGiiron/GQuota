import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const IconCerrar = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/**
 * Modal del sistema 2a: velo de tinta, ventana blanca de 8 px sin borde, título
 * 18/600 con la X a la derecha, cuerpo con scroll y pie fijo con los botones a
 * la derecha. Reutilizable (formularios, confirmaciones).
 */
export default function Modal({
  open,
  onClose,
  titulo,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  titulo: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--velo)]" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-tarjeta bg-superficie shadow-flotante"
      >
        {/* Encabezado fijo */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-borde py-3 pl-5 pr-3 md:pl-6">
          <h2 className="flex-1 text-lg font-semibold text-tinta">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-11 w-11 place-items-center rounded-control md:h-10 md:w-10 text-tinta-3 transition-colors hover:bg-superficie-2 hover:text-tinta"
          >
            {IconCerrar}
          </button>
        </div>
        {/* Cuerpo con scroll: nunca empuja al pie fuera de la pantalla */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
        {/* Pie fijo: los botones siempre visibles */}
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-borde px-5 py-3 md:px-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
