import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { EstadoBadge } from '@/components/PrestamoBadges'
import { METODOS_PAGO, useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useMovimientos } from '@/hooks/useMovimientos'
import { prestamoDelMotor } from '@/hooks/usePrestamos'
import { interesDelPeriodo } from '@/lib/motor-prestamos'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import {
  compartirODescargarComprobante,
  nombreArchivoComprobante,
  referenciaPrestamo,
  type DatosComprobante,
} from '@/lib/comprobante'
import type { Movimiento, Prestamo } from '@/types/db'

const TIPO_LABEL: Record<string, string> = {
  desembolso: 'Desembolso',
  interes: 'Interés',
  abono_capital: 'Abono a capital',
  cuota: 'Cuota',
}

function metodoLabel(valor: string | null): string {
  if (!valor) return '—'
  return METODOS_PAGO.find((m) => m.valor === valor)?.label ?? valor
}

function Resumen({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 first:border-t-0 first:pt-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className="text-right text-sm font-semibold text-text">{children}</span>
    </div>
  )
}

export default function EstadoDeCuenta({
  prestamo,
  clienteNombre,
  recargaToken = 0,
}: {
  prestamo: Prestamo
  clienteNombre: string
  recargaToken?: number
}) {
  const { nombreNegocio } = useConfiguracion()
  const { movimientos, loading, error } = useMovimientos(prestamo.id, recargaToken)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  // Interés del periodo vigente: misma lógica del motor según el modo.
  const interesPeriodo = interesDelPeriodo(prestamoDelMotor(prestamo))

  // Un movimiento es un PAGO del cliente si tiene método de pago (el desembolso
  // y el devengo de interés no lo tienen). Solo esos llevan comprobante.
  const esPago = (m: Movimiento) => Boolean(m.metodo_pago) && m.tipo !== 'desembolso'

  // Reenvío desde el historial: estado ACTUAL del crédito (saldo de hoy),
  // distinguiendo fecha del pago (del movimiento) de la fecha de emisión (hoy).
  async function enviarComprobante(m: Movimiento) {
    const saldado = prestamo.estado === 'pagado'
    const datos: DatosComprobante = {
      negocio: nombreNegocio,
      cliente: clienteNombre,
      referencia: referenciaPrestamo(prestamo.id),
      fechaEmision: fmtFecha(new Date()),
      monto: m.monto_total,
      fechaPago: fmtFecha(m.fecha),
      metodo: metodoLabel(m.metodo_pago),
      estado: [{ etiqueta: 'Saldo pendiente', valor: fmtCOP(prestamo.saldo_capital) }],
      mensajeEstado: saldado ? 'Su préstamo quedó al día. ¡Gracias!' : null,
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
      {/* Resumen del estado de cuenta */}
      <div className="card p-5">
        <h3 className="mb-2 text-sm font-bold text-text">Estado de cuenta</h3>
        <Resumen etiqueta="Capital inicial">
          <span className="mono">{fmtCOP(prestamo.capital_inicial)}</span>
        </Resumen>
        <Resumen etiqueta="Saldo actual">
          <span className="mono">{fmtCOP(prestamo.saldo_capital)}</span>
        </Resumen>
        <Resumen etiqueta="Interés del periodo">
          <span className="mono">{fmtCOP(interesPeriodo)}</span>
        </Resumen>
        <Resumen etiqueta="Interés pendiente">
          <span className="mono text-amber">{fmtCOP(prestamo.interes_pendiente)}</span>
        </Resumen>
        <Resumen etiqueta="Estado">
          <EstadoBadge estado={prestamo.estado} />
        </Resumen>
      </div>

      {/* Ledger de movimientos */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-bold text-text">Movimientos</h3>
        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-8 animate-pulse rounded bg-line-soft" />
            <div className="h-8 animate-pulse rounded bg-line-soft" />
            <div className="h-8 animate-pulse rounded bg-line-soft" />
          </div>
        ) : error ? (
          <p className="text-sm font-semibold text-text">{error}</p>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-text-2">Aún no hay movimientos.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-1 pb-2 font-semibold">Fecha</th>
                  <th className="px-1 pb-2 font-semibold">Tipo</th>
                  <th className="px-1 pb-2 text-right font-semibold">Interés</th>
                  <th className="px-1 pb-2 text-right font-semibold">Capital</th>
                  <th className="px-1 pb-2 text-right font-semibold">Saldo</th>
                  <th className="px-1 pb-2 text-right font-semibold">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-line-soft">
                    <td className="whitespace-nowrap px-1 py-2.5 text-text-2">{fmtFecha(m.fecha)}</td>
                    <td className="px-1 py-2.5 font-semibold text-text">
                      {TIPO_LABEL[m.tipo] ?? m.tipo}
                    </td>
                    <td className="mono whitespace-nowrap px-1 py-2.5 text-right text-text">
                      {fmtCOP(m.monto_interes)}
                    </td>
                    <td className="mono whitespace-nowrap px-1 py-2.5 text-right text-text">
                      {fmtCOP(m.monto_capital)}
                    </td>
                    <td className="mono whitespace-nowrap px-1 py-2.5 text-right font-bold text-text">
                      {fmtCOP(m.saldo_posterior)}
                    </td>
                    <td className="whitespace-nowrap px-1 py-2.5 text-right">
                      {esPago(m) ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50"
                          onClick={() => enviarComprobante(m)}
                          disabled={enviandoId === m.id}
                        >
                          {enviandoId === m.id ? 'Generando…' : 'Enviar'}
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
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
