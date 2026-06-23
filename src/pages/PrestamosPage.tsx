import { useMemo, useState } from 'react'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { toast } from 'sonner'
import Avatar from '@/components/Avatar'
import PrestamoFormModal from '@/components/PrestamoFormModal'
import { EstadoBadge, TipoOModoBadge, tasaMensualTexto } from '@/components/PrestamoBadges'
import type { PrestamosOutletContext } from '@/components/PrestamoFicha'
import { useClientes } from '@/hooks/useClientes'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useEquipo } from '@/hooks/useEquipo'
import {
  usePrestamos,
  type PrestamoCuotasInput,
  type PrestamoCuotaFijaInput,
  type PrestamoInput,
} from '@/hooks/usePrestamos'
import { fmtCOP } from '@/lib/formatters'

const IconMas = (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const IconPrestamos = (
  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </svg>
)

function FilaSkeleton() {
  return (
    <div className="flex items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0">
      <div className="h-[42px] w-[42px] shrink-0 animate-pulse rounded-xl bg-line-soft" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-line-soft" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-line-soft" />
      </div>
    </div>
  )
}

export default function PrestamosPage() {
  const {
    prestamos,
    loading,
    error,
    crear,
    crearCuotas,
    crearCuotaFija,
    registrarPago,
    registrarPagoCuotas,
    registrarPagoCuotaFija,
    asignarCobrador,
  } = usePrestamos()
  const { clientes } = useClientes()
  const { esDueno } = useConfiguracion()
  // El equipo (cobradores) es solo-dueño: el cobrador no asigna ni ve esta lista.
  const { cobradoresActivos, miembroPorId } = useEquipo(esDueno)
  const detalle = useMatch('/prestamos/:prestamoId')

  const [modalAbierto, setModalAbierto] = useState(false)

  const clientePorId = useMemo(() => {
    const map = new Map(clientes.map((c) => [c.id, c]))
    return map
  }, [clientes])

  async function handleGuardar(input: PrestamoInput): Promise<boolean> {
    const { error } = await crear(input)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Préstamo creado.')
    return true
  }

  async function handleGuardarCuotas(input: PrestamoCuotasInput): Promise<boolean> {
    const { error } = await crearCuotas(input)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Préstamo de cuotas creado.')
    return true
  }

  async function handleGuardarCuotaFija(input: PrestamoCuotaFijaInput): Promise<boolean> {
    const { error } = await crearCuotaFija(input)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Préstamo de cuota fija creado.')
    return true
  }

  const ctx: PrestamosOutletContext = {
    prestamos,
    loading,
    clientePorId,
    registrarPago,
    registrarPagoCuotas,
    registrarPagoCuotaFija,
    esDueno,
    cobradores: cobradoresActivos,
    miembroPorId,
    asignarCobrador,
  }

  return (
    <div className="flex h-full flex-col md:flex-row md:gap-6">
      {/* ── Lista ── */}
      <section className={`min-w-0 flex-col gap-4 md:basis-3/5 ${detalle ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Préstamos{' '}
            {!loading && prestamos.length > 0 && (
              <span className="text-base font-bold text-muted">({prestamos.length})</span>
            )}
          </h1>
          {esDueno && (
            <button type="button" className="btn-primary" onClick={() => setModalAbierto(true)}>
              {IconMas}
              <span>Nuevo préstamo</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="card overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <FilaSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-text">{error}</p>
          </div>
        ) : prestamos.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-green-tint text-green">
              {IconPrestamos}
            </span>
            <div>
              <p className="text-sm font-bold text-text">Aún no hay préstamos</p>
              <p className="mt-1 text-sm text-text-2">
                {esDueno
                  ? 'Crea el primero para empezar a llevar el control.'
                  : 'Aún no tienes préstamos asignados. El dueño te asignará los que debes cobrar.'}
              </p>
            </div>
            {esDueno && (
              <button type="button" className="btn-primary" onClick={() => setModalAbierto(true)}>
                {IconMas}
                <span>Nuevo préstamo</span>
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {prestamos.map((p) => {
              const nombre = clientePorId.get(p.cliente_id)?.nombre ?? 'Cliente'
              return (
                <NavLink
                  key={p.id}
                  to={`/prestamos/${p.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 border-t border-line-soft px-4 py-3 transition-colors first:border-t-0 ${
                      isActive ? 'bg-green-tint' : 'hover:bg-bg'
                    }`
                  }
                >
                  <Avatar nombre={nombre} size={42} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[14.5px] font-bold text-text">{nombre}</div>
                    <div className="truncate text-[12.5px] font-medium text-muted">
                      {fmtCOP(p.capital_inicial)} ·{' '}
                      {p.tipo === 'cuota_fija'
                        ? `cuota ${fmtCOP(p.valor_cuota ?? 0)}`
                        : tasaMensualTexto(p.tasa_mensual)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <TipoOModoBadge tipo={p.tipo} modo={p.modo_interes} />
                      <EstadoBadge estado={p.estado} />
                    </div>
                    {/* Cobrador asignado: solo el dueño lo ve (el cobrador ve solo lo suyo). */}
                    {esDueno && (
                      <div className="mt-1 truncate text-[11.5px] font-semibold text-muted">
                        {p.cobrador_id
                          ? `Cobrador: ${miembroPorId.get(p.cobrador_id)?.nombre ?? 'Cobrador'}${
                              miembroPorId.get(p.cobrador_id)?.activo === false ? ' (inactivo)' : ''
                            }`
                          : 'Sin asignar'}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right leading-tight">
                    <div className="mono text-[15.5px] font-bold text-text">{fmtCOP(p.saldo_capital)}</div>
                    <div className="text-[11px] font-semibold text-muted">Saldo</div>
                  </div>
                </NavLink>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Detalle ── */}
      <section className={`min-w-0 md:basis-2/5 md:self-start ${detalle ? 'flex flex-1 flex-col' : 'hidden md:flex md:flex-col'}`}>
        {detalle ? (
          <Outlet context={ctx} />
        ) : (
          <div className="card flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-bg text-muted">
              {IconPrestamos}
            </span>
            <p className="text-sm font-medium text-text-2">Selecciona un préstamo para ver su ficha.</p>
          </div>
        )}
      </section>

      <PrestamoFormModal
        open={modalAbierto}
        clientes={clientes}
        cobradores={cobradoresActivos}
        onClose={() => setModalAbierto(false)}
        onGuardar={handleGuardar}
        onGuardarCuotas={handleGuardarCuotas}
        onGuardarCuotaFija={handleGuardarCuotaFija}
      />
    </div>
  )
}
