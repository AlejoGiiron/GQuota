import { useState } from 'react'
import { toast } from 'sonner'
import { METODOS_PAGO, useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useCuotas } from '@/hooks/useCuotas'
import { useMovimientos } from '@/hooks/useMovimientos'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import {
  compartirODescargarComprobante,
  nombreArchivoComprobante,
  referenciaPrestamo,
  type DatosComprobante,
  type FilaComprobante,
} from '@/lib/comprobante'
import type { Movimiento, Prestamo } from '@/types/db'

const ESTADO_CUOTA: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-bg text-text-2' },
  parcial: { label: 'Parcial', cls: 'bg-amber-tint text-[#b45309]' },
  pagada: { label: 'Pagada', cls: 'bg-green-tint text-green-700' },
}

function EstadoCuotaBadge({ estado }: { estado: string }) {
  const info = ESTADO_CUOTA[estado] ?? { label: estado, cls: 'bg-bg text-text-2' }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${info.cls}`}>
      {info.label}
    </span>
  )
}

function metodoLabel(valor: string | null): string {
  if (!valor) return '—'
  return METODOS_PAGO.find((m) => m.valor === valor)?.label ?? valor
}

function Resumen({ etiqueta, children }: { etiqueta: string; children: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className="mono mt-0.5 text-sm font-bold text-text">{children}</span>
    </div>
  )
}

/**
 * Estado de cuenta de un préstamo tipo 'cuota_fija'.
 * A diferencia de las cuotas pactadas, aquí la cuota CONSERVA su valor (en
 * `capital`) y registra cuánto se le ha abonado (`abonado`), así que se puede
 * mostrar el detalle real por cuota (sin "—"). saldo = Σ(valor − abonado).
 */
export default function CronogramaCuotaFija({
  prestamo,
  clienteNombre,
  recargaToken = 0,
}: {
  prestamo: Prestamo
  clienteNombre: string
  recargaToken?: number
}) {
  const { nombreNegocio } = useConfiguracion()
  const { cuotas, loading: cargandoCuotas, error: errorCuotas } = useCuotas(prestamo.id, recargaToken)
  const { movimientos, loading: cargandoMovs } = useMovimientos(prestamo.id, recargaToken)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)

  // Pagos reales (excluye el desembolso). Más reciente arriba (ya viene ordenado).
  const pagos = movimientos.filter((m) => m.tipo === 'cuota')

  const total = cuotas.reduce((s, c) => s + c.capital, 0) // nº × valor
  const saldo = cuotas.reduce((s, c) => s + (c.capital - c.abonado), 0)
  const pagado = total - saldo
  const ganancia = total - prestamo.capital_inicial
  const pendientes = cuotas.filter((c) => c.estado !== 'pagada')

  // Reenvío de comprobante desde el historial: usa el estado ACTUAL del crédito.
  async function enviarComprobante(m: Movimiento) {
    const proxima = pendientes[0] ?? null
    const saldado = pendientes.length === 0
    const estado: FilaComprobante[] = saldado
      ? []
      : [
          { etiqueta: 'Cuotas restantes', valor: String(pendientes.length) },
          { etiqueta: 'Saldo restante', valor: fmtCOP(saldo) },
          ...(proxima
            ? [
                {
                  etiqueta: 'Próxima cuota',
                  valor: `N.º ${proxima.numero} · ${fmtFecha(proxima.fecha_vence)}`,
                },
              ]
            : []),
        ]
    const datos: DatosComprobante = {
      negocio: nombreNegocio,
      cliente: clienteNombre,
      referencia: referenciaPrestamo(prestamo.id),
      fechaEmision: fmtFecha(new Date()),
      monto: m.monto_total,
      fechaPago: fmtFecha(m.fecha),
      metodo: metodoLabel(m.metodo_pago),
      estado,
      mensajeEstado: saldado ? 'Su crédito quedó al día. ¡Gracias!' : null,
      pie: 'Gracias por su pago. Conserve este comprobante como soporte.',
    }
    setEnviandoId(m.id)
    try {
      await compartirODescargarComprobante(datos, nombreArchivoComprobante(clienteNombre))
    } catch {
      toast.error('No pudimos generar el comprobante.')
    } finally {
      setEnviandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen */}
      <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        <Resumen etiqueta="Capital">{fmtCOP(prestamo.capital_inicial)}</Resumen>
        <Resumen etiqueta="Total a cobrar">{fmtCOP(total)}</Resumen>
        <Resumen etiqueta="Ganancia">{fmtCOP(ganancia)}</Resumen>
        <Resumen etiqueta="Pagado">{fmtCOP(pagado)}</Resumen>
        <Resumen etiqueta="Saldo">{fmtCOP(saldo)}</Resumen>
        <Resumen etiqueta="N.º de cuotas">{String(cuotas.length)}</Resumen>
      </div>

      {/* Cronograma */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-bold text-text">Cronograma de cuotas</h3>
        {cargandoCuotas ? (
          <div className="flex flex-col gap-2">
            <div className="h-8 animate-pulse rounded bg-line-soft" />
            <div className="h-8 animate-pulse rounded bg-line-soft" />
            <div className="h-8 animate-pulse rounded bg-line-soft" />
          </div>
        ) : errorCuotas ? (
          <p className="text-sm font-semibold text-text">{errorCuotas}</p>
        ) : cuotas.length === 0 ? (
          <p className="text-sm text-text-2">Este préstamo no tiene cuotas registradas.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-1 pb-2 font-semibold">#</th>
                  <th className="px-1 pb-2 font-semibold">Vence</th>
                  <th className="px-1 pb-2 text-right font-semibold">Valor</th>
                  <th className="px-1 pb-2 text-right font-semibold">Abonado</th>
                  <th className="px-1 pb-2 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c) => {
                  const pagada = c.estado === 'pagada'
                  return (
                    <tr key={c.id} className={`border-t border-line-soft ${pagada ? 'text-muted' : ''}`}>
                      <td className="px-1 py-2.5">{c.numero}</td>
                      <td className="whitespace-nowrap px-1 py-2.5">{fmtFecha(c.fecha_vence)}</td>
                      <td className="mono whitespace-nowrap px-1 py-2.5 text-right text-text">{fmtCOP(c.capital)}</td>
                      <td className="mono whitespace-nowrap px-1 py-2.5 text-right">
                        {c.estado === 'parcial' ? (
                          <span className="font-bold text-[#b45309]">{fmtCOP(c.abonado)}</span>
                        ) : (
                          <span className="text-text">{fmtCOP(c.abonado)}</span>
                        )}
                      </td>
                      <td className="px-1 py-2.5 text-right">
                        <EstadoCuotaBadge estado={c.estado} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagos realizados */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-bold text-text">Pagos realizados</h3>
        {cargandoMovs ? (
          <div className="flex flex-col gap-2">
            <div className="h-8 animate-pulse rounded bg-line-soft" />
            <div className="h-8 animate-pulse rounded bg-line-soft" />
          </div>
        ) : pagos.length === 0 ? (
          <p className="text-sm text-text-2">Aún no hay pagos registrados.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-1 pb-2 font-semibold">Fecha</th>
                  <th className="px-1 pb-2 text-right font-semibold">Monto</th>
                  <th className="px-1 pb-2 font-semibold">Método</th>
                  <th className="px-1 pb-2 text-right font-semibold">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((m) => (
                  <tr key={m.id} className="border-t border-line-soft">
                    <td className="whitespace-nowrap px-1 py-2.5 text-text-2">{fmtFecha(m.fecha)}</td>
                    <td className="mono whitespace-nowrap px-1 py-2.5 text-right font-bold text-text">{fmtCOP(m.monto_total)}</td>
                    <td className="whitespace-nowrap px-1 py-2.5 text-text-2">{metodoLabel(m.metodo_pago)}</td>
                    <td className="whitespace-nowrap px-1 py-2.5 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50"
                        onClick={() => enviarComprobante(m)}
                        disabled={enviandoId === m.id}
                      >
                        {enviandoId === m.id ? 'Generando…' : 'Enviar'}
                      </button>
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
