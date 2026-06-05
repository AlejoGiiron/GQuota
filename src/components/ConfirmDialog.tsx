import { useState } from 'react'
import Modal from '@/components/Modal'

/** Confirmación antes de una acción destructiva (eliminar, cancelar). */
export default function ConfirmDialog({
  open,
  titulo,
  mensaje,
  textoConfirmar = 'Eliminar',
  onConfirmar,
  onCancelar,
}: {
  open: boolean
  titulo: string
  mensaje: string
  textoConfirmar?: string
  onConfirmar: () => Promise<void> | void
  onCancelar: () => void
}) {
  const [procesando, setProcesando] = useState(false)

  async function confirmar() {
    setProcesando(true)
    try {
      await onConfirmar()
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancelar}
      titulo={titulo}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </button>
          <button type="button" className="btn-destructive" onClick={confirmar} disabled={procesando}>
            {procesando ? 'Eliminando…' : textoConfirmar}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-text-2">{mensaje}</p>
    </Modal>
  )
}
