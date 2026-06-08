import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import { generarCronograma, type FrecuenciaCuota } from '@/lib/motor-prestamos'
import type { PrestamoCuotasInput } from '@/hooks/usePrestamos'
import type { PrestamoInput } from '@/hooks/usePrestamos'
import type { ModoInteres } from '@/lib/motor-prestamos'
import type { Cliente } from '@/types/database.types'

const selectClass =
  'w-full h-[52px] rounded-xl border-[1.5px] border-line bg-card px-4 text-[15px] font-medium text-text outline-none transition-colors focus:border-green focus:shadow-[0_0_0_4px_rgba(4,120,87,0.12)]'

const FRECUENCIAS: ReadonlyArray<{ valor: FrecuenciaCuota; label: string }> = [
  { valor: 'semanal', label: 'Semanal' },
  { valor: 'quincenal', label: 'Quincenal' },
  { valor: 'mensual', label: 'Mensual' },
]

function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Suma meses con tope a fin de mes (mismo comportamiento que Postgres + interval,
// para que la previsualización coincida EXACTO con lo que guarda la RPC).
function sumarMeses(base: Date, n: number): Date {
  const objetivo = new Date(base.getFullYear(), base.getMonth() + n, 1)
  const diasEnMes = new Date(objetivo.getFullYear(), objetivo.getMonth() + 1, 0).getDate()
  return new Date(objetivo.getFullYear(), objetivo.getMonth(), Math.min(base.getDate(), diasEnMes))
}

/** Fechas de vencimiento de cada cuota (mismo cálculo que la RPC crear_prestamo_cuotas). */
function fechasCronograma(fechaISO: string, frecuencia: FrecuenciaCuota, nCuotas: number): string[] {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  const fechas: string[] = []
  for (let i = 1; i <= nCuotas; i++) {
    let f: Date
    if (frecuencia === 'semanal') f = new Date(y, m - 1, d + i * 7)
    else if (frecuencia === 'quincenal') f = new Date(y, m - 1, d + i * 15)
    else f = sumarMeses(base, i)
    fechas.push(isoLocal(f))
  }
  return fechas
}

type TipoPrestamo = 'abierto' | 'cuotas'

export default function PrestamoFormModal({
  open,
  clientes,
  onClose,
  onGuardar,
  onGuardarCuotas,
}: {
  open: boolean
  clientes: Cliente[]
  onClose: () => void
  onGuardar: (input: PrestamoInput) => Promise<boolean>
  onGuardarCuotas: (input: PrestamoCuotasInput) => Promise<boolean>
}) {
  const [tipo, setTipo] = useState<TipoPrestamo>('abierto')
  const [clienteId, setClienteId] = useState('')
  const [capital, setCapital] = useState('')
  const [tasa, setTasa] = useState('')
  const [modo, setModo] = useState<ModoInteres>('sobre_saldo')
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCuota>('mensual')
  const [nCuotas, setNCuotas] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [codeudorNombre, setCodeudorNombre] = useState('')
  const [codeudorTelefono, setCodeudorTelefono] = useState('')
  const [codeudorDocumento, setCodeudorDocumento] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setTipo('abierto')
    setClienteId('')
    setCapital('')
    setTasa('')
    setModo('sobre_saldo')
    setFrecuencia('mensual')
    setNCuotas('')
    setFecha(hoyLocal())
    setCodeudorNombre('')
    setCodeudorTelefono('')
    setCodeudorDocumento('')
    setErrores({})
    setGuardando(false)
  }, [open])

  const capitalNum = Number(capital)
  const tasaNum = Number(tasa)
  const nNum = Number(nCuotas)

  // Previsualización del cronograma (solo tipo cuotas, con datos válidos).
  const preview = useMemo(() => {
    if (tipo !== 'cuotas') return null
    if (!capital || Number.isNaN(capitalNum) || capitalNum <= 0) return null
    if (tasa === '' || Number.isNaN(tasaNum) || tasaNum < 0) return null
    if (!Number.isInteger(nNum) || nNum < 1) return null
    if (!fecha) return null
    const cuotas = generarCronograma(capitalNum, tasaNum / 100, frecuencia, nNum)
    const fechas = fechasCronograma(fecha, frecuencia, nNum)
    return cuotas.map((c, i) => ({ ...c, fecha: fechas[i] }))
  }, [tipo, capital, capitalNum, tasa, tasaNum, nNum, frecuencia, fecha])

  const totalPreview = preview ? preview.reduce((s, c) => s + c.capital + c.interes, 0) : 0

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nuevos: Record<string, string> = {}
    if (!clienteId) nuevos.cliente = 'Selecciona un cliente.'
    if (!capital || Number.isNaN(capitalNum) || capitalNum <= 0)
      nuevos.capital = 'Ingresa un capital mayor a cero.'
    if (tasa === '' || Number.isNaN(tasaNum) || tasaNum < 0) nuevos.tasa = 'Ingresa una tasa válida.'
    if (!fecha) nuevos.fecha = 'Selecciona la fecha de desembolso.'
    if (tipo === 'cuotas' && (!Number.isInteger(nNum) || nNum < 1))
      nuevos.nCuotas = 'Ingresa un número de cuotas válido.'

    // Codeudor opcional: si llenaron algún dato, el nombre es obligatorio.
    const codNombre = codeudorNombre.trim()
    const codTelefono = codeudorTelefono.trim()
    const codDocumento = codeudorDocumento.trim()
    if ((codTelefono || codDocumento) && !codNombre)
      nuevos.codeudor = 'Ingresa el nombre del codeudor.'

    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return

    // Sin nombre = sin codeudor: no guardamos teléfono/documento sueltos.
    const codeudor = codNombre
      ? {
          codeudor_nombre: codNombre,
          codeudor_telefono: codTelefono || null,
          codeudor_documento: codDocumento || null,
        }
      : { codeudor_nombre: null, codeudor_telefono: null, codeudor_documento: null }

    setGuardando(true)
    let ok: boolean
    if (tipo === 'cuotas') {
      ok = await onGuardarCuotas({
        cliente_id: clienteId,
        capital_inicial: capitalNum,
        tasa_mensual: tasaNum / 100,
        frecuencia,
        n_cuotas: nNum,
        fecha_desembolso: fecha,
        ...codeudor,
      })
    } else {
      ok = await onGuardar({
        cliente_id: clienteId,
        capital_inicial: capitalNum,
        tasa_mensual: tasaNum / 100,
        modo_interes: modo,
        fecha_desembolso: fecha,
        ...codeudor,
      })
    }
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
          {/* Tipo de préstamo */}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-text-2">Tipo de préstamo</span>
            <div className="flex gap-2">
              {(['abierto', 'cuotas'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    tipo === t
                      ? 'border-green bg-green-tint text-green-700'
                      : 'border-line bg-card text-text-2 hover:bg-bg'
                  }`}
                >
                  {t === 'abierto' ? 'Abierto' : 'Cuotas'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {tipo === 'abierto'
                ? 'Interés mensual sobre saldo, con pago flexible.'
                : 'Cronograma fijo de cuotas con interés pactado.'}
            </p>
          </div>

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

          {/* Campos exclusivos de cada tipo */}
          {tipo === 'abierto' ? (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-2">Modo de interés</span>
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
          ) : (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor="pr-frec" className="text-[13px] font-semibold text-text-2">
                  Frecuencia
                </label>
                <select
                  id="pr-frec"
                  className={selectClass}
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(e.target.value as FrecuenciaCuota)}
                >
                  {FRECUENCIAS.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-[120px] flex-col gap-2">
                <label htmlFor="pr-ncuotas" className="text-[13px] font-semibold text-text-2">
                  N.º cuotas <span className="text-red">*</span>
                </label>
                <input
                  id="pr-ncuotas"
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="4"
                  value={nCuotas}
                  onChange={(e) => setNCuotas(e.target.value)}
                />
              </div>
            </div>
          )}
          {tipo === 'cuotas' && errores.nCuotas && (
            <p className="text-xs font-semibold text-red">{errores.nCuotas}</p>
          )}

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

          {/* Codeudor (opcional) — datos sueltos del préstamo, no un cliente. */}
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-4">
            <span className="text-[13px] font-semibold text-text-2">Codeudor (opcional)</span>
            <input
              id="pr-codeudor-nombre"
              className="input"
              type="text"
              placeholder="Nombre del codeudor"
              value={codeudorNombre}
              onChange={(e) => setCodeudorNombre(e.target.value)}
            />
            <div className="flex gap-3">
              <input
                id="pr-codeudor-telefono"
                className="input flex-1"
                type="tel"
                inputMode="tel"
                placeholder="Teléfono"
                value={codeudorTelefono}
                onChange={(e) => setCodeudorTelefono(e.target.value)}
              />
              <input
                id="pr-codeudor-documento"
                className="input flex-1"
                type="text"
                placeholder="Documento"
                value={codeudorDocumento}
                onChange={(e) => setCodeudorDocumento(e.target.value)}
              />
            </div>
            {errores.codeudor && (
              <p className="text-xs font-semibold text-red">{errores.codeudor}</p>
            )}
          </div>

          {/* Previsualización del cronograma (tipo cuotas) */}
          {preview && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-2">
                Cronograma ({preview.length} cuotas · total {fmtCOP(totalPreview)})
              </span>
              <div className="max-h-56 overflow-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg">
                    <tr className="text-left text-muted">
                      <th className="px-2 py-1.5 font-semibold">#</th>
                      <th className="px-2 py-1.5 font-semibold">Vence</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Capital</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Interés</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((c) => (
                      <tr key={c.numero} className="border-t border-line-soft">
                        <td className="px-2 py-1.5 text-text-2">{c.numero}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-text-2">{fmtFecha(c.fecha)}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right text-text">{fmtCOP(c.capital)}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right text-text">{fmtCOP(c.interes)}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right font-bold text-text">{fmtCOP(c.capital + c.interes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}
