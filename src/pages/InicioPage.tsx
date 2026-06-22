import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import Avatar from '@/components/Avatar'
import PagoModal from '@/components/PagoModal'
import PagoCuotasModal from '@/components/PagoCuotasModal'
import PagoCuotaFijaModal from '@/components/PagoCuotaFijaModal'
import { EstadoBadge } from '@/components/PrestamoBadges'
import { useAuth } from '@/contexts/AuthContext'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useClientes } from '@/hooks/useClientes'
import { usePrestamos } from '@/hooks/usePrestamos'
import { useMovimientosDelMes } from '@/hooks/useMovimientosDelMes'
import { useCuotasActivas } from '@/hooks/useCuotasActivas'
import { calcularCobrosHoy, calcularMetricas, topDeudores } from '@/lib/cartera'
import { fmtCOP } from '@/lib/formatters'
import type { Cliente, Prestamo } from '@/types/db'

const IconBillete = (
  <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
)
const IconCartera = (
  <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7.5A2.5 2.5 0 015.5 5H18a2 2 0 012 2M3 7.5V18a2 2 0 002 2h14a1.5 1.5 0 001.5-1.5V10A1.5 1.5 0 0019 8.5H5" />
  </svg>
)
const IconAlza = (
  <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16l5-5 4 4 7-7" />
    <path d="M16 8h5v5" />
  </svg>
)
const IconAlerta = (
  <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l9.5 16.5H2.5L12 3Z" />
    <path d="M12 10v4M12 17v0" />
  </svg>
)

function fechaLarga(d: Date): string {
  const s = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Tono = 'verde' | 'pizarra' | 'ambar' | 'rojo'
const CHIP: Record<Tono, string> = {
  verde: 'bg-green-tint text-green',
  pizarra: 'bg-[#eef2f0] text-[#3f5b50]',
  ambar: 'bg-amber-tint text-amber',
  rojo: 'bg-red-tint-2 text-red',
}
const VALOR: Record<Tono, string> = {
  verde: 'text-text',
  pizarra: 'text-text',
  ambar: 'text-amber',
  rojo: 'text-red',
}

function MetricCard({
  etiqueta,
  valor,
  sub,
  icono,
  tono,
}: {
  etiqueta: string
  valor: string
  sub: string
  icono: ReactNode
  tono: Tono
}) {
  return (
    <div className="card flex min-w-[60%] snap-start flex-col gap-3 p-5 md:min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-text-2">{etiqueta}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-[10px] ${CHIP[tono]}`}>{icono}</span>
      </div>
      <div className={`mono text-2xl font-bold tracking-tight ${VALOR[tono]}`}>{valor}</div>
      <div className="text-xs font-medium text-muted">{sub}</div>
    </div>
  )
}

export default function InicioPage() {
  const { user } = useAuth()
  const { esDueno, loading: cargandoRol } = useConfiguracion()
  const { prestamos, registrarPago, registrarPagoCuotas, registrarPagoCuotaFija } = usePrestamos()
  const { clientes } = useClientes()
  const { movimientos, recargar: recargarMovs } = useMovimientosDelMes()
  const { cuotas, recargar: recargarCuotas } = useCuotasActivas()

  const [pagoPrestamo, setPagoPrestamo] = useState<Prestamo | null>(null)

  const hoy = useMemo(() => new Date(), [])
  const clientePorId = useMemo(
    () => new Map<string, Cliente>(clientes.map((c) => [c.id, c])),
    [clientes],
  )
  const metricas = useMemo(() => calcularMetricas(prestamos, movimientos), [prestamos, movimientos])
  const cobros = useMemo(
    () => calcularCobrosHoy(prestamos, movimientos, cuotas, hoy),
    [prestamos, movimientos, cuotas, hoy],
  )
  const deudores = useMemo(() => topDeudores(prestamos), [prestamos])

  const nombre = user?.email?.split('@')[0] ?? ''
  const nombreDe = (p: Prestamo) => clientePorId.get(p.cliente_id)?.nombre ?? 'Cliente'
  const pct = cobros.programados > 0 ? Math.round((cobros.cobrados / cobros.programados) * 100) : 0

  async function onRegistrar(monto: number, metodo: string) {
    if (!pagoPrestamo) return null
    const { resultado, error } = await registrarPago(pagoPrestamo.id, monto, metodo)
    if (error) {
      toast.error(error)
      return null
    }
    toast.success('Pago registrado.')
    recargarMovs() // refresca ganancia del mes y "cobrado"
    return resultado
  }

  async function onRegistrarCuotas(abono: number, metodo: string, soloInteres: boolean) {
    if (!pagoPrestamo) return false
    const { error } = await registrarPagoCuotas(pagoPrestamo.id, abono, metodo, soloInteres)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Pago registrado.')
    recargarMovs()
    recargarCuotas()
    return true
  }

  async function onRegistrarCuotaFija(monto: number, metodo: string) {
    if (!pagoPrestamo) return false
    const { error } = await registrarPagoCuotaFija(pagoPrestamo.id, monto, metodo)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Pago registrado.')
    recargarMovs()
    recargarCuotas()
    return true
  }

  // El cobrador no ve el dashboard de ganancias: su inicio es Cobros (lo operativo).
  // La seguridad real está en la base; esto es la cara visible del permiso.
  if (!cargandoRol && !esDueno) {
    return <Navigate to="/cobros" replace />
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">
          Hola{nombre ? `, ${nombre}` : ''} 👋
        </h1>
        <p className="mt-0.5 text-sm text-text-2">{fechaLarga(hoy)}</p>
      </div>

      {/* Métricas: franja deslizable en móvil, grid de 4 en desktop */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
        <MetricCard
          etiqueta="Total prestado"
          valor={fmtCOP(metricas.totalPrestado)}
          sub={`${metricas.prestamosActivos} préstamos activos`}
          icono={IconBillete}
          tono="verde"
        />
        <MetricCard
          etiqueta="Saldo por cobrar"
          valor={fmtCOP(metricas.saldoPorCobrar)}
          sub={`en ${metricas.clientesConActivo} clientes`}
          icono={IconCartera}
          tono="pizarra"
        />
        <MetricCard
          etiqueta="Ganancia del mes"
          valor={fmtCOP(metricas.gananciaMes)}
          sub="intereses cobrados"
          icono={IconAlza}
          tono="ambar"
        />
        <MetricCard
          etiqueta="Préstamos en mora"
          valor={fmtCOP(metricas.montoEnMora)}
          sub={`${metricas.prestamosEnMora} vencidos`}
          icono={IconAlerta}
          tono="rojo"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.55fr_1fr]">
        {/* Cobros de hoy */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-text">Cobros de hoy</h2>
              <p className="mt-0.5 text-sm text-text-2">
                {cobros.programados} programados ·{' '}
                <span className="mono font-bold text-text">{fmtCOP(cobros.porCobrar)}</span> por cobrar
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[13px] font-bold text-text-2">
                <b className="text-green-700">{cobros.cobrados}</b> de {cobros.programados} cobrados
              </span>
              <div className="h-2 w-[150px] overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#10b981] to-green"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {cobros.items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-2">
              No tienes cobros programados para hoy.
            </p>
          ) : (
            <div>
              {cobros.items.map(({ prestamo, montoACobrar, cobrado }) => (
                <div
                  key={prestamo.id}
                  className="flex items-center gap-3 border-t border-line-soft px-5 py-3 first:border-t-0"
                >
                  <Avatar nombre={nombreDe(prestamo)} size={44} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <Link
                      to={`/prestamos/${prestamo.id}`}
                      className="truncate text-[15px] font-bold text-text hover:underline"
                    >
                      {nombreDe(prestamo)}
                    </Link>
                    <div className="text-xs text-muted">Interés del periodo</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="mono text-[15px] font-bold text-text">{fmtCOP(montoACobrar)}</div>
                    <div className="text-[11px] font-semibold text-muted">a cobrar</div>
                  </div>
                  {cobrado ? (
                    <span className="shrink-0 text-sm font-bold text-green-700">Cobrado ✓</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary shrink-0 !h-9 !px-3 !text-[13px]"
                      onClick={() => setPagoPrestamo(prestamo)}
                    >
                      Registrar pago
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top deudores */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <h2 className="text-base font-bold text-text">Top deudores</h2>
            <Link to="/prestamos" className="text-[13px] font-bold text-green-700 hover:underline">
              Ver todos →
            </Link>
          </div>
          {deudores.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-2">Sin préstamos activos.</p>
          ) : (
            <div>
              {deudores.map((p) => (
                <Link
                  key={p.id}
                  to={`/prestamos/${p.id}`}
                  className="flex items-center gap-3 border-t border-line-soft px-5 py-3 transition-colors first:border-t-0 hover:bg-bg"
                >
                  <Avatar nombre={nombreDe(p)} size={42} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[14.5px] font-bold text-text">{nombreDe(p)}</div>
                    <div className="text-xs text-muted">Saldo pendiente</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="mono text-[14.5px] font-bold text-text">{fmtCOP(p.saldo_capital)}</span>
                    <EstadoBadge estado={p.estado} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {pagoPrestamo && pagoPrestamo.tipo === 'cuota_fija' ? (
        <PagoCuotaFijaModal
          open
          prestamo={pagoPrestamo}
          clienteNombre={nombreDe(pagoPrestamo)}
          onClose={() => setPagoPrestamo(null)}
          onRegistrar={onRegistrarCuotaFija}
        />
      ) : pagoPrestamo && pagoPrestamo.tipo === 'cuotas' ? (
        <PagoCuotasModal
          open
          prestamo={pagoPrestamo}
          clienteNombre={nombreDe(pagoPrestamo)}
          onClose={() => setPagoPrestamo(null)}
          onRegistrar={onRegistrarCuotas}
        />
      ) : pagoPrestamo ? (
        <PagoModal
          open
          prestamo={pagoPrestamo}
          clienteNombre={nombreDe(pagoPrestamo)}
          onClose={() => setPagoPrestamo(null)}
          onRegistrar={onRegistrar}
        />
      ) : null}
    </div>
  )
}
