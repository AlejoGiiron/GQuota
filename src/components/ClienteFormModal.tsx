import { useEffect, useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import type { ClienteInput } from '@/hooks/useClientes'
import type { Cliente } from '@/types/database.types'

const textareaClass =
  'w-full rounded-xl border-[1.5px] border-line bg-card px-4 py-3 text-[15px] font-medium text-text outline-none transition-colors placeholder:text-muted placeholder:font-medium focus:border-green focus:shadow-[0_0_0_4px_rgba(4,120,87,0.12)]'

function aTexto(valor: string): string | null {
  const limpio = valor.trim()
  return limpio === '' ? null : limpio
}

/** Modal de alta/edición de cliente. Si `cliente` viene, es edición. */
export default function ClienteFormModal({
  open,
  cliente,
  onClose,
  onGuardar,
}: {
  open: boolean
  cliente: Cliente | null
  onClose: () => void
  /** Devuelve true si guardó bien (para que el padre cierre el modal). */
  onGuardar: (input: ClienteInput) => Promise<boolean>
}) {
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')
  const [errorNombre, setErrorNombre] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Sincroniza los campos al abrir (o al cambiar de cliente a editar).
  useEffect(() => {
    if (!open) return
    setNombre(cliente?.nombre ?? '')
    setDocumento(cliente?.documento ?? '')
    setTelefono(cliente?.telefono ?? '')
    setDireccion(cliente?.direccion ?? '')
    setNotas(cliente?.notas ?? '')
    setErrorNombre(null)
    setGuardando(false)
  }, [open, cliente])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (nombre.trim() === '') {
      setErrorNombre('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    const ok = await onGuardar({
      nombre: nombre.trim(),
      documento: aTexto(documento),
      telefono: aTexto(telefono),
      direccion: aTexto(direccion),
      notas: aTexto(notas),
    })
    setGuardando(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" form="form-cliente" className="btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="cli-nombre" className="text-[13px] font-semibold text-text-2">
            Nombre <span className="text-red">*</span>
          </label>
          <input
            id="cli-nombre"
            className="input"
            placeholder="Nombre del cliente"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              if (errorNombre) setErrorNombre(null)
            }}
            autoFocus
          />
          {errorNombre && <p className="text-xs font-semibold text-red">{errorNombre}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cli-doc" className="text-[13px] font-semibold text-text-2">
            Documento
          </label>
          <input
            id="cli-doc"
            className="input"
            placeholder="Cédula o NIT"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cli-tel" className="text-[13px] font-semibold text-text-2">
            Teléfono
          </label>
          <input
            id="cli-tel"
            className="input"
            inputMode="tel"
            placeholder="300 000 0000"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cli-dir" className="text-[13px] font-semibold text-text-2">
            Dirección
          </label>
          <input
            id="cli-dir"
            className="input"
            placeholder="Dirección"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cli-notas" className="text-[13px] font-semibold text-text-2">
            Notas
          </label>
          <textarea
            id="cli-notas"
            className={textareaClass}
            placeholder="Notas internas (opcional)"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
