import { useEffect, useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import { fmtCOP } from '@/lib/formatters'
import type { PrestamoInput } from '@/hooks/usePrestamos'
import type { ModoInteres } from '@/lib/motor-prestamos'
import type { Cliente } from '@/types/database.types'

const selectClass =
  'w-full h-[52px] rounded-xl border-[1.5px] border-line bg-card px-4 text-[15px] font-medium text-text outline-none transition-colors focus:border-green focus:shadow-[0_0_0_4px_rgba(4,120,87,0.12)]'

function hoyLocal(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** Modal de alta de préstamo. Captura solo la tasa mensual pactada (sin TEA ni usura). */
export default function PrestamoFormModal({
  open,
  clientes,
  onClose,
  onGuardar,
}: {
  open: boolean
  clientes: Cliente[]
  onClose: () => void
  onGuardar: (input: PrestamoInput) => Promise<boolean>
}) {
  const [clienteId, setClienteId] = useState('')
  const [capital, setCapital] = useState('')
  const [tasa, setTasa] = useState('')
  const [modo, setModo] = useState<ModoInteres>('sobre_saldo')
  const [fecha, setFecha] = useState(hoyLocal())
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setClienteId('')
    setCapital('')
    setTasa('')
    setModo('sobre_saldo')
    setFecha(hoyLocal())
    setErrores({})
    setGuardando(false)
  }, [open])

  const capitalNum = Number(capital)
  const tasaNum = Number(tasa)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nuevos: Record<string, string> = {}
    if (!clienteId) nuevos.cliente = 'Selecciona un cliente.'
    if (!capital || Number.isNaN(capitalNum) || capitalNum <= 0)
      nuevos.capital = 'Ingresa un capital mayor a cero.'
    if (tasa === '' || Number.isNaN(tasaNum) || tasaNum < 0)
      nuevos.tasa = 'Ingresa una tasa válida.'
    if (!fecha) nuevos.fecha = 'Selecciona la fecha de desembolso.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return

    setGuardando(true)
    const ok = await onGuardar({
      cliente_id: clienteId,
      capital_inicial: capitalNum,
      tasa_mensual: tasaNum / 100, // 10 (%) -> 0.10 decimal
      modo_interes: modo,
      fecha_desembolso: fecha,
    })
    setGuardando(false)
    if (ok) onClose()
  }

  const sinClientes = clientes.length === 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      titulo="Nuevo préstamo"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-prestamo"
            className="btn-primary"
            disabled={guardando || sinClientes}
          >
            {guardando ? 'Guardando…' : 'Crear préstamo'}
          </button>
        </>
      }
    >
      {sinClientes ? (
        <p className="text-sm text-text-2">
          Primero registra un cliente para poder crear un préstamo.
        </p>
      ) : (
        <form id="form-prestamo" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="pr-cliente" className="text-[13px] font-semibold text-text-2">
              Cliente <span className="text-red">*</span>
            </label>
            <select
              id="pr-cliente"
              className={selectClass}
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Selecciona un cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {errores.cliente && <p className="text-xs font-semibold text-red">{errores.cliente}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="pr-capital" className="text-[13px] font-semibold text-text-2">
              Capital prestado <span className="text-red">*</span>
            </label>
            <input
              id="pr-capital"
              className="input"
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="1000000"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
            {capital !== '' && !Number.isNaN(capitalNum) && capitalNum > 0 && (
              <p className="mono text-xs font-semibold text-text-2">{fmtCOP(capitalNum)}</p>
            )}
            {errores.capital && <p className="text-xs font-semibold text-red">{errores.capital}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="pr-tasa" className="text-[13px] font-semibold text-text-2">
              Tasa mensual (%) <span className="text-red">*</span>
            </label>
            <input
              id="pr-tasa"
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="10"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
            />
            {errores.tasa && <p className="text-xs font-semibold text-red">{errores.tasa}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-text-2">Modo de interés</span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-sm font-medium text-text">
                <input
                  type="radio"
                  name="modo"
                  className="accent-green"
                  checked={modo === 'sobre_saldo'}
                  onChange={() => setModo('sobre_saldo')}
                />
                Sobre saldo <span className="text-muted">— el interés baja al abonar</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-medium text-text">
                <input
                  type="radio"
                  name="modo"
                  className="accent-green"
                  checked={modo === 'sobre_capital_inicial'}
                  onChange={() => setModo('sobre_capital_inicial')}
                />
                Fijo sobre el monto prestado <span className="text-muted">— interés fijo</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="pr-fecha" className="text-[13px] font-semibold text-text-2">
              Fecha de desembolso <span className="text-red">*</span>
            </label>
            <input
              id="pr-fecha"
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            {errores.fecha && <p className="text-xs font-semibold text-red">{errores.fecha}</p>}
          </div>
        </form>
      )}
    </Modal>
  )
}
