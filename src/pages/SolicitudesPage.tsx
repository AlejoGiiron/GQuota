import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import NuevoProspectoModal from '@/components/NuevoProspectoModal'
import Boton from '@/components/ui/Boton'
import ControlSegmentado from '@/components/ui/ControlSegmentado'
import EtiquetaEstado, { type Estado } from '@/components/ui/EtiquetaEstado'
import Tabla, { type ColumnaTabla } from '@/components/ui/Tabla'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useSolicitudes, type EnlaceCreado, type SolicitudLista } from '@/hooks/useSolicitudes'
import { fmtFecha } from '@/lib/formatters'
import { estadoVisual, fechaCorta, formatearCelular, hora, textoEnlace, type EstadoVisual } from '@/lib/solicitudes'

type Filtro = 'todas' | EstadoVisual

const ETIQUETA: Record<Exclude<EstadoVisual, 'anulada'>, { estado: Estado; texto: (s: SolicitudLista) => string }> = {
  por_revisar: { estado: 'completada', texto: () => 'Completada' },
  enviada: { estado: 'enviada', texto: () => 'Enviada' },
  vencida: { estado: 'inactivo', texto: () => 'Vencida' },
  aprobada: { estado: 'pagado', texto: (s) => (s.revisada_en ? `Aprobada ${fechaCorta(new Date(s.revisada_en))}` : 'Aprobada') },
  rechazada: { estado: 'rechazada', texto: (s) => (s.revisada_en ? `Rechazada ${fechaCorta(new Date(s.revisada_en))}` : 'Rechazada') },
}

const IconoMas = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const IconoBuscar = (
  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13ZM15.5 15.5L20 20" />
  </svg>
)
const IconoReloj = (
  <svg className="h-4 w-4 shrink-0 text-tinta-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export default function SolicitudesPage() {
  const { loading: cargandoConfig, esDueno, nombreNegocio } = useConfiguracion()
  const { solicitudes, loading, error, recargar, crearEnlace } = useSolicitudes(esDueno)

  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [generado, setGenerado] = useState<EnlaceCreado | null>(null)
  const [regenerando, setRegenerando] = useState<string | null>(null)
  // El tiempo restante de los enlaces avanza solo.
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const conEstado = useMemo(
    () => solicitudes.map((s) => ({ ...s, visual: estadoVisual(s.estado, s.expira_en, ahora) })),
    [solicitudes, ahora],
  )
  const cuenta = (v: EstadoVisual) => conEstado.filter((s) => s.visual === v).length
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const digitos = q.replace(/\D/g, '')
    return conEstado.filter(
      (s) =>
        (filtro === 'todas' || s.visual === filtro) &&
        (!q ||
          (s.nombre_referencia ?? '').toLowerCase().includes(q) ||
          (digitos.length > 0 && s.telefono.includes(digitos))),
    )
  }, [conEstado, filtro, busqueda])

  if (!cargandoConfig && !esDueno) return <Navigate to="/cobros" replace />

  function abrirNuevo() {
    setGenerado(null)
    setModalAbierto(true)
  }

  /** Reenviar / Generar otro: enlace nuevo al mismo celular; el anterior deja de funcionar. */
  async function regenerar(s: SolicitudLista) {
    setRegenerando(s.id)
    const { enlace, error: err } = await crearEnlace(s.telefono, s.nombre_referencia)
    setRegenerando(null)
    if (!enlace) {
      toast.error(err ?? 'No pudimos generar el enlace. Intenta de nuevo.')
      return
    }
    setGenerado(enlace)
    setModalAbierto(true)
  }

  function accion(s: (typeof conEstado)[number]): ReactNode {
    const clase = 'btn-enlace -my-3 min-h-11 md:min-h-10'
    if (s.visual === 'enviada' || s.visual === 'vencida') {
      return (
        <button type="button" className={clase} disabled={regenerando === s.id} onClick={() => regenerar(s)}>
          {regenerando === s.id ? 'Generando…' : s.visual === 'enviada' ? 'Reenviar' : 'Generar otro'}
        </button>
      )
    }
    // Revisar, ver cliente y ver una rechazada llegan con la revisión (fase 1C).
    const texto = s.visual === 'por_revisar' ? 'Revisar' : s.visual === 'aprobada' ? 'Ver cliente' : 'Ver'
    return (
      <button type="button" className={clase} disabled title="Llega con la revisión de solicitudes">
        {texto}
      </button>
    )
  }

  const nombre = (s: SolicitudLista) =>
    s.nombre_referencia ? (
      <span className="font-semibold">{s.nombre_referencia}</span>
    ) : (
      <span className="italic text-tinta-3">Sin nombre</span>
    )
  const enlace = (s: (typeof conEstado)[number]) => (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${s.visual === 'enviada' ? 'font-medium' : 'text-tinta-2'}`}>
      {s.visual === 'enviada' && IconoReloj}
      {textoEnlace(s, ahora)}
    </span>
  )
  const etiqueta = (s: (typeof conEstado)[number]) =>
    s.visual === 'anulada' ? null : <EtiquetaEstado estado={ETIQUETA[s.visual].estado}>{ETIQUETA[s.visual].texto(s)}</EtiquetaEstado>

  const columnas: ColumnaTabla<(typeof conEstado)[number]>[] = [
    { clave: 'prospecto', titulo: 'Prospecto', celda: nombre },
    { clave: 'celular', titulo: 'Celular', celda: (s) => <span className="text-tinta-2">{formatearCelular(s.telefono)}</span> },
    {
      clave: 'enviada',
      titulo: 'Enviada',
      celda: (s) => (
        <span className="whitespace-nowrap text-tinta-2">
          {fmtFecha(s.created_at)} · {hora(new Date(s.created_at))}
        </span>
      ),
    },
    { clave: 'enlace', titulo: 'Enlace', celda: enlace },
    { clave: 'estado', titulo: 'Estado', celda: etiqueta },
    { clave: 'accion', titulo: <span className="sr-only">Acción</span>, celda: accion, className: 'text-right' },
  ]

  const resumen = [
    `${conEstado.length} ${conEstado.length === 1 ? 'solicitud' : 'solicitudes'}`,
    `${cuenta('por_revisar')} por revisar`,
    `${cuenta('enviada')} esperando respuesta`,
    `${cuenta('aprobada')} aprobadas como clientes`,
  ]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Solicitudes</h1>
          <p className="mt-0.5 text-[13px] text-tinta-3">
            Fichas que llenan los prospectos por enlace. Cada enlace dura 24 horas o hasta que lo llenen.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/solicitudes/ficha" className="btn-secondary flex-1 md:flex-none">
            Configurar la ficha
          </Link>
          <Boton className="flex-1 md:flex-none" onClick={abrirNuevo}>
            {IconoMas}
            Nuevo prospecto
          </Boton>
        </div>
      </header>

      <section className="tarjeta overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-borde p-3 md:flex-row md:items-center md:px-4">
          <div className="relative md:w-72">
            {IconoBuscar}
            <input
              className="input pl-9"
              placeholder="Nombre o celular"
              aria-label="Buscar por nombre o celular"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <ControlSegmentado
            etiquetaAccesible="Filtrar solicitudes"
            valor={filtro}
            alCambiar={setFiltro}
            opciones={[
              { valor: 'todas', etiqueta: 'Todas', cantidad: conEstado.length },
              { valor: 'por_revisar', etiqueta: 'Por revisar', cantidad: cuenta('por_revisar') },
              { valor: 'enviada', etiqueta: 'Enviadas', cantidad: cuenta('enviada') },
              { valor: 'vencida', etiqueta: 'Vencidas', cantidad: cuenta('vencida') },
              { valor: 'aprobada', etiqueta: 'Aprobadas', cantidad: cuenta('aprobada') },
              { valor: 'rechazada', etiqueta: 'Rechazadas', cantidad: cuenta('rechazada') },
            ]}
          />
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-4" aria-label="Cargando solicitudes" role="status">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-control bg-superficie-2" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-tinta-2">{error}</p>
            <Boton variante="secundario" onClick={() => void recargar()}>
              Reintentar
            </Boton>
          </div>
        ) : conEstado.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="font-semibold">Todavía no hay solicitudes</p>
            <p className="max-w-sm text-sm text-tinta-2">
              Genere un enlace para que un prospecto llene su ficha desde el celular.
            </p>
            <Boton onClick={abrirNuevo}>
              {IconoMas}
              Nuevo prospecto
            </Boton>
          </div>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-tinta-2">No hay solicitudes con ese filtro.</p>
        ) : (
          <>
            {/* Escritorio: tabla */}
            <div className="hidden md:block [&_.tabla-contenedor]:rounded-none [&_.tabla-contenedor]:border-0">
              <Tabla etiqueta="Solicitudes" columnas={columnas} filas={visibles} claveFila={(s) => s.id} />
            </div>
            {/* Celular: tarjetas */}
            <ul className="md:hidden">
              {visibles.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 border-b border-borde-fila px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate">{nombre(s)}</div>
                      <div className="cifra text-[13px] text-tinta-3">{formatearCelular(s.telefono)}</div>
                    </div>
                    {etiqueta(s)}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[13.5px]">
                    {enlace(s)}
                    {accion(s)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {!loading && !error && conEstado.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-borde bg-superficie-2 px-4 py-3 text-sm">
            <span className="font-semibold">{resumen[0]}</span>
            <span className="text-tinta-3">{resumen.slice(1).join(' · ')}</span>
          </div>
        )}
      </section>

      <NuevoProspectoModal
        open={modalAbierto}
        onClose={() => {
          setModalAbierto(false)
          setGenerado(null)
        }}
        nombreNegocio={nombreNegocio}
        crearEnlace={crearEnlace}
        generado={generado}
      />
    </div>
  )
}
