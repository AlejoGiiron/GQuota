import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import Boton from '@/components/ui/Boton'
import Campo from '@/components/ui/Campo'
import type { EnlaceCreado } from '@/hooks/useSolicitudes'
import { enlaceWhatsApp } from '@/lib/whatsapp'
import { formatearCelular, mensajeFicha, normalizarCelular, textoVencimiento, urlFicha } from '@/lib/solicitudes'

const IconoEnlace = (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
)
const IconoReloj = (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
const IconoAviso = (
  <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.8L14.8 13.9H1.2Z" fill="currentColor" />
    <path d="M8 6.3v3.1M8 11.7v.1" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

/**
 * Nuevo prospecto: celular + nombre opcional → genera el enlace de 24 horas y lo
 * muestra UNA sola vez (en la base solo queda su hash), con Copiar y Enviar por
 * WhatsApp. También muestra un enlace ya generado (Reenviar / Generar otro).
 */
export default function NuevoProspectoModal({
  open,
  onClose,
  nombreNegocio,
  crearEnlace,
  generado,
}: {
  open: boolean
  onClose: () => void
  nombreNegocio: string
  crearEnlace: (celular: string, nombre: string | null) => Promise<{ enlace: EnlaceCreado | null; error: string | null }>
  /** Enlace recién generado desde la lista (Reenviar / Generar otro). */
  generado?: EnlaceCreado | null
}) {
  const [celular, setCelular] = useState('')
  const [nombre, setNombre] = useState('')
  const [errorCelular, setErrorCelular] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [enlace, setEnlace] = useState<EnlaceCreado | null>(null)

  // Al abrir: formulario limpio, o directo al enlace si viene uno generado.
  useEffect(() => {
    if (!open) return
    setCelular('')
    setNombre('')
    setErrorCelular(null)
    setEnlace(generado ?? null)
  }, [open, generado])

  async function generar(e: FormEvent) {
    e.preventDefault()
    if (!normalizarCelular(celular)) {
      setErrorCelular('Escriba un celular de 10 dígitos que empiece por 3.')
      return
    }
    setCreando(true)
    const { enlace: nuevo, error } = await crearEnlace(celular, nombre.trim() || null)
    setCreando(false)
    if (error || !nuevo) {
      toast.error(error ?? 'No pudimos generar el enlace. Intente de nuevo.')
      return
    }
    setEnlace(nuevo)
  }

  if (!enlace) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        titulo="Nuevo prospecto"
        footer={
          <>
            <Boton variante="secundario" onClick={onClose} disabled={creando}>
              Cancelar
            </Boton>
            <Boton type="submit" form="form-nuevo-prospecto" disabled={creando}>
              {IconoEnlace}
              {creando ? 'Generando…' : 'Generar enlace'}
            </Boton>
          </>
        }
      >
        <form id="form-nuevo-prospecto" onSubmit={generar} className="flex flex-col gap-4" noValidate>
          <p className="text-[14.5px] leading-relaxed text-tinta-2">
            Le generamos un enlace para que llene su ficha desde el celular. El enlace vence a las 24 horas o cuando
            termine de llenarla.
          </p>
          <Campo etiqueta="Celular del prospecto" error={errorCelular}>
            {(p) => (
              <input
                {...p}
                className="input cifra"
                inputMode="tel"
                autoComplete="off"
                placeholder="300 000 0000"
                value={celular}
                onChange={(e) => {
                  setCelular(e.target.value)
                  setErrorCelular(null)
                }}
                autoFocus
              />
            )}
          </Campo>
          <Campo
            etiqueta={
              <>
                Nombre <span className="font-normal text-tinta-3">(opcional)</span>
              </>
            }
            ayuda="Solo para reconocerlo en la lista. El prospecto escribe su nombre completo en la ficha."
          >
            {(p) => (
              <input {...p} className="input" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            )}
          </Campo>
        </form>
      </Modal>
    )
  }

  const url = urlFicha(window.location.origin, enlace.token)
  const mensaje = mensajeFicha(enlace.nombre_referencia, nombreNegocio, url)
  const whatsapp = enlaceWhatsApp(enlace.telefono, mensaje)
  const quien = enlace.nombre_referencia ?? 'el prospecto'

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado.')
    } catch {
      toast.error('No pudimos copiar. Selecciónelo y cópielo a mano.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titulo={enlace.nombre_referencia ? `Enlace listo para ${enlace.nombre_referencia}` : 'Enlace listo'}
      footer={
        <>
          <Boton variante="secundario" onClick={onClose}>
            Listo
          </Boton>
          {whatsapp && (
            <a className="btn-primary" href={whatsapp} target="_blank" rel="noopener noreferrer">
              Enviar por WhatsApp
            </a>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5 rounded-control border border-borde-control bg-superficie-2 py-1.5 pl-3.5 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-[15px] cifra" title={url}>
            {url.replace(/^https?:\/\//, '')}
          </span>
          <Boton variante="secundario" className="!px-3 !text-[13.5px]" onClick={copiar}>
            Copiar
          </Boton>
        </div>
        <p className="flex items-start gap-2 text-sm text-tinta-2">
          {IconoReloj}
          <span>
            {textoVencimiento(enlace.expira_en, new Date()).replace(/^vence/, 'Vence')}, o antes si {quien} termina de
            llenarla.
          </span>
        </p>
        <p className="flex items-start gap-2 rounded-control bg-estado-por-vencer-fondo px-3 py-2.5 text-sm font-medium text-estado-por-vencer">
          {IconoAviso}
          <span>Este enlace solo se muestra ahora. Cópielo o envíelo antes de cerrar; si lo pierde, genere otro.</span>
        </p>
        <div className="rounded-tarjeta bg-fondo p-3.5">
          <div className="mb-2 text-[12.5px] font-semibold text-tinta-2">
            Mensaje que se envía · <span className="cifra">{formatearCelular(enlace.telefono)}</span>
          </div>
          <div className="whitespace-pre-line break-words rounded-tarjeta rounded-tl-none border border-borde bg-superficie px-3 py-2.5 text-sm leading-relaxed">
            {mensaje}
          </div>
        </div>
      </div>
    </Modal>
  )
}
