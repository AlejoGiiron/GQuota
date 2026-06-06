import { useCuotas } from '@/hooks/useCuotas'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import type { CuotaDB, Prestamo } from '@/types/database.types'

const ESTADO_CUOTA: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-bg text-text-2' },
  pagada: { label: 'Pagada', cls: 'bg-green-tint text-green-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-tint text-red' },
}

function EstadoCuotaBadge({ estado }: { estado: string }) {
  const info = ESTADO_CUOTA[estado] ?? { label: estado, cls: 'bg-bg text-text-2' }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${info.cls}`}>
      {info.label}
    </span>
  )
}

function Resumen({ etiqueta, children }: { etiqueta: string; children: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className="mono mt-0.5 text-sm font-bold text-text">{children}</span>
    </div>
  )
}

/** Estado de cuenta de un préstamo tipo 'cuotas': resumen + cronograma. */
export default function CronogramaCuotas({
  prestamo,
  recargaToken = 0,
}: {
  prestamo: Prestamo
  recargaToken?: number
}) {
  const { cuotas, loading, error } = useCuotas(prestamo.id, recargaToken)

  const monto = (c: CuotaDB) => c.capital + c.interes
  const total = cuotas.reduce((s, c) => s + monto(c), 0)
  const pagado = cuotas.filter((c) => c.estado === 'pagada').reduce((s, c) => s + monto(c), 0)
  const saldo = total - pagado

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen */}
      <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Resumen etiqueta="Total a pagar">{fmtCOP(total)}</Resumen>
        <Resumen etiqueta="Pagado">{fmtCOP(pagado)}</Resumen>
        <Resumen etiqueta="Saldo">{fmtCOP(saldo)}</Resumen>
        <Resumen etiqueta="N.º de cuotas">{String(cuotas.length)}</Resumen>
      </div>

      {/* Cronograma */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-bold text-text">Cronograma de cuotas</h3>
        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-8 animate-pulse rounded bg-line-soft" />
            <div className="h-8 animate-pulse rounded bg-line-soft" />
            <div className="h-8 animate-pulse rounded bg-line-soft" />
          </div>
        ) : error ? (
          <p className="text-sm font-semibold text-text">{error}</p>
        ) : cuotas.length === 0 ? (
          <p className="text-sm text-text-2">Este préstamo no tiene cuotas registradas.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-1 pb-2 font-semibold">#</th>
                  <th className="px-1 pb-2 font-semibold">Vence</th>
                  <th className="px-1 pb-2 text-right font-semibold">Capital</th>
                  <th className="px-1 pb-2 text-right font-semibold">Interés</th>
                  <th className="px-1 pb-2 text-right font-semibold">Monto</th>
                  <th className="px-1 pb-2 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c) => (
                  <tr key={c.id} className="border-t border-line-soft">
                    <td className="px-1 py-2.5 text-text-2">{c.numero}</td>
                    <td className="whitespace-nowrap px-1 py-2.5 text-text-2">{fmtFecha(c.fecha_vence)}</td>
                    <td className="mono whitespace-nowrap px-1 py-2.5 text-right text-text">{fmtCOP(c.capital)}</td>
                    <td className="mono whitespace-nowrap px-1 py-2.5 text-right text-text">{fmtCOP(c.interes)}</td>
                    <td className="mono whitespace-nowrap px-1 py-2.5 text-right font-bold text-text">{fmtCOP(monto(c))}</td>
                    <td className="px-1 py-2.5 text-right">
                      <EstadoCuotaBadge estado={c.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
