import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import { METODOS_PAGO, useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useCuotas } from '@/hooks/useCuotas'
import { aplicarPagoFijo, type CuotaFija, type EstadoCuotaFija } from '@/lib/motor-prestamos'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import {
  compartirODescargarComprobante,
  nombreArchivoComprobante,
  puedeCompartirImagen,
  referenciaPrestamo,
  type DatosComprobante,
  type FilaComprobante,
} from '@/lib/comprobante'
import type { Prestamo } from '@/types/db'

function metodoLabel(valor: string): string {
  return METODOS_PAGO.find((m) => m.valor === valor)?.label ?? valor
}

const saldoDe = (cs: CuotaFija[]) => cs.reduce((s, c) => s + (c.valor - c.abonado), 0)

const ESTADO_TXT: Record<EstadoCuotaFija, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
}

interface Comprobante {
  monto: number
  metodo: string
  fecha: string
  cuotasRestantes: number
  saldoRestante: number
  proximaNumero: number | null
  proximaFecha: string | null
  saldado: boolean
}

export default function PagoCuotaFijaModal({
  open,
  prestamo,
  clienteNombre,
  onClose,
  onRegistrar,
}: {
  open: boolean
  prestamo: Prestamo
  clienteNombre: string
  onClose: () => void
  onRegistrar: (monto: number, metodo: string) => Promise<boolean>
}) {
  const { metodosActivos, nombreNegocio } = useConfiguracion()
  const { cuotas } = useCuotas(prestamo.id, open ? 1 : 0)

  const metodosDisponibles = useMemo(() => {
    const f = METODOS_PAGO.filter((m) => metodosActivos.includes(m.valor))
    return f.length > 0 ? f : METODOS_PAGO
  }, [metodosActivos])
  const primerMetodo = metodosDisponibles[0]?.valor ?? 'efectivo'

  // El valor de la cuota vive en `capital`; lo pagado en `abonado`.
  const cuotasMotor: CuotaFija[] = useMemo(
    () =>
      cuotas.map((c) => ({
        numero: c.numero,
        valor: c.capital,
        abonado: c.abonado,
        estado: c.estado as EstadoCuotaFija,
      })),
    [cuotas],
  )
  const vigente = cuotasMotor.find((c) => c.estado !== 'pagada') ?? null

  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState(primerMetodo)
  const [procesando, setProcesando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [comprobante, setComprobante] = useState<Comprobante | null>(null)

  useEffect(() => {
    if (!open) return
    setProcesando(false)
    setComprobante(null)
    setMetodo(primerMetodo)
    // Monto sugerido: lo que falta de la cuota vigente.
    setMonto(vigente ? String(vigente.valor - vigente.abonado) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vigente?.numero, primerMetodo])

  const montoNum = Number(monto)
  const montoValido = monto !== '' && !Number.isNaN(montoNum) && montoNum > 0

  const previo = useMemo(() => {
    if (!vigente || !montoValido) return null
    return aplicarPagoFijo(cuotasMotor, montoNum)
  }, [vigente, montoValido, montoNum, cuotasMotor])

  async function confirmar() {
    if (!vigente || !previo) return
    setProcesando(true)
    const ok = await onRegistrar(montoNum, metodo)
    setProcesando(false)
    if (ok) {
      const restantes = previo.cuotas.filter((c) => c.estado !== 'pagada')
      const proxima = restantes[0] ?? null
      setComprobante({
        monto: montoNum - previo.sobrante, // lo realmente aplicado
        metodo,
        fecha: fmtFecha(new Date()),
        cuotasRestantes: restantes.length,
        saldoRestante: saldoDe(previo.cuotas),
        proximaNumero: proxima?.numero ?? null,
        proximaFecha: proxima
          ? (cuotas.find((c) => c.numero === proxima.numero)?.fecha_vence ?? null)
          : null,
        saldado: restantes.length === 0,
      })
    }
  }

  // Comprobante como IMAGEN para el cliente: saldo / próxima cuota, sin desglose.
  async function enviarComprobante(c: Comprobante) {
    const estado: FilaComprobante[] = c.saldado
      ? []
      : [
          { etiqueta: 'Cuotas restantes', valor: String(c.cuotasRestantes) },
          { etiqueta: 'Saldo restante', valor: fmtCOP(c.saldoRestante) },
          ...(c.proximaNumero !== null
            ? [
                {
                  etiqueta: 'Próxima cuota',
                  valor: c.proximaFecha
                    ? `N.º ${c.proximaNumero} · ${fmtFecha(c.proximaFecha)}`
                    : `N.º ${c.proximaNumero}`,
                },
              ]
            : []),
        ]
    const datos: DatosComprobante = {
      negocio: nombreNegocio,
      cliente: clienteNombre,
      referencia: referenciaPrestamo(prestamo.id),
      fechaEmision: fmtFecha(new Date()),
      monto: c.monto,
      fechaPago: c.fecha,
      metodo: metodoLabel(c.metodo),
      estado,
      mensajeEstado: c.saldado ? 'Su crédito quedó al día. ¡Gracias!' : null,
      pie: 'Gracias por su pago. Conserve este comprobante como soporte.',
    }
    setEnviando(true)
    try {
      await compartirODescargarComprobante(datos, nombreArchivoComprobante(clienteNombre))
    } catch {
      toast.error('No pudimos generar el comprobante.')
    } finally {
      setEnviando(false)
    }
  }

  async function copiar(c: Comprobante) {
    const lineas = [
      `Comprobante de pago · ${nombreNegocio}`,
      `Cliente: ${clienteNombre}`,
      `Fecha: ${c.fecha}`,
      `Pago: ${fmtCOP(c.monto)} (${metodoLabel(c.metodo)})`,
      c.saldado ? 'Su crédito quedó al día.' : `Saldo restante: ${fmtCOP(c.saldoRestante)}`,
    ].filter(Boolean)
    try {
      await navigator.clipboard.writeText(lineas.join('\n'))
      toast.success('Comprobante copiado.')
    } catch {
      toast.error('No pudimos copiar el comprobante.')
    }
  }

  // ── Comprobante ──
  if (comprobante) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        titulo="Comprobante"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => copiar(comprobante)}>
              Copiar
            </button>
            <button type="button" className="btn-primary" onClick={onClose}>
              Cerrar
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-green-tint px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Pago registrado</p>
            <p className="mono mt-1 text-2xl font-bold text-text">{fmtCOP(comprobante.monto)}</p>
            <p className="text-xs text-text-2">
              {metodoLabel(comprobante.metodo)} · {comprobante.fecha}
            </p>
          </div>
          <div className="flex justify-between border-t border-line-soft pt-3 text-sm">
            <span className="text-text-2">Saldo restante</span>
            <span className="mono font-semibold text-text">{fmtCOP(comprobante.saldoRestante)}</span>
          </div>
          {comprobante.saldado && (
            <p className="rounded-xl bg-green-tint px-4 py-2 text-center text-sm font-semibold text-green-700">
              El préstamo quedó saldado. ¡Gracias!
            </p>
          )}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => enviarComprobante(comprobante)}
            disabled={enviando}
          >
            {enviando
              ? 'Generando…'
              : puedeCompartirImagen()
                ? 'Enviar comprobante'
                : 'Descargar comprobante'}
          </button>
          <p className="text-center text-xs text-muted">
            {puedeCompartirImagen()
              ? 'Se comparte como imagen (puedes enviarlo por WhatsApp).'
              : 'Se descarga como imagen para compartir.'}
          </p>
        </div>
      </Modal>
    )
  }

  // ── Formulario ──
  const sinPendientes = !vigente

  return (
    <Modal
      open={open}
      onClose={onClose}
      titulo="Registrar pago"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={procesando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={confirmar}
            disabled={procesando || sinPendientes || !previo}
          >
            {procesando ? 'Registrando…' : 'Registrar pago'}
          </button>
        </>
      }
    >
      {sinPendientes ? (
        <p className="text-sm text-text-2">Este préstamo no tiene cuotas pendientes.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-bg px-4 py-3 text-sm">
            <p className="text-text-2">
              Cuota vigente: <span className="font-bold text-text">N.º {vigente.numero}</span>
            </p>
            <p className="mt-1 text-text-2">
              Falta de esta cuota:{' '}
              <span className="mono font-bold text-text">{fmtCOP(vigente.valor - vigente.abonado)}</span>
              {vigente.abonado > 0 && (
                <span className="text-muted"> (abonado {fmtCOP(vigente.abonado)} de {fmtCOP(vigente.valor)})</span>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="pago-monto" className="text-[13px] font-semibold text-text-2">
              Monto del pago <span className="text-red">*</span>
            </label>
            <input
              id="pago-monto"
              className="input"
              type="number"
              min="1"
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            {montoValido && <p className="mono text-xs font-semibold text-text-2">{fmtCOP(montoNum)}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-text-2">Método de pago</span>
            <div className="flex flex-wrap gap-2">
              {metodosDisponibles.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => setMetodo(m.valor)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                    metodo === m.valor
                      ? 'border-green bg-green-tint text-green-700'
                      : 'border-line bg-card text-text-2 hover:bg-bg'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vista previa de cómo quedan las cuotas tras el pago */}
          {previo && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-2">
                Después del pago (saldo {fmtCOP(saldoDe(previo.cuotas))}
                {previo.sobrante > 0 ? ` · ${fmtCOP(previo.sobrante)} sobrante` : ''})
              </span>
              <div className="max-h-48 overflow-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg">
                    <tr className="text-left text-muted">
                      <th className="px-2 py-1.5 font-semibold">#</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Abonado</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previo.cuotas.map((c) => (
                      <tr key={c.numero} className="border-t border-line-soft">
                        <td className="px-2 py-1.5 text-text-2">{c.numero}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right text-text">{fmtCOP(c.valor)}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right text-text">{fmtCOP(c.abonado)}</td>
                        <td className="px-2 py-1.5 text-right text-text-2">{ESTADO_TXT[c.estado]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
