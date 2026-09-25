import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Boton from '@/components/ui/Boton'
import type { CamposCedula } from '@/lib/cedula'
import { SEGUNDOS_AYUDA, guiaEnCuadro, intentoDeCuadro, zonaDeLectura } from '@/lib/escaner'
import { dibujarParaLector, grisParaLector, leerCedulaDeCuadro, precargarLector } from '@/lib/lector-cedula'

type Estado = 'abriendo' | 'buscando' | 'ayuda'

/**
 * Escáner en vivo del respaldo: cámara trasera (getUserMedia), recuadro guía del código y
 * lectura del PDF417 cuadro por cuadro. Al leer, ese cuadro es la foto del respaldo.
 * A los 15 s sin leer: consejos, tomar foto, subir de la galería o escribir a mano
 * (con aviso). Sin permiso o sin soporte de cámara: `alSinCamara` (foto normal).
 */
export default function EscanerCedula({
  alLeer,
  alCerrar,
  alSinCamara,
  alElegirFoto,
  alEscribirAMano,
}: {
  alLeer: (campos: CamposCedula, foto: Blob) => void
  alCerrar: () => void
  alSinCamara: () => void
  alElegirFoto: (archivo: File) => void
  alEscribirAMano: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const inputCamara = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<Estado>('abriendo')
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  // Caja del video: cabe entera en el espacio libre, con la proporción del cuadro
  // (así el recuadro guía coincide con la zona que se lee).
  const zonaVideo = useRef<HTMLDivElement>(null)
  const [caja, setCaja] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = zonaVideo.current
    if (!el || !dims) return
    const medir = () => {
      const f = Math.min(el.clientWidth / dims.w, el.clientHeight / dims.h)
      setCaja({ w: Math.floor(dims.w * f), h: Math.floor(dims.h * f) })
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dims])
  // Las funciones del padre cambian en cada render; el bucle usa siempre las últimas.
  const avisos = useRef({ alLeer, alSinCamara })
  avisos.current = { alLeer, alSinCamara }

  useEffect(() => {
    let vivo = true
    let stream: MediaStream | null = null
    precargarLector()
    const ayuda = window.setTimeout(() => vivo && setEstado('ayuda'), SEGUNDOS_AYUDA * 1000)

    async function bucle() {
      const v = video.current
      if (!v) return
      const cuadro = document.createElement('canvas')
      const ctx = cuadro.getContext('2d', { willReadFrequently: true })
      let n = 0
      while (vivo && ctx) {
        if (v.readyState >= 2 && v.videoWidth > 0) {
          cuadro.width = v.videoWidth
          cuadro.height = v.videoHeight
          ctx.drawImage(v, 0, 0)
          const zona = zonaDeLectura(cuadro.width, cuadro.height)
          const { binarizador, gris, ampliar } = intentoDeCuadro(n++)
          const escala = ampliar ? Math.min(2, 1600 / zona.ancho) : Math.min(1, 1600 / zona.ancho)
          const img = dibujarParaLector(cuadro, escala, 0, zona)
          const campos = img ? await leerCedulaDeCuadro(gris ? grisParaLector(img) : img, binarizador) : null
          if (campos && vivo) {
            // Ese cuadro, entero, es la foto del respaldo.
            const foto = await new Promise<Blob | null>((ok) => cuadro.toBlob(ok, 'image/jpeg', 0.92))
            if (foto && vivo) {
              vivo = false
              avisos.current.alLeer(campos, foto)
              return
            }
          }
        }
        await new Promise((ok) => setTimeout(ok, 100))
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      avisos.current.alSinCamara()
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        .then(async (s) => {
          if (!vivo) {
            s.getTracks().forEach((t) => t.stop())
            return
          }
          stream = s
          const v = video.current
          if (!v) return
          v.srcObject = s
          await v.play().catch(() => {})
          // Enfoque continuo si la cámara lo permite (si no, se ignora).
          await s.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
          setDims({ w: v.videoWidth || 1080, h: v.videoHeight || 1920 })
          setEstado((e) => (e === 'abriendo' ? 'buscando' : e))
          void bucle()
        })
        .catch(() => vivo && avisos.current.alSinCamara())
    }
    return () => {
      vivo = false
      window.clearTimeout(ayuda)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Esc cierra.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [alCerrar])

  const guia = dims ? guiaEnCuadro(dims.w, dims.h) : null
  const pct = (v: number, total: number) => `${(100 * v) / total}%`
  const elegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (archivo) alElegirFoto(archivo)
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="escaner-titulo" className="fixed inset-0 z-50 flex flex-col bg-tinta text-white">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2">
        <h2 id="escaner-titulo" className="flex-1 text-[16px] font-semibold">
          Cédula por detrás
        </h2>
        <button
          type="button"
          onClick={alCerrar}
          className="grid h-11 min-w-11 place-items-center rounded-control px-3 text-[14px] font-semibold text-white hover:bg-white/10"
        >
          Cerrar
        </button>
      </div>

      <div ref={zonaVideo} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        <div className="relative" style={caja ? { width: caja.w, height: caja.h } : { width: '100%', height: '100%' }}>
          <video ref={video} className="h-full w-full rounded-control object-cover" playsInline muted autoPlay aria-hidden="true" />
          {guia && dims && (
            <div
              className="pointer-events-none absolute rounded-tarjeta border-[3px] border-white"
              style={{
                left: pct(guia.x, dims.w),
                top: pct(guia.y, dims.h),
                width: pct(guia.ancho, dims.w),
                height: pct(guia.alto, dims.h),
                boxShadow: '0 0 0 9999px rgba(20, 24, 31, 0.55)',
              }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <p className="text-center text-[15px] leading-snug" aria-live="polite">
          {estado === 'abriendo'
            ? 'Abriendo la cámara…'
            : 'Ponga el código de barras de atrás de la cédula dentro del recuadro. Que se vea completo y lo más grande posible.'}
        </p>
        {estado === 'ayuda' && (
          <div className="mt-3 flex flex-col gap-3 rounded-tarjeta bg-white p-4 text-tinta">
            <p className="text-[15px] font-semibold">¿No se lee? Pruebe esto:</p>
            <ul className="list-disc pl-5 text-[14px] leading-relaxed text-tinta-2">
              <li>Incline un poco la cédula para que no le dé reflejo.</li>
              <li>Acérquela hasta que el código de barras llene el recuadro, sin salirse.</li>
              <li>Busque buena luz y deje quieto el celular un momento.</li>
            </ul>
            <div className="flex gap-2">
              <Boton variante="secundario" className="flex-1" onClick={() => inputCamara.current?.click()}>
                Tomar foto
              </Boton>
              <Boton variante="secundario" className="flex-1" onClick={() => inputGaleria.current?.click()}>
                Subir de la galería
              </Boton>
            </div>
            <div className="border-t border-borde pt-3">
              <Boton variante="enlace" className="min-h-11" onClick={alEscribirAMano}>
                Escribir mis datos a mano
              </Boton>
              <p className="text-[13px] text-tinta-3">Si los escribe a mano, sus datos quedan marcados como sin verificar.</p>
            </div>
          </div>
        )}
      </div>
      <input ref={inputCamara} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={elegir} />
      <input ref={inputGaleria} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={elegir} />
    </div>,
    document.body,
  )
}
