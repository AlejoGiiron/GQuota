import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import { METODOS_PAGO, useConfiguracion } from '@/contexts/ConfiguracionContext'
import { useCuotas } from '@/hooks/useCuotas'
import {
  aplicarPagoACuotas,
  pagarSoloInteres,
  type Cuota,
  type EstadoCuota,
} from '@/lib/motor-prestamos'
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

const sumaInteres = (cs: Cuota[]) => cs.reduce((s, c) => s + c.interes, 0)
const sumaCapital = (cs: Cuota[]) => cs.reduce((s, c) => s + c.capital, 0)

interface Comprobante {
  monto: number
  metodo: string
  interes: number
  capital: number
  soloInteres: boolean
  fecha: string
  // Estado del cronograma tras el pago (para el comprobante del cliente).
  cuotasRestantes: number
  totalRestante: number
  proximaNumero: number | null
  proximaFecha: string | null
  saldado: boolean
}

export default function PagoCuotasModal({
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
  onRegistrar: (abono: number, metodo: string, soloInteres: boolean) => Promise<boolean>
}) {
  const { metodosActivos, nombreNegocio } = useConfiguracion()
  const { cuotas } = useCuotas(prestamo.id, open ? 1 : 0)

  const metodosDisponibles = useMemo(() => {
    const f = METODOS_PAGO.filter((m) => metodosActivos.includes(m.valor))
    return f.length > 0 ? f : METODOS_PAGO
  }, [metodosActivos])
  const primerMetodo = metodosDisponibles[0]?.valor ?? 'efectivo'

  const cuotasMotor: Cuota[] = useMemo(
    () =>
      cuotas.map((c) => ({
        numero: c.numero,
        capital: c.capital,
        interes: c.interes,
        estado: c.estado as EstadoCuota,
      })),
    [cuotas],
  )
  const vigente = cuotasMotor.find((c) => c.estado !== 'pagada') ?? null

  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState(primerMetodo)
  const [soloInteres, setSoloInteres] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [comprobante, setComprobante] = useState<Comprobante | null>(null)

  useEffect(() => {
    if (!open) return
    setSoloInteres(false)
    setProcesando(false)
    setComprobante(null)
    setMetodo(primerMetodo)
    setMonto(vigente ? String(vigente.capital + vigente.interes) : '')
    // Re-inicializa solo cuando cambia la cuota vigente (por número), no en cada
    // render: 'vigente' es un objeto nuevo cada vez. Excluirlo es intencional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vigente?.numero, primerMetodo])

  const montoNum = Number(monto)
  const montoValido = monto !== '' && !Number.isNaN(montoNum) && montoNum > 0
  // Solo-interés: la opción marcada, o el monto = interés exacto de la cuota vigente.
  const esSoloInteres = Boolean(vigente) && (soloInteres || (montoValido && montoNum === vigente!.interes))

  const previo = useMemo(() => {
    if (!vigente) return null
    if (esSoloInteres) {
      return {
        resultado: pagarSoloInteres(cuotasMotor),
        interes: vigente.interes,
        capital: 0,
        sobrante: 0,
        abono: vigente.interes,
      }
    }
    if (!montoValido) return null
    const { cuotas: res, sobrante } = aplicarPagoACuotas(cuotasMotor, montoNum)
    return {
      resultado: res,
      interes: sumaInteres(cuotasMotor) - sumaInteres(res),
      capital: sumaCapital(cuotasMotor) - sumaCapital(res),
      sobrante,
      abono: montoNum,
    }
  }, [vigente, esSoloInteres, montoValido, montoNum, cuotasMotor])

  async function confirmar() {
    if (!vigente || !previo) return
    setProcesando(true)
    const ok = await onRegistrar(previo.abono, metodo, esSoloInteres)
    setProcesando(false)
    if (ok) {
      // Estado del cronograma tras el pago: lo da el motor (previo.resultado),
      // exacto al momento. La fecha de la próxima cuota se busca en las cuotas
      // cargadas; para una cuota agregada por solo-interés aún no existe -> null.
      const restantes = previo.resultado.filter((c) => c.estado !== 'pagada')
      const proxima = restantes[0] ?? null
      setComprobante({
        monto: previo.abono,
        metodo,
        interes: previo.interes,
        capital: previo.capital,
        soloInteres: esSoloInteres,
        fecha: fmtFecha(new Date()),
        cuotasRestantes: restantes.length,
        totalRestante: restantes.reduce((s, c) => s + c.capital + c.interes, 0),
        proximaNumero: proxima?.numero ?? null,
        proximaFecha: proxima
          ? (cuotas.find((c) => c.numero === proxima.numero)?.fecha_vence ?? null)
          : null,
        saldado: restantes.length === 0,
      })
    }
  }

  // Comprobante como IMAGEN para el cliente: cuotas restantes / próxima, sin desglose.
  async function enviarComprobante(c: Comprobante) {
    const estado: FilaComprobante[] = c.saldado
      ? []
      : [
          { etiqueta: 'Cuotas restantes', valor: String(c.cuotasRestantes) },
          { etiqueta: 'Total restante', valor: fmtCOP(c.totalRestante) },
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
      `A interés: ${fmtCOP(c.interes)}`,
      `A capital: ${fmtCOP(c.capital)}`,
      c.soloInteres ? 'Pago de solo interés (se agregó una cuota al final).' : '',
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
            <span className="text-text-2">A interés</span>
            <span className="mono font-semibold text-text">{fmtCOP(comprobante.interes)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-2">A capital</span>
            <span className="mono font-semibold text-text">{fmtCOP(comprobante.capital)}</span>
          </div>
          {comprobante.soloInteres && (
            <p className="rounded-xl bg-amber-tint px-4 py-2 text-center text-sm font-semibold text-[#b45309]">
              Pago de solo interés: se agregó una cuota al final con el mismo interés.
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
              Monto sugerido:{' '}
              <span className="mono font-bold text-text">{fmtCOP(vigente.capital + vigente.interes)}</span>{' '}
              <span className="text-muted">
                ({fmtCOP(vigente.capital)} capital + {fmtCOP(vigente.interes)} interés)
              </span>
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
              disabled={soloInteres}
            />
            {montoValido && !soloInteres && (
              <p className="mono text-xs font-semibold text-text-2">{fmtCOP(montoNum)}</p>
            )}
          </div>

          <label className="flex items-center gap-2.5 text-sm font-medium text-text">
            <input
              type="checkbox"
              className="accent-green"
              checked={soloInteres}
              onChange={(e) => setSoloInteres(e.target.checked)}
            />
            Pagar solo el interés
            <span className="text-muted">— corre el capital a una cuota nueva</span>
          </label>

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

          {/* Vista previa del cronograma tras el pago */}
          {previo && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-2">
                Después del pago ({fmtCOP(previo.interes)} a interés · {fmtCOP(previo.capital)} a capital
                {previo.sobrante > 0 ? ` · ${fmtCOP(previo.sobrante)} sobrante` : ''})
              </span>
              <div className="max-h-48 overflow-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg">
                    <tr className="text-left text-muted">
                      <th className="px-2 py-1.5 font-semibold">#</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Capital</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Interés</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previo.resultado.map((c) => (
                      <tr key={c.numero} className="border-t border-line-soft">
                        <td className="px-2 py-1.5 text-text-2">{c.numero}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right text-text">{fmtCOP(c.capital)}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right text-text">{fmtCOP(c.interes)}</td>
                        <td className="px-2 py-1.5 text-right text-text-2">
                          {c.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                        </td>
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
