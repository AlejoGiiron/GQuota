import { useMemo, useState } from 'react'
import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import Avatar from '@/components/Avatar'
import ClienteFormModal from '@/components/ClienteFormModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useClientes, type ClienteInput } from '@/hooks/useClientes'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import type { ClientesOutletContext } from '@/components/ClienteFicha'
import type { Cliente } from '@/types/db'

const IconBuscar = (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)
const IconMas = (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const IconUsuarios = (
  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19" />
    <path d="M16 5.2A3 3 0 0118 11M21 19c-.4-2.2-1.6-3.6-3.3-4.2" />
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

export default function ClientesPage() {
  const { clientes, loading, error, crear, actualizar, eliminar } = useClientes()
  const { esDueno } = useConfiguracion()
  const navigate = useNavigate()
  const detalle = useMatch('/clientes/:clienteId')

  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [aEliminar, setAEliminar] = useState<Cliente | null>(null)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q === '') return clientes
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.documento ?? '').toLowerCase().includes(q) ||
        (c.telefono ?? '').toLowerCase().includes(q),
    )
  }, [clientes, busqueda])

  function abrirNuevo() {
    setEditando(null)
    setModalAbierto(true)
  }
  function abrirEditar(cliente: Cliente) {
    setEditando(cliente)
    setModalAbierto(true)
  }

  async function handleGuardar(input: ClienteInput): Promise<boolean> {
    if (editando) {
      const { error } = await actualizar(editando.id, input)
      if (error) {
        toast.error(error)
        return false
      }
      toast.success('Cliente actualizado.')
      return true
    }
    const { data, error } = await crear(input)
    if (error || !data) {
      toast.error(error ?? 'No pudimos crear el cliente.')
      return false
    }
    toast.success('Cliente creado.')
    return true
  }

  async function confirmarEliminar() {
    if (!aEliminar) return
    const { error } = await eliminar(aEliminar.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Cliente eliminado.')
      if (detalle?.params.clienteId === aEliminar.id) navigate('/clientes')
    }
    setAEliminar(null)
  }

  const ctx: ClientesOutletContext = {
    clientes,
    loading,
    onEditar: abrirEditar,
    onEliminar: setAEliminar,
  }

  return (
    <div className="flex h-full flex-col md:flex-row md:gap-6">
      {/* ── Lista ── */}
      <section
        className={`min-w-0 flex-col gap-4 md:basis-3/5 ${detalle ? 'hidden md:flex' : 'flex'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Clientes{' '}
            {!loading && clientes.length > 0 && (
              <span className="text-base font-bold text-muted">({clientes.length})</span>
            )}
          </h1>
          {esDueno && (
            <button type="button" className="btn-primary" onClick={abrirNuevo}>
              {IconMas}
              <span>Nuevo cliente</span>
            </button>
          )}
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            {IconBuscar}
          </span>
          <input
            className="input pl-11"
            placeholder="Buscar por nombre, documento o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar clientes"
          />
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
        ) : clientes.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-green-tint text-green">
              {IconUsuarios}
            </span>
            <div>
              <p className="text-sm font-bold text-text">Aún no hay clientes</p>
              <p className="mt-1 text-sm text-text-2">
                {esDueno
                  ? 'Crea el primero para empezar a llevar el control.'
                  : 'El dueño aún no ha registrado clientes.'}
              </p>
            </div>
            {esDueno && (
              <button type="button" className="btn-primary" onClick={abrirNuevo}>
                {IconMas}
                <span>Nuevo cliente</span>
              </button>
            )}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-text">Sin resultados</p>
            <p className="text-sm text-text-2">No hay clientes que coincidan con “{busqueda}”.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {filtrados.map((cliente) => (
              <NavLink
                key={cliente.id}
                to={`/clientes/${cliente.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 border-t border-line-soft px-4 py-3 transition-colors first:border-t-0 ${
                    isActive ? 'bg-green-tint' : 'hover:bg-bg'
                  }`
                }
              >
                <Avatar nombre={cliente.nombre} size={42} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[14.5px] font-bold text-text">{cliente.nombre}</div>
                  <div className="truncate text-[12.5px] font-medium text-muted">
                    {cliente.telefono ? cliente.telefono : 'Sin teléfono'}
                  </div>
                </div>
              </NavLink>
            ))}
          </div>
        )}
      </section>

      {/* ── Detalle ── */}
      <section
        className={`min-w-0 md:basis-2/5 md:self-start ${detalle ? 'flex flex-1 flex-col' : 'hidden md:flex md:flex-col'}`}
      >
        {detalle ? (
          <Outlet context={ctx} />
        ) : (
          <div className="card flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-bg text-muted">
              {IconUsuarios}
            </span>
            <p className="text-sm font-medium text-text-2">
              Selecciona un cliente para ver su ficha.
            </p>
          </div>
        )}
      </section>

      <ClienteFormModal
        open={modalAbierto}
        cliente={editando}
        onClose={() => setModalAbierto(false)}
        onGuardar={handleGuardar}
      />

      <ConfirmDialog
        open={aEliminar !== null}
        titulo="Eliminar cliente"
        mensaje={
          aEliminar
            ? `¿Seguro que quieres eliminar a ${aEliminar.nombre}? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirmar={confirmarEliminar}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}
