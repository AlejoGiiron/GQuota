import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import CorregirDatosModal from '@/components/solicitud/CorregirDatosModal'
import FotosSolicitud from '@/components/solicitud/FotosSolicitud'
import TablaDatos from '@/components/solicitud/TablaDatos'
import Boton from '@/components/ui/Boton'
import EtiquetaEstado from '@/components/ui/EtiquetaEstado'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useClientes } from '@/hooks/useClientes'
import { urlFoto, useSolicitud, type ClienteExistente, type FotosSolicitud as Fotos } from '@/hooks/useSolicitud'
import type { CamposCedula } from '@/lib/cedula'
import type { DatosFicha } from '@/lib/ficha'
import { fmtFecha } from '@/lib/formatters'
import { leerCedulaDeFoto } from '@/lib/lector-cedula'
import {
  camposCorregidos,
  compararConCedula,
  formatearCedula,
  origenDe,
  valorVisible,
  GRUPOS_REVISION,
  type CampoRevision,
  type DatosRevision,
  type OrigenDato,
  type Verificacion,
} from '@/lib/revision'
import { hora } from '@/lib/solicitudes'

const soloDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const fechaHora = (iso: string) => `${fmtFecha(iso)} a las ${hora(new Date(iso))}`
const NOMBRE_CAMPO = Object.fromEntries(GRUPOS_REVISION.flatMap((g) => g.campos.map((c) => [c.campo, c.nombre]))) as Record<CampoRevision, string>

/**
 * Revisar una solicitud completada (fase 1C; design/paquete-2a, Solicitudes 4 y
 * 4b). Al abrirla, el navegador del dueño vuelve a leer el código del respaldo con
 * el lector de la 1B y guarda el resultado; la huella se descarta igual que allá.
 */
export default function RevisarSolicitudPage() {
  const { solicitudId } = useParams()
  const navigate = useNavigate()
  const { esDueno, solicitudesActivas, loading: cargandoConfig } = useConfiguracion()
  const { solicitud, loading, error, guardarVerificacion, aprobar, rechazar } = useSolicitud(solicitudId)
  const { clientes } = useClientes()

  const [editados, setEditados] = useState<DatosFicha | null>(null)
  const [lectura, setLectura] = useState<'lista' | 'leyendo' | 'fallo'>('lista')
  const [modal, setModal] = useState<'corregir' | 'aprobar' | 'rechazar' | null>(null)
  const [duplicado, setDuplicado] = useState<ClienteExistente | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const releida = useRef(false)

  const original = useMemo(() => (solicitud?.datos ?? {}) as DatosFicha, [solicitud?.datos])
  const actuales = editados ?? original
  const fotos = (solicitud?.fotos ?? null) as Fotos | null
  const verificacion = (solicitud?.verificacion ?? null) as Verificacion | null
  const detalle = (solicitud?.verificacion_detalle ?? null) as Record<string, string> | null
  const corregidos = editados ? camposCorregidos(original, editados) : []

  /** Relee el respaldo guardado y guarda el resultado. Sin respaldo: sin verificar. */
  const releer = useCallback(async () => {
    if (!solicitud) return
    setLectura('leyendo')
    let leidos: CamposCedula | null = null
    try {
      if (fotos?.respaldo) {
        const url = await urlFoto(fotos.respaldo)
        if (!url) throw new Error('url')
        const foto = await (await fetch(url)).blob()
        leidos = await leerCedulaDeFoto(foto) // solo los campos; la huella se descarta ahí
      }
    } catch {
      setLectura('fallo')
      return
    }
    const { resultado, distintos } = compararConCedula(original, leidos)
    const ok = await guardarVerificacion(resultado, resultado === 'discrepancia' ? distintos : null)
    setLectura(ok ? 'lista' : 'fallo')
  }, [solicitud, fotos?.respaldo, original, guardarVerificacion])

  useEffect(() => {
    if (!solicitud || releida.current) return
    if (solicitud.estado === 'completada' && solicitud.verificacion === null) {
      releida.current = true
      void releer()
    }
  }, [solicitud, releer])

  // Cliente con la misma cédula (aviso previo; aprobar_solicitud es quien decide).
  const existente = useMemo(() => {
    const ced = soloDigitos(actuales.cedula)
    return ced ? clientes.find((c) => soloDigitos(c.documento) === ced) ?? null : null
  }, [clientes, actuales.cedula])

  if (!cargandoConfig && (!esDueno || !solicitudesActivas)) return <Navigate to={esDueno ? '/' : '/cobros'} replace />
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-16 animate-pulse rounded-tarjeta bg-superficie-2" />
        <div className="h-72 animate-pulse rounded-tarjeta bg-superficie-2" />
      </div>
    )
  }
  if (error || !solicitud) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[15px] text-tinta">{error ?? 'No encontramos esta solicitud.'}</p>
        <Link to="/solicitudes" className="btn-secondary">
          Volver a Solicitudes
        </Link>
      </div>
    )
  }

  const nombre = [original.nombres, original.apellidos].filter(Boolean).join(' ') || solicitud.nombre_referencia || 'Sin nombre'
  const porRevisar = solicitud.estado === 'completada'
  const datosTabla: DatosRevision = { ...actuales, celular: solicitud.telefono }
  const origenes = Object.fromEntries(
    (Object.keys(datosTabla) as CampoRevision[]).map((c) => [
      c,
      origenDe(c, c === 'celular' ? solicitud.telefono : original[c as keyof DatosFicha], datosTabla[c], verificacion, detalle),
    ]),
  ) as Partial<Record<CampoRevision, OrigenDato>>
  const distintos = Object.entries(detalle ?? {}).filter(([c]) => c in NOMBRE_CAMPO) as Array<[CampoRevision, string]>
  const avisos = Object.fromEntries(
    distintos
      .filter(([c]) => origenes[c] === 'discrepancia')
      .map(([c, leido]) => [c, `El código de barras de la foto dice ${valorVisible(c, leido)}. Revise la foto antes de aprobar.`]),
  ) as Partial<Record<CampoRevision, string>>

  async function confirmarAprobar(clienteExistente?: string) {
    setEnviando(true)
    const { ok, error: err } = await aprobar(actuales, clienteExistente)
    setEnviando(false)
    if (!ok) {
      toast.error(err ?? 'No pudimos aprobar la solicitud.')
      return
    }
    if (ok.resultado === 'duplicado') {
      setModal(null)
      setDuplicado(ok.cliente)
      return
    }
    toast.success(ok.vinculado ? 'Solicitud vinculada al cliente.' : 'Cliente creado.')
    navigate(`/clientes/${ok.cliente_id}?${ok.vinculado ? 'vinculada' : 'aprobada'}=1`)
  }

  async function confirmarRechazo() {
    setEnviando(true)
    const err = await rechazar(motivo)
    setEnviando(false)
    if (err) {
      toast.error(err)
      return
    }
    setModal(null)
    toast.success('Solicitud rechazada. Las fotos se borran ahora.')
  }

  const estado =
    solicitud.estado === 'completada' ? <EtiquetaEstado estado="completada">Por revisar</EtiquetaEstado>
    : solicitud.estado === 'aprobada' ? <EtiquetaEstado estado="pagado">Aprobada</EtiquetaEstado>
    : solicitud.estado === 'rechazada' ? <EtiquetaEstado estado="rechazada">Rechazada</EtiquetaEstado>
    : <EtiquetaEstado estado="inactivo">Sin completar</EtiquetaEstado>

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3">
        <nav aria-label="Ruta" className="text-[13px] text-tinta-3">
          <Link to="/solicitudes" className="-my-3 inline-flex min-h-11 items-center font-semibold text-marca-texto hover:underline md:min-h-10">
            Solicitudes
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{nombre}</span>
        </nav>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-tinta">{nombre}</h1>
            <p className="mt-1 text-[13px] text-tinta-3">
              Enviada el {fechaHora(solicitud.created_at)}
              {solicitud.completada_en && ` · completada el ${fechaHora(solicitud.completada_en)}`}
            </p>
            <div className="mt-2">{estado}</div>
          </div>
          {porRevisar && (
            <div className="flex flex-wrap gap-2">
              <Boton variante="destructivo" className="flex-1 md:flex-none" onClick={() => setModal('rechazar')} disabled={enviando}>
                Rechazar
              </Boton>
              <Boton className="flex-1 md:flex-none" onClick={() => setModal('aprobar')} disabled={enviando || lectura === 'leyendo'}>
                Aprobar como cliente
              </Boton>
            </div>
          )}
        </div>
      </div>

      {/* Estado de la revisión */}
      {solicitud.estado === 'aprobada' && solicitud.cliente_id && (
        <div className="tarjeta flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:px-5">
          <p className="text-[14.5px] text-tinta">
            Aprobada el {solicitud.revisada_en ? fmtFecha(solicitud.revisada_en) : '—'}: el cliente ya tiene estos datos y las fotos en su ficha.
          </p>
          <Link to={`/clientes/${solicitud.cliente_id}`} className="btn-secondary">
            Ver cliente
          </Link>
        </div>
      )}
      {solicitud.estado === 'rechazada' && (
        <div className="tarjeta flex flex-col gap-1 p-4 md:px-5">
          <p className="text-[14.5px] text-tinta">
            Rechazada el {solicitud.revisada_en ? fmtFecha(solicitud.revisada_en) : '—'}.
            {solicitud.motivo_rechazo && <> Motivo: {solicitud.motivo_rechazo}</>}
          </p>
          <p className="text-[13px] text-tinta-3">
            {solicitud.fotos_borradas_en ? 'Las fotos ya se borraron. ' : 'Las fotos se están borrando. '}
            Los datos se borran 30 días después del rechazo.
          </p>
        </div>
      )}

      {porRevisar && lectura === 'leyendo' && (
        <p className="text-[14px] text-tinta-2" role="status">
          Leyendo el código de la foto de atrás…
        </p>
      )}
      {porRevisar && lectura === 'fallo' && (
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-tinta-2" role="status">
          No se pudo leer la foto ahora.
          <button type="button" className="btn-enlace -my-3 min-h-11 md:min-h-10" onClick={() => void releer()}>
            Intentar otra vez
          </button>
        </div>
      )}
      {lectura !== 'leyendo' && verificacion === 'discrepancia' && distintos.length > 0 && (
        <div className="rounded-tarjeta border border-estado-mora bg-estado-mora-fondo p-4 md:px-5" role="alert">
          <p className="font-semibold text-estado-mora">
            {distintos.some(([c]) => c === 'cedula')
              ? 'El número de cédula no coincide con el código de barras'
              : 'Hay datos que no coinciden con el código de barras'}
          </p>
          <p className="mt-1 text-[14px] text-tinta">Revise la foto de la cédula antes de aprobar.</p>
          <table className="mt-3 w-full text-left text-[14px]">
            <thead className="text-[12.5px] text-tinta-2">
              <tr>
                <th className="pb-1 pr-3 font-semibold">Dato</th>
                <th className="pb-1 pr-3 font-semibold">Escribió el prospecto</th>
                <th className="pb-1 font-semibold">Dice el código</th>
              </tr>
            </thead>
            <tbody className="cifra">
              {distintos.map(([c, leido]) => (
                <tr key={c} className="border-t border-borde align-top">
                  <td className="py-1.5 pr-3 text-tinta-2">{NOMBRE_CAMPO[c]}</td>
                  <td className="py-1.5 pr-3 text-tinta">{valorVisible(c, original[c as keyof DatosFicha]) || '—'}</td>
                  <td className="py-1.5 font-semibold text-tinta">{valorVisible(c, leido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {porRevisar && lectura === 'lista' && verificacion === 'verificado' && (
        <p className="text-[14px] text-tinta-2">
          <EtiquetaEstado estado="al-dia">Verificado</EtiquetaEstado>
          <span className="ml-2">Los datos de la cédula coinciden con el código de barras de la foto de atrás.</span>
        </p>
      )}
      {porRevisar && lectura === 'lista' && verificacion === 'sin_verificar' && (
        <p className="text-[14px] text-tinta-2">
          {fotos?.respaldo
            ? 'No se pudo leer el código de la foto de atrás: los datos de la cédula quedan escritos a mano, sin verificar.'
            : 'El prospecto no entregó la foto de atrás: los datos de la cédula quedan escritos a mano, sin verificar.'}
          {fotos?.respaldo && (
            <button type="button" className="btn-enlace -my-3 ml-2 min-h-11 md:min-h-10" onClick={() => void releer()}>
              Volver a leer
            </button>
          )}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-3" aria-labelledby="titulo-datos">
            <div className="flex items-center justify-between gap-3">
              <h2 id="titulo-datos" className="text-base font-semibold text-tinta">
                Datos
              </h2>
              {porRevisar && (
                <Boton variante="secundario" onClick={() => setModal('corregir')}>
                  Corregir datos
                </Boton>
              )}
            </div>
            <TablaDatos datos={datosTabla} origenes={origenes} avisos={avisos} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="titulo-fotos">
            <h2 id="titulo-fotos" className="text-base font-semibold text-tinta">
              Fotos
            </h2>
            <FotosSolicitud fotos={fotos} borradasEn={solicitud.fotos_borradas_en} />
          </section>

          {solicitud.autorizacion_en && (
            <section className="tarjeta p-4 text-[14px] text-tinta-2 md:px-5" aria-label="Autorización">
              <p>
                Autorizó el tratamiento de datos el {fechaHora(solicitud.autorizacion_en)} (texto {solicitud.autorizacion_version}).
              </p>
              <p className="mt-1">
                Foto de atrás de la cédula: {solicitud.autorizacion_respaldo ? 'autorizó entregarla.' : 'no la autorizó.'}
              </p>
            </section>
          )}
        </div>

        {porRevisar && (
          <aside className="tarjeta flex flex-col gap-3 p-4 md:px-5 lg:sticky lg:top-0" aria-label="Al aprobar">
            <h2 className="text-base font-semibold text-tinta">Al aprobar</h2>
            <p className="text-[14px] text-tinta-2">
              Se crea el cliente con estos datos y las fotos quedan en su ficha. Después le ofrecemos crear el primer préstamo.
            </p>
            {existente ? (
              <p className="text-[14px] text-tinta">
                Ya existe un cliente con esta cédula:{' '}
                <Link to={`/clientes/${existente.id}`} className="font-semibold text-marca-texto hover:underline">
                  {existente.nombre}
                </Link>
                . Al aprobar podrá vincular la solicitud a ese cliente, sin cambiar sus datos.
              </p>
            ) : (
              actuales.cedula && (
                <p className="text-[14px] text-tinta-2">
                  La cédula <span className="cifra">{formatearCedula(actuales.cedula)}</span> no aparece entre sus clientes.
                </p>
              )
            )}
            {corregidos.length > 0 && (
              <p className="text-[14px] text-tinta-2">
                Corrigió {corregidos.length === 1 ? '1 dato' : `${corregidos.length} datos`}.{' '}
                <button type="button" className="btn-enlace -my-3 min-h-11 md:min-h-10" onClick={() => setEditados(null)}>
                  Deshacer
                </button>
              </p>
            )}
          </aside>
        )}
      </div>

      <CorregirDatosModal
        open={modal === 'corregir'}
        datos={actuales}
        onClose={() => setModal(null)}
        onGuardar={(d) => {
          setEditados(camposCorregidos(original, d).length ? d : null)
          setModal(null)
        }}
      />

      <Modal
        open={modal === 'aprobar'}
        onClose={() => setModal(null)}
        titulo="Aprobar como cliente"
        footer={
          <>
            <Boton variante="secundario" onClick={() => setModal(null)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton onClick={() => void confirmarAprobar()} disabled={enviando}>
              {enviando ? 'Aprobando…' : 'Aprobar'}
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[15px] text-tinta">
          <p>
            Se crea el cliente <strong className="font-semibold">{[actuales.nombres, actuales.apellidos].filter(Boolean).join(' ')}</strong> con
            estos datos y las fotos quedan en su ficha.
          </p>
          {verificacion === 'discrepancia' && Object.values(origenes).includes('discrepancia') && (
            <p className="rounded-control border border-estado-mora bg-estado-mora-fondo p-3 text-[14px]" role="alert">
              Hay datos que no coinciden con el código de barras. Si aprueba así, quedan marcados «No coincide con el código» en la
              ficha del cliente. ¿Revisó la foto?
            </p>
          )}
          {corregidos.length > 0 && (
            <p className="text-[14px] text-tinta-2">
              Corrigió {corregidos.length === 1 ? '1 dato' : `${corregidos.length} datos`}: quedan marcados «Corregido por el dueño».
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={duplicado !== null}
        onClose={() => setDuplicado(null)}
        titulo="Ya existe un cliente con esta cédula"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Boton variante="secundario" onClick={() => setDuplicado(null)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton
              variante="destructivo"
              onClick={() => {
                setDuplicado(null)
                setModal('rechazar')
              }}
              disabled={enviando}
            >
              Rechazar la solicitud
            </Boton>
            <Boton onClick={() => duplicado && void confirmarAprobar(duplicado.id)} disabled={enviando}>
              {enviando ? 'Vinculando…' : 'Vincular a este cliente'}
            </Boton>
          </div>
        }
      >
        {duplicado && (
          <div className="flex flex-col gap-3 text-[15px] text-tinta">
            <p>
              <Link to={`/clientes/${duplicado.id}`} className="font-semibold text-marca-texto hover:underline">
                {duplicado.nombre}
              </Link>{' '}
              es cliente desde el {fmtFecha(duplicado.desde)} y tiene{' '}
              {duplicado.prestamos === 1 ? '1 préstamo' : `${duplicado.prestamos} préstamos`}.
            </p>
            <p className="text-[14px] text-tinta-2">
              Si la vincula, la solicitud queda aprobada a nombre de ese cliente y sus datos no cambian. Nunca se crea un cliente
              repetido.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={modal === 'rechazar'}
        onClose={() => setModal(null)}
        titulo="Rechazar solicitud"
        footer={
          <>
            <Boton variante="secundario" onClick={() => setModal(null)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="destructivo" onClick={() => void confirmarRechazo()} disabled={enviando}>
              {enviando ? 'Rechazando…' : 'Rechazar'}
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[15px] text-tinta">Las fotos se borran ahora. Los datos se borran en 30 días.</p>
          <div className="campo">
            <label htmlFor="motivo-rechazo" className="campo__etiqueta">
              Motivo (opcional)
            </label>
            <textarea
              id="motivo-rechazo"
              className="input h-auto min-h-[88px] py-2.5"
              maxLength={200}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-describedby="motivo-ayuda"
            />
            <p id="motivo-ayuda" className="campo__ayuda">
              Solo lo ve usted. {motivo.length}/200
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
