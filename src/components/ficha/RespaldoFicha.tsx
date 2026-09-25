import { useRef } from 'react'
import type { EstadoFoto } from '@/components/ficha/FotoFicha'
import Boton from '@/components/ui/Boton'
import type { CamposCedula } from '@/lib/cedula'
import { fmtFecha } from '@/lib/formatters'

/** Cómo va la lectura del código del respaldo. */
export type EstadoLectura =
  | { estado: 'pendiente' }
  | { estado: 'leida'; campos: CamposCedula } // falta que el prospecto la confirme
  | { estado: 'confirmada' }
  | { estado: 'fallida' }
  | { estado: 'manual' } // eligió escribir sus datos a mano, sabiendo que quedan sin verificar

const IconoCamara = (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h3.5l1.5-2.5h8L17.5 8H21v11H3zM12 10.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z" />
  </svg>
)

const fecha = (iso: string | null) => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null
  return m ? fmtFecha(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : '—'
}
const puntos = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * La cédula por detrás, con lectura del código: escáner en vivo (o foto si no hay
 * cámara), confirmación de lo leído y, si no se lee, opciones para reintentar o
 * escribir a mano con aviso. Nunca se pasa a mano sin que el prospecto lo elija.
 */
export default function RespaldoFicha({
  foto,
  lectura,
  camara,
  sinCamara,
  error,
  alEscanear,
  alElegirFoto,
  alConfirmar,
  alEscribirAMano,
  alReintentar,
}: {
  foto: EstadoFoto
  lectura: EstadoLectura
  /** El navegador tiene cámara en vivo (getUserMedia) y no la negaron. */
  camara: boolean
  /** Se intentó abrir la cámara y no se pudo (permiso o soporte). */
  sinCamara: boolean
  error?: string
  alEscanear: () => void
  alElegirFoto: (archivo: File) => void
  alConfirmar: () => void
  alEscribirAMano: () => void
  alReintentar: () => void
}) {
  const inputCamara = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)
  const ocupada = foto.estado === 'procesando'
  const elegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (archivo) alElegirFoto(archivo)
  }

  const estadoTexto =
    foto.estado === 'procesando'
      ? foto.mensaje
      : foto.estado === 'error'
        ? foto.mensaje
        : lectura.estado === 'confirmada'
          ? 'Lista · leímos sus datos'
          : lectura.estado === 'leida'
            ? 'Leímos su cédula: confirme los datos'
            : lectura.estado === 'fallida'
              ? 'No pudimos leer el código de barras'
              : lectura.estado === 'manual'
                ? 'Escribirá sus datos a mano (sin verificar)'
                : 'Falta · de aquí leemos sus datos'
  const tono =
    foto.estado === 'error' || lectura.estado === 'fallida'
      ? 'text-estado-mora'
      : lectura.estado === 'confirmada'
        ? 'text-estado-al-dia'
        : 'text-tinta-3'

  const intentar = (
    <div className="flex flex-wrap gap-2">
      {camara ? (
        <Boton className="flex-1" onClick={alEscanear} disabled={ocupada}>
          {lectura.estado === 'pendiente' && foto.estado === 'vacia' ? 'Escanear el código' : 'Escanear otra vez'}
        </Boton>
      ) : (
        <Boton className="flex-1" onClick={() => inputCamara.current?.click()} disabled={ocupada}>
          {foto.estado === 'vacia' ? 'Tomar foto' : 'Tomar otra foto'}
        </Boton>
      )}
      <Boton variante="secundario" className="flex-1" onClick={() => inputGaleria.current?.click()} disabled={ocupada}>
        {camara ? 'Usar una foto guardada' : 'Subir de la galería'}
      </Boton>
    </div>
  )
  const aMano = (
    <div className="border-t border-borde-fila pt-2">
      <Boton variante="enlace" className="min-h-11" onClick={alEscribirAMano} disabled={ocupada}>
        Escribir mis datos a mano
      </Boton>
      <p className="text-[13px] text-tinta-3">Si los escribe a mano, sus datos quedan marcados como sin verificar.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 border-b border-borde-fila py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-tarjeta border border-borde bg-superficie-2 text-tinta-3">
          {foto.estado === 'lista' ? <img src={foto.vistaPrevia} alt="" className="h-full w-full object-cover" /> : IconoCamara}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">
            Cédula por detrás <span className="text-[13px] font-normal text-tinta-3">(opcional)</span>
          </div>
          <div className={`text-[13px] ${tono}`} aria-live="polite">
            {estadoTexto}
          </div>
        </div>
      </div>

      {sinCamara && lectura.estado !== 'confirmada' && (
        <p className="text-[13px] text-tinta-2">No pudimos usar la cámara en vivo aquí: tome una foto o súbala de la galería.</p>
      )}

      {!ocupada && lectura.estado === 'pendiente' && foto.estado !== 'error' && (
        <>
          {intentar}
          {aMano}
        </>
      )}

      {!ocupada && lectura.estado === 'leida' && (
        <div className="flex flex-col gap-3 rounded-tarjeta border border-estado-al-dia bg-estado-al-dia-fondo p-3.5">
          <p className="text-[14px] font-semibold text-tinta">Leímos de su cédula:</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
            <dt className="text-tinta-3">Número</dt>
            <dd className="cifra font-semibold text-tinta">{puntos(lectura.campos.cedula)}</dd>
            <dt className="text-tinta-3">Nombres</dt>
            <dd className="font-semibold text-tinta">{lectura.campos.nombres}</dd>
            <dt className="text-tinta-3">Apellidos</dt>
            <dd className="font-semibold text-tinta">{lectura.campos.apellidos}</dd>
            <dt className="text-tinta-3">Nacimiento</dt>
            <dd className="cifra font-semibold text-tinta">{fecha(lectura.campos.fecha_nacimiento)}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Boton className="flex-1" onClick={alConfirmar}>
              Sí, son mis datos
            </Boton>
            <Boton variante="secundario" className="flex-1" onClick={alReintentar}>
              No, volver a intentar
            </Boton>
          </div>
        </div>
      )}

      {!ocupada && (lectura.estado === 'fallida' || foto.estado === 'error') && lectura.estado !== 'manual' && (
        <div className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie-2 p-3.5">
          {lectura.estado === 'fallida' && (
            <>
              <p className="text-[14px] font-semibold text-tinta">No pudimos leer el código de barras de esta foto. Pruebe esto:</p>
              <ul className="list-disc pl-5 text-[14px] leading-relaxed text-tinta-2">
                <li>Incline un poco la cédula para que no le dé reflejo.</li>
                <li>Acérquela hasta que el código de barras se vea grande y completo.</li>
                <li>Busque buena luz y deje quieto el celular.</li>
              </ul>
            </>
          )}
          {intentar}
          {aMano}
        </div>
      )}

      {!ocupada && lectura.estado === 'manual' && (
        <div className="flex flex-wrap items-center gap-x-3 text-[14px] text-tinta-2">
          <span>Eligió escribir sus datos a mano: quedan marcados como sin verificar.</span>
          <Boton variante="enlace" className="min-h-11" onClick={alReintentar}>
            Volver a intentar la lectura
          </Boton>
        </div>
      )}

      {!ocupada && lectura.estado === 'confirmada' && (
        <div>
          <Boton variante="enlace" className="min-h-11" onClick={alReintentar}>
            Repetir la foto
          </Boton>
        </div>
      )}

      {error && <p className="text-[13px] text-estado-mora">{error}</p>}
      <input ref={inputCamara} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={elegir} />
      <input ref={inputGaleria} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={elegir} />
    </div>
  )
}
