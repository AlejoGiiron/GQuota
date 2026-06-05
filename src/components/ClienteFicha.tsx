import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Avatar from '@/components/Avatar'
import { EstadoBadge, ModoBadge, tasaMensualTexto } from '@/components/PrestamoBadges'
import { usePrestamos } from '@/hooks/usePrestamos'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import type { Cliente } from '@/types/database.types'

export interface ClientesOutletContext {
  clientes: Cliente[]
  loading: boolean
  onEditar: (cliente: Cliente) => void
  onEliminar: (cliente: Cliente) => void
}

const IconAtras = (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-line-soft py-3 first:border-t-0 first:pt-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className="text-sm font-medium text-text">{valor && valor.trim() !== '' ? valor : '—'}</span>
    </div>
  )
}

export default function ClienteFicha() {
  const { clienteId } = useParams()
  const navigate = useNavigate()
  const { clientes, loading, onEditar, onEliminar } = useOutletContext<ClientesOutletContext>()
  const cliente = clientes.find((c) => c.id === clienteId)

  if (loading && !cliente) {
    return (
      <div className="flex flex-col gap-3 p-1">
        <div className="h-16 animate-pulse rounded-xl bg-line-soft" />
        <div className="h-40 animate-pulse rounded-xl bg-line-soft" />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm font-semibold text-text">No encontramos este cliente.</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/clientes')}>
          Volver a la lista
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-1 self-start text-sm font-semibold text-green-700 md:hidden"
      >
        {IconAtras} Volver
      </button>

      {/* Encabezado de la ficha */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <Avatar nombre={cliente.nombre} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold tracking-tight text-text">{cliente.nombre}</h2>
            <p className="mt-0.5 text-sm text-text-2">
              {cliente.telefono ? cliente.telefono : 'Sin teléfono'}
            </p>
            <p className="mt-1 text-xs text-muted">Cliente desde {fmtFecha(cliente.created_at)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => onEditar(cliente)}>
            Editar
          </button>
          <button type="button" className="btn-destructive" onClick={() => onEliminar(cliente)}>
            Eliminar
          </button>
        </div>
      </div>

      {/* Datos */}
      <div className="card p-5">
        <h3 className="mb-2 text-sm font-bold text-text">Datos</h3>
        <Dato etiqueta="Documento" valor={cliente.documento} />
        <Dato etiqueta="Teléfono" valor={cliente.telefono} />
        <Dato etiqueta="Dirección" valor={cliente.direccion} />
        <Dato etiqueta="Notas" valor={cliente.notas} />
      </div>

      {/* Préstamos del cliente */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-bold text-text">Préstamos</h3>
        <PrestamosDelCliente clienteId={cliente.id} />
      </div>
    </div>
  )
}

function PrestamosDelCliente({ clienteId }: { clienteId: string }) {
  const { prestamos, loading } = usePrestamos(clienteId)

  if (loading) {
    return <div className="h-16 animate-pulse rounded-xl bg-line-soft" />
  }
  if (prestamos.length === 0) {
    return <p className="text-sm text-text-2">Este cliente aún no tiene préstamos.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {prestamos.map((p) => (
        <Link
          key={p.id}
          to={`/prestamos/${p.id}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:bg-bg"
        >
          <div className="min-w-0">
            <div className="mono text-sm font-bold text-text">{fmtCOP(p.saldo_capital)}</div>
            <div className="text-xs text-muted">
              de {fmtCOP(p.capital_inicial)} · {tasaMensualTexto(p.tasa_mensual)}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ModoBadge modo={p.modo_interes} />
              <EstadoBadge estado={p.estado} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
