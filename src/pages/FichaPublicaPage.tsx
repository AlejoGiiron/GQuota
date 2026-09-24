import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import Boton from '@/components/ui/Boton'
import { invocarEdge } from '@/lib/edge'
import { campoActivo, leerFicha } from '@/lib/ficha'
import { fmtFecha } from '@/lib/formatters'
import { monograma } from '@/lib/marca'
import { hora, textoVencimiento } from '@/lib/solicitudes'

/** Respuesta de la Edge Function ficha-publica. */
type Respuesta =
  | { estado: 'activa'; negocio: { nombre: string }; ficha: unknown; nombre_referencia: string | null; expira_en: string }
  | { estado: 'vencida'; negocio: { nombre: string } }
  | { estado: 'usada'; negocio: { nombre: string }; enviada_en: string | null }
  | { estado: 'no_disponible' }

/** Evita que buscadores indexen el enlace y que el token viaje en el Referer. */
function useMetaPrivada() {
  useEffect(() => {
    const metas = [
      ['robots', 'noindex, nofollow'],
      ['referrer', 'no-referrer'],
    ].map(([name, content]) => {
      const m = document.createElement('meta')
      m.name = name
      m.content = content
      document.head.appendChild(m)
      return m
    })
    return () => metas.forEach((m) => m.remove())
  }, [])
}

const icono = (d: string, clase = 'h-7 w-7') => (
  <svg className={clase} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const ICONO_CEDULA = 'M3 6h18v12H3zM7 10.5a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M5.8 15.5c.5-1.3 1.5-2 3-2s2.5.7 3 2M14 10h4M14 13.5h3'
const ICONO_LUZ = 'M12 3v2M5.6 5.6l1.4 1.4M3 12h2M19 12h2M17 7l1.4-1.4M8 12a4 4 0 1 1 6 3.5V17h-4v-1.5A4 4 0 0 1 8 12ZM10 20h4'
const ICONO_PERSONAS = 'M9 11.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7ZM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.9c1.7.8 2.7 2.4 3 5.1'
const ICONO_RELOJ = 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17ZM12 7.5V12l3 2'
const ICONO_CHULO = 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17ZM8 12.3l2.7 2.7L16 9.6'
const ICONO_ENLACE_ROTO = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16'

/** Marco de la página del prospecto: celular primero, centrado en pantallas grandes. */
function Marco({ negocio, children }: { negocio: string | null; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-fondo md:py-10">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-superficie md:min-h-0 md:rounded-tarjeta md:border md:border-borde">
        <header className="flex h-14 items-center gap-2.5 border-b border-borde px-5">
          {negocio ? (
            <>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] bg-marca text-xs font-bold text-marca-sobre" aria-hidden="true">
                {monograma(negocio)}
              </div>
              <span className="truncate text-[15px] font-semibold">{negocio}</span>
            </>
          ) : (
            <span className="text-[15px] font-semibold">G-Quota</span>
          )}
        </header>
        <main className="flex flex-1 flex-col px-5 py-7">{children}</main>
        <footer className="pb-6 text-center text-xs text-tinta-3">con G-Quota</footer>
      </div>
    </div>
  )
}

function Aviso({ iconoD, titulo, children }: { iconoD: string; titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-superficie-2 text-tinta-2">{icono(iconoD)}</div>
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <p className="max-w-xs text-[14.5px] leading-relaxed text-tinta-2">{children}</p>
    </div>
  )
}

/**
 * Inicio del enlace de la ficha (ruta pública /s/:token, sin sesión). Valida el
 * enlace con la Edge Function ficha-publica. El formulario llega en la fase 1B:
 * por ahora "Empezar" queda deshabilitado.
 */
export default function FichaPublicaPage() {
  const { token = '' } = useParams()
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)
  useMetaPrivada()

  const consultar = useCallback(async () => {
    setError(null)
    setRespuesta(null)
    const { data, error: err } = await invocarEdge<Respuesta>('ficha-publica', { token })
    if (err || !data) setError('No pudimos revisar el enlace. Revise su conexión e intente de nuevo.')
    else setRespuesta(data)
  }, [token])

  useEffect(() => {
    document.title = 'Solicitud de préstamo'
    void consultar()
  }, [consultar])

  if (error) {
    return (
      <Marco negocio={null}>
        <Aviso iconoD={ICONO_ENLACE_ROTO} titulo="No pudimos abrir el enlace">
          {error}
        </Aviso>
        <Boton variante="secundario" grande onClick={() => void consultar()}>
          Intentar de nuevo
        </Boton>
      </Marco>
    )
  }

  if (!respuesta) {
    return (
      <Marco negocio={null}>
        <div className="flex flex-1 items-center justify-center" role="status" aria-label="Revisando el enlace">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-borde border-t-marca" />
        </div>
      </Marco>
    )
  }

  if (respuesta.estado === 'no_disponible') {
    return (
      <Marco negocio={null}>
        <Aviso iconoD={ICONO_ENLACE_ROTO} titulo="Este enlace no está disponible">
          Puede que lo hayan reemplazado por uno nuevo o que la dirección esté incompleta. Pídale el enlace otra vez a
          quien se lo envió.
        </Aviso>
      </Marco>
    )
  }

  const negocio = respuesta.negocio.nombre

  if (respuesta.estado === 'vencida') {
    return (
      <Marco negocio={negocio}>
        <Aviso iconoD={ICONO_RELOJ} titulo="Este enlace venció">
          Los enlaces duran 24 horas. Pídale uno nuevo a {negocio}.
        </Aviso>
      </Marco>
    )
  }

  if (respuesta.estado === 'usada') {
    const enviada = respuesta.enviada_en ? new Date(respuesta.enviada_en) : null
    return (
      <Marco negocio={negocio}>
        <Aviso iconoD={ICONO_CHULO} titulo="Este enlace ya se usó">
          {enviada ? `Los datos se enviaron el ${fmtFecha(enviada)} a las ${hora(enviada)}. ` : 'Los datos ya se enviaron. '}
          Por seguridad no se pueden ver ni cambiar desde aquí.
        </Aviso>
      </Marco>
    )
  }

  // Activa: pantalla de inicio del enlace.
  const ficha = leerFicha(respuesta.ficha)
  const pideFotos = (['cedula_frente', 'cedula_reverso', 'selfie_cedula'] as const).some((c) => campoActivo(ficha, c))
  const referencias = [campoActivo(ficha, 'referencia_1'), campoActivo(ficha, 'referencia_2')].filter(Boolean).length
  const tener: Array<{ d: string; titulo: string; detalle: string }> = [
    pideFotos
      ? { d: ICONO_CEDULA, titulo: 'Su cédula', detalle: 'Le vamos a pedir fotos por delante y por detrás' }
      : { d: ICONO_CEDULA, titulo: 'Su cédula', detalle: 'Para escribir sus datos tal como aparecen' },
    ...(pideFotos ? [{ d: ICONO_LUZ, titulo: 'Buena luz', detalle: 'Para que las fotos se lean bien' }] : []),
    ...(referencias > 0
      ? [
          {
            d: ICONO_PERSONAS,
            titulo: referencias === 2 ? 'Dos referencias' : 'Una referencia',
            detalle: 'Nombre y teléfono de personas que lo conozcan',
          },
        ]
      : []),
  ]
  const vence = textoVencimiento(respuesta.expira_en, new Date())

  return (
    <Marco negocio={negocio}>
      <h1 className="text-[22px] font-semibold">
        {respuesta.nombre_referencia ? `Hola, ${respuesta.nombre_referencia}` : 'Hola'}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-tinta-2">
        {negocio} le pide algunos datos para estudiar su solicitud de préstamo. Le toma unos 5 minutos.
      </p>

      <section className="mt-6 overflow-hidden rounded-tarjeta border border-borde">
        <h2 className="border-b border-borde bg-superficie-2 px-3.5 py-2.5 text-[13px] font-semibold text-tinta-2">
          Tenga a la mano
        </h2>
        <ul className="flex flex-col">
          {tener.map((t) => (
            <li key={t.titulo} className="flex items-start gap-3 border-b border-borde-fila px-3.5 py-3 last:border-b-0">
              <span className="text-tinta-2">{icono(t.d, 'h-[22px] w-[22px] shrink-0')}</span>
              <span>
                <span className="block text-[15px] font-semibold">{t.titulo}</span>
                <span className="block text-[13.5px] text-tinta-3">{t.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-5 flex items-center gap-2 text-sm text-tinta-2">
        {icono(ICONO_RELOJ, 'h-4 w-4 shrink-0')}
        {/* La hora ya termina en "m." (p. m.): sin punto final extra. */}
        <span>Este enlace {vence}</span>
      </p>

      <div className="mt-auto flex flex-col gap-2 pt-8">
        <Boton grande disabled aria-describedby="disponible-pronto">
          Empezar
        </Boton>
        <p id="disponible-pronto" className="text-center text-[13px] text-tinta-3">
          Disponible pronto
        </p>
      </div>
    </Marco>
  )
}
