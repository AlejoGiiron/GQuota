import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Boton from '@/components/ui/Boton'
import IlustracionNovedad from '@/components/novedades/IlustracionNovedad'
import type { PantallaGuia, PasoNovedad, RolGuia } from '@/lib/novedades'

/**
 * Guía de novedades (sistema 2a): hoja inferior en el celular y ventana de 480 px
 * en escritorio. Pasos con esquema, título y texto corto; "Siguiente"/"Atrás",
 * "Entendido" al final y "Ver después" siempre a mano (Esc hace lo mismo). Tocar
 * el velo no la cierra: así no se pospone por accidente. Se monta al abrirse, así
 * que cada vez arranca en el paso 1.
 */
export default function GuiaNovedades({
  pasos,
  rol,
  pantalla,
  yaVista,
  onEntendido,
  onVerDespues,
}: {
  pasos: PasoNovedad[]
  rol: RolGuia
  pantalla: PantallaGuia
  /** Reabierta desde el menú después de "Entendido": el botón secundario solo cierra. */
  yaVista: boolean
  onEntendido: () => void
  onVerDespues: () => void
}) {
  const [paso, setPaso] = useState(0)
  const dialogo = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)

  // Al cerrar, el foco vuelve a donde estaba (p. ej. el menú de la cuenta).
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    return () => anterior?.focus?.()
  }, [])

  // Cada paso lleva el foco a su título: el lector de pantalla lo anuncia.
  useEffect(() => {
    titulo.current?.focus()
  }, [paso])

  // Teclado: Esc = "Ver después"; Tab no sale de la ventana.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onVerDespues()
        return
      }
      if (e.key !== 'Tab' || !dialogo.current) return
      const focos = Array.from(dialogo.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (focos.length === 0) return
      const i = focos.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        focos[focos.length - 1].focus()
      } else if (!e.shiftKey && i === focos.length - 1) {
        e.preventDefault()
        focos[0].focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onVerDespues])

  const actual = pasos[paso]
  if (!actual) return null
  const ultimo = paso === pasos.length - 1

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-[var(--velo)]" aria-hidden="true" />
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novedades-titulo"
        aria-describedby="novedades-texto"
        className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-tarjeta bg-superficie shadow-flotante md:w-[480px] md:rounded-tarjeta"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-borde px-5 py-3 md:px-6">
          <p className="text-[13px] font-semibold text-tinta-3">Novedades</p>
          <p className="cifra text-[13px] text-tinta-3">
            Paso {paso + 1} de {pasos.length}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-5 md:px-6">
          <IlustracionNovedad tipo={actual.ilustracion} rol={rol} pantalla={pantalla} />
          <h2 ref={titulo} id="novedades-titulo" tabIndex={-1} className="mt-5 text-lg font-semibold text-tinta outline-none">
            {actual.titulo}
          </h2>
          <div id="novedades-texto" className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed text-tinta-2">
            {actual.parrafos.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-1.5" aria-hidden="true">
            {pasos.map((p, i) => (
              <span
                key={p.titulo}
                className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${i === paso ? 'w-5 bg-marca' : 'w-1.5 bg-borde-control'}`}
              />
            ))}
          </div>
        </div>

        {/* Celular: Atrás y Siguiente a lo ancho, "Ver después" debajo. Escritorio: una fila. */}
        <div className="flex shrink-0 flex-col gap-1 border-t border-borde px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:flex-row-reverse md:items-center md:justify-between md:px-6 md:pb-3">
          <div className="flex gap-2">
            {paso > 0 && (
              <Boton variante="secundario" className="flex-1 md:flex-none" onClick={() => setPaso(paso - 1)}>
                Atrás
              </Boton>
            )}
            <Boton className="flex-1 md:flex-none" onClick={ultimo ? onEntendido : () => setPaso(paso + 1)}>
              {ultimo ? 'Entendido' : 'Siguiente'}
            </Boton>
          </div>
          <Boton variante="enlace" className="min-h-11 self-center md:min-h-10 md:self-auto" onClick={onVerDespues}>
            {yaVista ? 'Cerrar' : 'Ver después'}
          </Boton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
