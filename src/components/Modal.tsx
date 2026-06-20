import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const IconCerrar = (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/**
 * Modal genérico del design system: fondo blanco, header con título en bold,
 * footer con botones alineados a la derecha. Reutilizable (formularios, confirmaciones).
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
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="card relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden"
      >
        {/* Encabezado fijo */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-text">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-text"
          >
            {IconCerrar}
          </button>
        </div>
        {/* Cuerpo con scroll: nunca empuja al pie fuera de la pantalla */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {/* Pie fijo: los botones siempre visibles */}
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
