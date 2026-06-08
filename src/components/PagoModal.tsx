import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/Modal'
import { METODOS_PAGO, useConfiguracion } from '@/contexts/ConfiguracionContext'
import { prestamoDelMotor } from '@/hooks/usePrestamos'
import { aplicarPago, type ResultadoPago } from '@/lib/motor-prestamos'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import {
  compartirODescargarComprobante,
  nombreArchivoComprobante,
  puedeCompartirImagen,
  referenciaPrestamo,
  type DatosComprobante,
} from '@/lib/comprobante'
import type { Prestamo } from '@/types/database.types'

function metodoLabel(valor: string): string {
  return METODOS_PAGO.find((m) => m.valor === valor)?.label ?? valor
}

interface Comprobante {
  resultado: ResultadoPago
  monto: number
  metodo: string
  fecha: string
}

export default function PagoModal({
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
  /** Persiste el pago y devuelve el desglose guardado (o null si falló). */
  onRegistrar: (monto: number, metodo: string) => Promise<ResultadoPago | null>
}) {
  const { metodosActivos, nombreNegocio } = useConfiguracion()
  const metodosDisponibles = useMemo(() => {
    const filtrados = METODOS_PAGO.filter((m) => metodosActivos.includes(m.valor))
    return filtrados.length > 0 ? filtrados : METODOS_PAGO
  }, [metodosActivos])
  const primerMetodo = metodosDisponibles[0]?.valor ?? 'efectivo'

  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState(primerMetodo)
  const [procesando, setProcesando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [comprobante, setComprobante] = useState<Comprobante | null>(null)

  useEffect(() => {
    if (!open) return
    setMonto('')
    setMetodo(primerMetodo)
    setProcesando(false)
    setComprobante(null)
  }, [open, primerMetodo])

  const montoNum = Number(monto)
  const montoValido = monto !== '' && !Number.isNaN(montoNum) && montoNum > 0

  // Desglose en vivo (mismo motor que persiste; determinista -> coincide con lo guardado).
  const previo = useMemo<ResultadoPago | null>(() => {
    if (!montoValido) return null
    return aplicarPago(prestamoDelMotor(prestamo), montoNum).resultado
  }, [montoValido, montoNum, prestamo])

  async function confirmar() {
    if (!montoValido) return
    setProcesando(true)
    const resultado = await onRegistrar(montoNum, metodo)
    setProcesando(false)
    if (resultado) {
      setComprobante({ resultado, monto: montoNum, metodo, fecha: fmtFecha(new Date()) })
    }
  }

  function textoComprobante(c: Comprobante): string {
    const lineas = [
      `Comprobante de pago · ${nombreNegocio}`,
      `Cliente: ${clienteNombre}`,
      `Fecha: ${c.fecha}`,
      `Pago: ${fmtCOP(c.monto)} (${metodoLabel(c.metodo)})`,
      `A interés: ${fmtCOP(c.resultado.montoInteres)}`,
      `A capital: ${fmtCOP(c.resultado.montoCapital)}`,
      `Nuevo saldo: ${fmtCOP(c.resultado.saldoPosterior)}`,
    ]
    if (c.resultado.excedente > 0) lineas.push(`Sobrante: ${fmtCOP(c.resultado.excedente)}`)
    if (c.resultado.prestamoSaldado) lineas.push('Préstamo saldado ✓')
    return lineas.join('\n')
  }

  async function copiar(c: Comprobante) {
    try {
      await navigator.clipboard.writeText(textoComprobante(c))
      toast.success('Comprobante copiado.')
    } catch {
      toast.error('No pudimos copiar el comprobante.')
    }
  }

  // Comprobante como IMAGEN para el cliente: simple, sin desglose interés/capital.
  async function enviarComprobante(c: Comprobante) {
    const datos: DatosComprobante = {
      negocio: nombreNegocio,
      cliente: clienteNombre,
      referencia: referenciaPrestamo(prestamo.id),
      fechaEmision: fmtFecha(new Date()),
      monto: c.monto,
      fechaPago: c.fecha,
      metodo: metodoLabel(c.metodo),
      estado: [{ etiqueta: 'Saldo pendiente', valor: fmtCOP(c.resultado.saldoPosterior) }],
      mensajeEstado: c.resultado.prestamoSaldado ? 'Su préstamo quedó al día. ¡Gracias!' : null,
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

  // ── Paso comprobante ──
  if (comprobante) {
    const r = comprobante.resultado
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
            <p className="text-xs text-text-2">{metodoLabel(comprobante.metodo)} · {comprobante.fecha}</p>
          </div>

          <Linea etiqueta="Cliente" valor={clienteNombre} />
          <Linea etiqueta="A interés" valor={fmtCOP(r.montoInteres)} mono />
          <Linea etiqueta="A capital" valor={fmtCOP(r.montoCapital)} mono />
          {r.excedente > 0 && <Linea etiqueta="Sobrante" valor={fmtCOP(r.excedente)} mono />}
          <Linea etiqueta="Nuevo saldo" valor={fmtCOP(r.saldoPosterior)} mono />

          {r.prestamoSaldado && (
            <p className="rounded-xl bg-green-tint px-4 py-2 text-center text-sm font-bold text-green-700">
              Este pago saldó el préstamo ✓
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

  // ── Paso formulario ──
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
            disabled={!montoValido || procesando}
          >
            {procesando ? 'Registrando…' : 'Registrar pago'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
            placeholder="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
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

        {/* Desglose del motor (lo que se va a guardar) */}
        {previo && (
          <div className="rounded-xl border border-line bg-bg px-4 py-3">
            <p className="text-sm text-text-2">
              De tu pago de <span className="mono font-bold text-text">{fmtCOP(montoNum)}</span>:
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              <li className="flex justify-between">
                <span className="text-text-2">A interés</span>
                <span className="mono font-semibold text-text">{fmtCOP(previo.montoInteres)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-text-2">A capital</span>
                <span className="mono font-semibold text-text">{fmtCOP(previo.montoCapital)}</span>
              </li>
              {previo.excedente > 0 && (
                <li className="flex justify-between">
                  <span className="text-text-2">Sobrante (saldo a favor)</span>
                  <span className="mono font-semibold text-amber">{fmtCOP(previo.excedente)}</span>
                </li>
              )}
              <li className="flex justify-between border-t border-line pt-1.5">
                <span className="font-semibold text-text">Nuevo saldo</span>
                <span className="mono font-bold text-text">{fmtCOP(previo.saldoPosterior)}</span>
              </li>
            </ul>
            {previo.prestamoSaldado && (
              <p className="mt-2 text-xs font-bold text-green-700">Este pago salda el préstamo.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function Linea({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className={`text-sm font-semibold text-text ${mono ? 'mono' : ''}`}>{valor}</span>
    </div>
  )
}
