import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Modal from '@/components/Modal'
import ControlSegmentado from '@/components/ui/ControlSegmentado'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import {
  generarCronograma,
  generarCronogramaFijo,
  resumenCuotaFija,
  type FrecuenciaCuota,
} from '@/lib/motor-prestamos'
import {
  avisoAbierto,
  avisoCuotas,
  cobrosPasados,
  hoyColombia,
  proximoCobro,
  resumenAbierto,
  resumenCuotas,
  type Aviso,
  type CuotaPrevista,
} from '@/lib/prestamo-existente'
import type { PrestamoCuotasInput, PrestamoCuotaFijaInput, PrestamoExistenteInput } from '@/hooks/usePrestamos'
import type { PrestamoInput } from '@/hooks/usePrestamos'
import type { ModoInteres } from '@/lib/motor-prestamos'
import type { Cliente } from '@/types/db'

const selectClass =
  'w-full h-[52px] rounded-control border border-borde-control bg-card px-4 text-[15px] font-medium text-text outline-none transition-colors focus:border-marca-texto focus:shadow-[inset_0_0_0_1px_var(--marca-texto)]'

const FRECUENCIAS: ReadonlyArray<{ valor: FrecuenciaCuota; label: string }> = [
  { valor: 'diaria', label: 'Diaria' },
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
    if (frecuencia === 'diaria') f = new Date(y, m - 1, d + i)
    else if (frecuencia === 'semanal') f = new Date(y, m - 1, d + i * 7)
    else if (frecuencia === 'quincenal') f = new Date(y, m - 1, d + i * 15)
    else f = sumarMeses(base, i)
    fechas.push(isoLocal(f))
  }
  return fechas
}

type TipoPrestamo = 'abierto' | 'cuotas' | 'cuota_fija'

/** Valor del selector "Último cobro que le pagaron" cuando no pagó ninguno. */
const NINGUNO = 'ninguno'

function FilaResumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-2">{etiqueta}</span>
      <span className="mono text-right font-bold text-text">{valor}</span>
    </div>
  )
}

const TONO_AVISO: Record<Aviso['tono'], string> = {
  ok: 'bg-green-tint text-green-700',
  atraso: 'bg-estado-por-vencer-fondo text-estado-por-vencer',
  mora: 'bg-red-tint text-red',
}

function AvisoExistente({ aviso }: { aviso: Aviso }) {
  return (
    <p role={aviso.tono === 'ok' ? undefined : 'alert'} className={`rounded-lg px-3 py-2 text-xs font-semibold ${TONO_AVISO[aviso.tono]}`}>
      {aviso.texto}
    </p>
  )
}

export default function PrestamoFormModal({
  open,
  clientes,
  cobradores,
  clienteInicial,
  onClose,
  onGuardar,
  onGuardarCuotas,
  onGuardarCuotaFija,
  onGuardarExistente,
}: {
  open: boolean
  clientes: Cliente[]
  /** Cobradores activos del negocio para asignar (solo dueño). */
  cobradores: ReadonlyArray<{ id: string; nombre: string | null }>
  /** Cliente ya elegido al abrir (p. ej. recién aprobado desde una solicitud). */
  clienteInicial?: string
  onClose: () => void
  onGuardar: (input: PrestamoInput) => Promise<boolean>
  onGuardarCuotas: (input: PrestamoCuotasInput) => Promise<boolean>
  onGuardarCuotaFija: (input: PrestamoCuotaFijaInput) => Promise<boolean>
  /** Préstamo que ya venía pagándose antes de la app (fecha de desembolso pasada). */
  onGuardarExistente: (input: PrestamoExistenteInput) => Promise<boolean>
}) {
  const [tipo, setTipo] = useState<TipoPrestamo>('abierto')
  const [clienteId, setClienteId] = useState('')
  const [cobradorId, setCobradorId] = useState('') // '' = sin asignar
  const [capital, setCapital] = useState('')
  const [tasa, setTasa] = useState('')
  const [modo, setModo] = useState<ModoInteres>('sobre_saldo')
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCuota>('mensual')
  const [nCuotas, setNCuotas] = useState('')
  const [valorCuota, setValorCuota] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [codeudorNombre, setCodeudorNombre] = useState('')
  const [codeudorTelefono, setCodeudorTelefono] = useState('')
  const [codeudorDocumento, setCodeudorDocumento] = useState('')
  // Préstamo existente (solo con fecha de desembolso pasada).
  const [existente, setExistente] = useState(false)
  const [cuotasPagadas, setCuotasPagadas] = useState('')
  const [abonoSiguiente, setAbonoSiguiente] = useState('')
  const [saldoHoy, setSaldoHoy] = useState('') // '' = igual al capital
  const [pagadoHasta, setPagadoHasta] = useState('') // '' = sin elegir · NINGUNO · aaaa-mm-dd
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  // En los campos del préstamo existente, el error se quita al corregir el dato.
  function quitarError(campo: string) {
    setErrores((prev) => {
      if (!(campo in prev)) return prev
      const resto = { ...prev }
      delete resto[campo]
      return resto
    })
  }

  useEffect(() => {
    if (!open) return
    setTipo('abierto')
    setClienteId(clienteInicial ?? '')
    setCobradorId('')
    setCapital('')
    setTasa('')
    setModo('sobre_saldo')
    setFrecuencia('mensual')
    setNCuotas('')
    setValorCuota('')
    setFecha(hoyLocal())
    setCodeudorNombre('')
    setCodeudorTelefono('')
    setCodeudorDocumento('')
    setExistente(false)
    setCuotasPagadas('')
    setAbonoSiguiente('')
    setSaldoHoy('')
    setPagadoHasta('')
    setErrores({})
    setGuardando(false)
  }, [open, clienteInicial])

  const capitalNum = Number(capital)
  const tasaNum = Number(tasa)
  const nNum = Number(nCuotas)
  const valorNum = Number(valorCuota)

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

  // Resumen en vivo de cuota fija: total (nº × valor) y ganancia (total − capital).
  const resumenFija = useMemo(() => {
    if (tipo !== 'cuota_fija') return null
    if (Number.isNaN(capitalNum) || capitalNum <= 0) return null
    if (!Number.isInteger(nNum) || nNum < 1) return null
    if (Number.isNaN(valorNum) || valorNum <= 0) return null
    return resumenCuotaFija(capitalNum, nNum, valorNum)
  }, [tipo, capitalNum, nNum, valorNum])

  // Previsualización del cronograma de cuota fija (nº, fecha de vencimiento, valor).
  const previewFija = useMemo(() => {
    if (tipo !== 'cuota_fija') return null
    if (!Number.isInteger(nNum) || nNum < 1) return null
    if (Number.isNaN(valorNum) || valorNum <= 0) return null
    if (!fecha) return null
    const cuotas = generarCronogramaFijo(nNum, valorNum)
    const fechas = fechasCronograma(fecha, frecuencia, nNum)
    return cuotas.map((c, i) => ({ ...c, fecha: fechas[i] }))
  }, [tipo, nNum, valorNum, frecuencia, fecha])

  // ── Préstamo existente: solo si la fecha de desembolso es anterior a hoy (Colombia) ──
  const hoy = hoyColombia()
  const fechaPasada = fecha !== '' && fecha < hoy
  const esExistente = existente && fechaPasada
  const pagadasNum = Number(cuotasPagadas)
  const abonoNum = abonoSiguiente === '' ? 0 : Number(abonoSiguiente)
  const saldoNum = saldoHoy === '' ? capitalNum : Number(saldoHoy)
  const cobros = useMemo(
    () => (fechaPasada && tipo === 'abierto' ? cobrosPasados(fecha, hoy) : []),
    [fechaPasada, tipo, fecha, hoy],
  )
  // Si cambió la fecha, un cobro elegido antes puede ya no estar en la lista.
  const pagadoHastaValido = pagadoHasta === NINGUNO || cobros.includes(pagadoHasta) ? pagadoHasta : ''
  const pagadoHastaFecha = pagadoHastaValido === '' || pagadoHastaValido === NINGUNO ? null : pagadoHastaValido

  // Resumen en vivo del préstamo existente (con el aviso si algo queda atrasado).
  const resumenExistenteCuotas = useMemo(() => {
    if (!esExistente || tipo === 'abierto') return null
    const lista: CuotaPrevista[] | null =
      tipo === 'cuotas'
        ? preview?.map((c) => ({ numero: c.numero, fecha: c.fecha, valor: c.capital + c.interes })) ?? null
        : previewFija?.map((c) => ({ numero: c.numero, fecha: c.fecha, valor: c.valor })) ?? null
    if (!lista) return null
    if (cuotasPagadas === '' || !Number.isInteger(pagadasNum) || pagadasNum < 0 || pagadasNum >= lista.length) return null
    const abono = tipo === 'cuota_fija' ? abonoNum : 0
    if (Number.isNaN(abono) || abono < 0 || (tipo === 'cuota_fija' && abono >= valorNum)) return null
    const r = resumenCuotas(lista, pagadasNum, abono, hoy)
    return { ...r, aviso: avisoCuotas(r, abono) }
  }, [esExistente, tipo, preview, previewFija, cuotasPagadas, pagadasNum, abonoNum, valorNum, hoy])

  const resumenExistenteAbierto = useMemo(() => {
    if (!esExistente || tipo !== 'abierto') return null
    if (!capital || Number.isNaN(capitalNum) || capitalNum <= 0) return null
    if (tasa === '' || Number.isNaN(tasaNum) || tasaNum < 0) return null
    if (Number.isNaN(saldoNum) || saldoNum <= 0 || saldoNum > capitalNum) return null
    if (cobros.length > 0 && pagadoHastaValido === '') return null
    const r = resumenAbierto({
      capital: capitalNum,
      saldo: saldoNum,
      tasa: tasaNum / 100,
      modo,
      fechaDesembolso: fecha,
      pagadoHasta: pagadoHastaFecha,
      hoy,
    })
    return { ...r, aviso: avisoAbierto(r) }
  }, [esExistente, tipo, capital, capitalNum, tasa, tasaNum, saldoNum, cobros, pagadoHastaValido, pagadoHastaFecha, modo, fecha, hoy])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nuevos: Record<string, string> = {}
    if (!clienteId) nuevos.cliente = 'Selecciona un cliente.'
    if (!capital || Number.isNaN(capitalNum) || capitalNum <= 0)
      nuevos.capital = 'Ingresa un capital mayor a cero.'
    // La tasa solo aplica a 'abierto' y 'cuotas'; 'cuota_fija' no tiene tasa.
    if (tipo !== 'cuota_fija' && (tasa === '' || Number.isNaN(tasaNum) || tasaNum < 0))
      nuevos.tasa = 'Ingresa una tasa válida.'
    if (!fecha) nuevos.fecha = 'Selecciona la fecha de desembolso.'
    if ((tipo === 'cuotas' || tipo === 'cuota_fija') && (!Number.isInteger(nNum) || nNum < 1))
      nuevos.nCuotas = 'Ingresa un número de cuotas válido.'
    if (tipo === 'cuota_fija' && (!valorCuota || Number.isNaN(valorNum) || valorNum <= 0))
      nuevos.valorCuota = 'Ingresa el valor de la cuota.'

    // Codeudor opcional: si llenaron algún dato, el nombre es obligatorio.
    const codNombre = codeudorNombre.trim()
    const codTelefono = codeudorTelefono.trim()
    const codDocumento = codeudorDocumento.trim()
    if ((codTelefono || codDocumento) && !codNombre)
      nuevos.codeudor = 'Ingresa el nombre del codeudor.'

    // Préstamo existente: lo que ya pagó.
    if (esExistente && (tipo === 'cuotas' || tipo === 'cuota_fija')) {
      const nValido = Number.isInteger(nNum) && nNum >= 1
      if (cuotasPagadas === '' || !Number.isInteger(pagadasNum) || pagadasNum < 0 || (nValido && pagadasNum >= nNum))
        nuevos.cuotasPagadas = 'Ingresa las cuotas que ya pagó: deben ser menos que el total de cuotas.'
      if (tipo === 'cuota_fija' && (Number.isNaN(abonoNum) || abonoNum < 0 || (valorNum > 0 && abonoNum >= valorNum)))
        nuevos.abono = 'El abono debe ser menor que el valor de la cuota.'
    }
    if (esExistente && tipo === 'abierto') {
      if (Number.isNaN(saldoNum) || saldoNum <= 0 || (capitalNum > 0 && saldoNum > capitalNum))
        nuevos.saldo = 'El saldo debe ser mayor a cero y no superar el capital prestado.'
      if (cobros.length > 0 && pagadoHastaValido === '')
        nuevos.pagadoHasta = 'Elige el último cobro de intereses que le pagaron.'
    }

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

    const cobrador_id = cobradorId || null

    setGuardando(true)
    let ok: boolean
    if (esExistente) {
      const base = { tipo, cliente_id: clienteId, capital_inicial: capitalNum, fecha_desembolso: fecha, cobrador_id, ...codeudor }
      ok = await onGuardarExistente(
        tipo === 'abierto'
          ? { ...base, tasa_mensual: tasaNum / 100, modo_interes: modo, saldo_capital: saldoNum, interes_pagado_hasta: pagadoHastaFecha }
          : tipo === 'cuotas'
            ? { ...base, tasa_mensual: tasaNum / 100, frecuencia, n_cuotas: nNum, cuotas_pagadas: pagadasNum }
            : { ...base, frecuencia, n_cuotas: nNum, valor_cuota: valorNum, cuotas_pagadas: pagadasNum, abonado_siguiente: abonoNum },
      )
    } else if (tipo === 'cuotas') {
      ok = await onGuardarCuotas({
        cliente_id: clienteId,
        capital_inicial: capitalNum,
        tasa_mensual: tasaNum / 100,
        frecuencia,
        n_cuotas: nNum,
        fecha_desembolso: fecha,
        cobrador_id,
        ...codeudor,
      })
    } else if (tipo === 'cuota_fija') {
      ok = await onGuardarCuotaFija({
        cliente_id: clienteId,
        capital_inicial: capitalNum,
        frecuencia,
        n_cuotas: nNum,
        valor_cuota: valorNum,
        fecha_desembolso: fecha,
        cobrador_id,
        ...codeudor,
      })
    } else {
      ok = await onGuardar({
        cliente_id: clienteId,
        capital_inicial: capitalNum,
        tasa_mensual: tasaNum / 100,
        modo_interes: modo,
        fecha_desembolso: fecha,
        cobrador_id,
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
              {(['abierto', 'cuotas', 'cuota_fija'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`min-h-11 flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    tipo === t
                      ? 'border-green bg-green-tint text-green-700'
                      : 'border-line bg-card text-text-2 hover:bg-bg'
                  }`}
                >
                  {t === 'abierto' ? 'Abierto' : t === 'cuotas' ? 'Cuotas' : 'Cuota fija'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {tipo === 'abierto'
                ? 'Interés mensual sobre saldo, con pago flexible.'
                : tipo === 'cuotas'
                  ? 'Cronograma fijo de cuotas con interés pactado.'
                  : 'Cuotas de monto fijo; sin tasa ni interés aparte.'}
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

          {/* Cobrador asignado (opcional). El cronograma/cálculo no depende de esto;
              solo decide quién verá y cobrará el préstamo (RLS por asignación). */}
          <div className="flex flex-col gap-2">
            <label htmlFor="pr-cobrador" className="text-[13px] font-semibold text-text-2">
              Cobrador asignado
            </label>
            <select
              id="pr-cobrador"
              className={selectClass}
              value={cobradorId}
              onChange={(e) => setCobradorId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {cobradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre ?? 'Cobrador'}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              Si lo asignas, solo ese cobrador (y tú) verá y cobrará este préstamo.
            </p>
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

          {/* La tasa no aplica a 'cuota_fija' (no hay interés por tiempo). */}
          {tipo !== 'cuota_fija' && (
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
          )}

          {/* Campos exclusivos de cada tipo */}
          {tipo === 'abierto' && (
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
          )}

          {(tipo === 'cuotas' || tipo === 'cuota_fija') && (
            <>
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
              {errores.nCuotas && (
                <p className="text-xs font-semibold text-red">{errores.nCuotas}</p>
              )}
            </>
          )}

          {tipo === 'cuota_fija' && (
            <div className="flex flex-col gap-2">
              <label htmlFor="pr-valor" className="text-[13px] font-semibold text-text-2">
                Valor de la cuota <span className="text-red">*</span>
              </label>
              <input
                id="pr-valor"
                className="input"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="10000"
                value={valorCuota}
                onChange={(e) => setValorCuota(e.target.value)}
              />
              {valorCuota !== '' && !Number.isNaN(valorNum) && valorNum > 0 && (
                <p className="mono text-xs font-semibold text-text-2">{fmtCOP(valorNum)}</p>
              )}
              {errores.valorCuota && (
                <p className="text-xs font-semibold text-red">{errores.valorCuota}</p>
              )}
            </div>
          )}

          {/* Resumen en vivo de cuota fija: total y ganancia, con alerta si es negativa */}
          {resumenFija && (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-2">Total a cobrar</span>
                <span className="mono font-bold text-text">{fmtCOP(resumenFija.total)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-2">Ganancia</span>
                <span
                  className={`mono font-bold ${resumenFija.ganancia < 0 ? 'text-red' : 'text-green-700'}`}
                >
                  {fmtCOP(resumenFija.ganancia)}
                </span>
              </div>
              {resumenFija.ganancia < 0 && (
                <p className="rounded-lg bg-red-tint px-3 py-2 text-xs font-semibold text-red">
                  El total a cobrar es menor que el capital prestado. Puedes continuar, pero revisa
                  el valor de la cuota.
                </p>
              )}
            </div>
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

          {/* Préstamo existente (fecha pasada): lo ya pagado queda en el préstamo, no en la caja. */}
          {fechaPasada && (
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-text-2">¿Es un préstamo que ya venía pagándose?</span>
                <ControlSegmentado
                  etiquetaAccesible="¿Es un préstamo que ya venía pagándose?"
                  valor={existente ? 'si' : 'no'}
                  alCambiar={(v) => setExistente(v === 'si')}
                  opciones={[
                    { valor: 'no', etiqueta: 'No' },
                    { valor: 'si', etiqueta: 'Sí' },
                  ]}
                />
                <p className="text-xs text-muted">
                  {existente
                    ? 'Lo que ya pagó queda registrado en el préstamo, pero no entra en la caja de hoy ni en la ganancia.'
                    : 'Con «No» se crea desde esa fecha sin ningún pago.'}
                </p>
              </div>

              {existente && (tipo === 'cuotas' || tipo === 'cuota_fija') && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="pr-pagadas" className="text-[13px] font-semibold text-text-2">
                    {tipo === 'cuota_fija' ? 'Cuotas que ya pagó completas' : 'Cuotas que ya pagó'}{' '}
                    <span className="text-red">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="pr-pagadas"
                      className="input w-[120px]"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={cuotasPagadas}
                      onChange={(e) => {
                        setCuotasPagadas(e.target.value)
                        quitarError('cuotasPagadas')
                      }}
                    />
                    {Number.isInteger(nNum) && nNum >= 1 && <span className="text-sm text-text-2">de {nNum}</span>}
                  </div>
                  {errores.cuotasPagadas && (
                    <p className="text-xs font-semibold text-red">{errores.cuotasPagadas}</p>
                  )}
                </div>
              )}

              {existente && tipo === 'cuota_fija' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="pr-abono" className="text-[13px] font-semibold text-text-2">
                    Abonado a la cuota siguiente
                  </label>
                  <input
                    id="pr-abono"
                    className="input"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder="0"
                    value={abonoSiguiente}
                    onChange={(e) => {
                      setAbonoSiguiente(e.target.value)
                      quitarError('abono')
                    }}
                  />
                  <p className="text-xs text-muted">Opcional: lo que ya abonó a la cuota que sigue, sin completarla.</p>
                  {errores.abono && <p className="text-xs font-semibold text-red">{errores.abono}</p>}
                </div>
              )}

              {existente && tipo === 'abierto' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pr-saldo" className="text-[13px] font-semibold text-text-2">
                      Saldo de capital hoy
                    </label>
                    <input
                      id="pr-saldo"
                      className="input"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder={capitalNum > 0 ? String(capitalNum) : 'Igual al capital prestado'}
                      value={saldoHoy}
                      onChange={(e) => {
                        setSaldoHoy(e.target.value)
                        quitarError('saldo')
                      }}
                    />
                    <p className="text-xs text-muted">
                      Si no ha abonado a capital, déjalo vacío: queda igual al capital prestado.
                    </p>
                    {errores.saldo && <p className="text-xs font-semibold text-red">{errores.saldo}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pr-pagado-hasta" className="text-[13px] font-semibold text-text-2">
                      Último cobro de intereses que le pagaron {cobros.length > 0 && <span className="text-red">*</span>}
                    </label>
                    {cobros.length === 0 ? (
                      <p className="text-sm text-text-2">
                        Todavía no le ha tocado ningún cobro: el primero es el {fmtFecha(proximoCobro(fecha, hoy))}.
                      </p>
                    ) : (
                      <select
                        id="pr-pagado-hasta"
                        className={selectClass}
                        value={pagadoHastaValido}
                        onChange={(e) => {
                          setPagadoHasta(e.target.value)
                          quitarError('pagadoHasta')
                        }}
                      >
                        <option value="">Elige…</option>
                        {cobros.map((c, i) => (
                          <option key={c} value={c}>
                            {fmtFecha(c)}
                            {i === 0 ? ' · el más reciente' : ''}
                          </option>
                        ))}
                        <option value={NINGUNO}>Ninguno</option>
                      </select>
                    )}
                    {errores.pagadoHasta && <p className="text-xs font-semibold text-red">{errores.pagadoHasta}</p>}
                  </div>
                </>
              )}

              {/* Resumen en vivo antes de guardar */}
              {resumenExistenteCuotas && (
                <div className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3">
                  <FilaResumen etiqueta="Ya pagó (no entra en la caja)" valor={fmtCOP(resumenExistenteCuotas.pagadoAntes)} />
                  <FilaResumen
                    etiqueta={`Quedan ${resumenExistenteCuotas.cuotasRestantes} ${resumenExistenteCuotas.cuotasRestantes === 1 ? 'cuota' : 'cuotas'}`}
                    valor={fmtCOP(resumenExistenteCuotas.saldo)}
                  />
                  {resumenExistenteCuotas.proxima && (
                    <FilaResumen
                      etiqueta="Próxima cuota"
                      valor={`N.º ${resumenExistenteCuotas.proxima.numero} · ${fmtFecha(resumenExistenteCuotas.proxima.fecha)}`}
                    />
                  )}
                  {resumenExistenteCuotas.proxima && tipo === 'cuota_fija' && abonoNum > 0 && (
                    <FilaResumen etiqueta="Le falta a esa cuota" valor={fmtCOP(resumenExistenteCuotas.proxima.falta)} />
                  )}
                  <AvisoExistente aviso={resumenExistenteCuotas.aviso} />
                </div>
              )}
              {resumenExistenteAbierto && (
                <div className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3">
                  <FilaResumen etiqueta="Interés pendiente hoy" valor={fmtCOP(resumenExistenteAbierto.interesPendiente)} />
                  {resumenExistenteAbierto.abonadoCapital > 0 && (
                    <FilaResumen
                      etiqueta="Abonado a capital (no entra en la caja)"
                      valor={fmtCOP(resumenExistenteAbierto.abonadoCapital)}
                    />
                  )}
                  <FilaResumen etiqueta="Próximo cobro" valor={fmtFecha(resumenExistenteAbierto.proximoCobro)} />
                  <p className="text-xs text-muted">El interés pendiente se calcula con lo que declaraste; no se edita.</p>
                  <AvisoExistente aviso={resumenExistenteAbierto.aviso} />
                </div>
              )}
            </div>
          )}

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

          {/* Previsualización del cronograma (tipo cuota fija) */}
          {previewFija && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-2">
                Cronograma ({previewFija.length} cuotas · total{' '}
                {fmtCOP(previewFija.reduce((s, c) => s + c.valor, 0))})
              </span>
              <div className="max-h-56 overflow-auto rounded-xl border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg">
                    <tr className="text-left text-muted">
                      <th className="px-2 py-1.5 font-semibold">#</th>
                      <th className="px-2 py-1.5 font-semibold">Vence</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewFija.map((c) => (
                      <tr key={c.numero} className="border-t border-line-soft">
                        <td className="px-2 py-1.5 text-text-2">{c.numero}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-text-2">{fmtFecha(c.fecha)}</td>
                        <td className="mono whitespace-nowrap px-2 py-1.5 text-right font-bold text-text">{fmtCOP(c.valor)}</td>
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
