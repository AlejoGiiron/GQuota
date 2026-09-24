import { useId, useRef } from 'react'

export type EstadoFoto =
  | { estado: 'vacia' }
  | { estado: 'procesando'; mensaje: string }
  | { estado: 'lista'; vistaPrevia: string; nota?: string }
  | { estado: 'error'; mensaje: string }

const IconoCamara = (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h3.5l1.5-2.5h8L17.5 8H21v11H3zM12 10.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z" />
  </svg>
)

/**
 * Una foto del formulario: botón que abre la cámara del celular (input
 * accept="image/*" capture="environment"), estado y miniatura. Repetir la foto
 * vuelve a subirla y reemplaza la anterior.
 */
export default function FotoFicha({
  titulo,
  detalle,
  opcional = false,
  estado,
  alElegir,
}: {
  titulo: string
  detalle: string
  opcional?: boolean
  estado: EstadoFoto
  alElegir: (archivo: File) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const ocupada = estado.estado === 'procesando'

  return (
    <div className="flex items-center gap-3 border-b border-borde-fila py-3 last:border-b-0">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-tarjeta border border-borde bg-superficie-2 text-tinta-3">
        {estado.estado === 'lista' ? <img src={estado.vistaPrevia} alt="" className="h-full w-full object-cover" /> : IconoCamara}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">
          {titulo} {opcional && <span className="text-[13px] font-normal text-tinta-3">(opcional)</span>}
        </div>
        <div
          className={`text-[13px] ${estado.estado === 'error' ? 'text-estado-mora' : estado.estado === 'lista' ? 'text-estado-al-dia' : 'text-tinta-3'}`}
          aria-live="polite"
        >
          {estado.estado === 'vacia' && detalle}
          {estado.estado === 'procesando' && estado.mensaje}
          {estado.estado === 'lista' && (estado.nota ?? 'Lista')}
          {estado.estado === 'error' && estado.mensaje}
        </div>
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = '' // permite elegir la misma foto otra vez
          if (archivo) alElegir(archivo)
        }}
      />
      <button type="button" className="btn-secondary shrink-0 !px-3.5" disabled={ocupada} onClick={() => input.current?.click()}>
        {ocupada ? '…' : estado.estado === 'vacia' ? 'Tomar' : 'Repetir'}
      </button>
    </div>
  )
}
