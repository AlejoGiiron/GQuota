import { useState, type ReactNode } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import Avatar from '@/components/Avatar'
import BotonCompartirCronograma from '@/components/BotonCompartirCronograma'
import CronogramaCuotas from '@/components/CronogramaCuotas'
import CronogramaCuotaFija from '@/components/CronogramaCuotaFija'
import EstadoDeCuenta from '@/components/EstadoDeCuenta'
import PagoModal from '@/components/PagoModal'
import PagoCuotasModal from '@/components/PagoCuotasModal'
import PagoCuotaFijaModal from '@/components/PagoCuotaFijaModal'
import { EstadoBadge, TipoOModoBadge, tasaMensualTexto } from '@/components/PrestamoBadges'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import type { ResultadoPago } from '@/lib/motor-prestamos'
import type { Cliente, Prestamo } from '@/types/db'

export interface PrestamosOutletContext {
  prestamos: Prestamo[]
  loading: boolean
  clientePorId: Map<string, Cliente>
  registrarPago: (
    prestamoId: string,
    monto: number,
    metodo: string,
  ) => Promise<{ resultado: ResultadoPago | null; error: string | null }>
  registrarPagoCuotas: (
    prestamoId: string,
    abono: number,
    metodo: string,
    soloInteres: boolean,
  ) => Promise<{ error: string | null }>
  registrarPagoCuotaFija: (
    prestamoId: string,
    monto: number,
    metodo: string,
  ) => Promise<{ error: string | null }>
}

const IconAtras = (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line-soft py-3 first:border-t-0 first:pt-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className="text-right text-sm font-semibold text-text">{children}</span>
    </div>
  )
}

export default function PrestamoFicha() {
  const { prestamoId } = useParams()
  const navigate = useNavigate()
  const {
    prestamos,
    loading,
    clientePorId,
    registrarPago,
    registrarPagoCuotas,
    registrarPagoCuotaFija,
  } = useOutletContext<PrestamosOutletContext>()
  const [pagoAbierto, setPagoAbierto] = useState(false)
  const [pagoCuotasAbierto, setPagoCuotasAbierto] = useState(false)
  const [pagoCuotaFijaAbierto, setPagoCuotaFijaAbierto] = useState(false)
  const [version, setVersion] = useState(0)
  const prestamo = prestamos.find((p) => p.id === prestamoId)

  if (loading && !prestamo) {
    return (
      <div className="flex flex-col gap-3 p-1">
        <div className="h-16 animate-pulse rounded-xl bg-line-soft" />
        <div className="h-48 animate-pulse rounded-xl bg-line-soft" />
      </div>
    )
  }

  if (!prestamo) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm font-semibold text-text">No encontramos este préstamo.</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/prestamos')}>
          Volver a la lista
        </button>
      </div>
    )
  }

  const cliente = clientePorId.get(prestamo.cliente_id)
  const nombre = cliente?.nombre ?? 'Cliente'
  const esCuotas = prestamo.tipo === 'cuotas'
  const esCuotaFija = prestamo.tipo === 'cuota_fija'
  const cobrable = prestamo.estado === 'activo' || prestamo.estado === 'en_mora'
  const pagable = !esCuotas && !esCuotaFija && cobrable // pago flexible (producto "abierto")
  const pagableCuotas = esCuotas && cobrable // pago contra el cronograma
  const pagableCuotaFija = esCuotaFija && cobrable // pago contra las cuotas de monto fijo
  const idPrestamo = prestamo.id

  async function handleRegistrar(monto: number, metodo: string): Promise<ResultadoPago | null> {
    const { resultado, error } = await registrarPago(idPrestamo, monto, metodo)
    if (error) {
      toast.error(error)
      return null
    }
    toast.success('Pago registrado.')
    setVersion((v) => v + 1) // refresca el ledger con el nuevo movimiento
    return resultado
  }

  async function handleRegistrarCuotas(
    abono: number,
    metodo: string,
    soloInteres: boolean,
  ): Promise<boolean> {
    const { error } = await registrarPagoCuotas(idPrestamo, abono, metodo, soloInteres)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Pago registrado.')
    setVersion((v) => v + 1) // refresca el cronograma
    return true
  }

  async function handleRegistrarCuotaFija(monto: number, metodo: string): Promise<boolean> {
    const { error } = await registrarPagoCuotaFija(idPrestamo, monto, metodo)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Pago registrado.')
    setVersion((v) => v + 1) // refresca el cronograma
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate('/prestamos')}
        className="flex items-center gap-1 self-start text-sm font-semibold text-green-700 md:hidden"
      >
        {IconAtras} Volver
      </button>

      {/* Encabezado */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <Avatar nombre={nombre} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold tracking-tight text-text">{nombre}</h2>
            <p className="mt-0.5 text-sm text-text-2">Desembolsado el {fmtFecha(prestamo.fecha_desembolso)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <EstadoBadge estado={prestamo.estado} />
              <TipoOModoBadge tipo={prestamo.tipo} modo={prestamo.modo_interes} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {pagable && (
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => setPagoAbierto(true)}
            >
              Registrar pago
            </button>
          )}
          {pagableCuotas && (
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => setPagoCuotasAbierto(true)}
            >
              Registrar pago
            </button>
          )}
          {pagableCuotaFija && (
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => setPagoCuotaFijaAbierto(true)}
            >
              Registrar pago
            </button>
          )}
          <BotonCompartirCronograma prestamo={prestamo} clienteNombre={nombre} />
        </div>
      </div>

      {/* Codeudor (opcional): solo si el préstamo lo tiene. */}
      {prestamo.codeudor_nombre && (
        <div className="card p-5">
          <h3 className="mb-2 text-sm font-bold text-text">Codeudor</h3>
          <Dato etiqueta="Nombre">{prestamo.codeudor_nombre}</Dato>
          {prestamo.codeudor_telefono && (
            <Dato etiqueta="Teléfono">{prestamo.codeudor_telefono}</Dato>
          )}
          {prestamo.codeudor_documento && (
            <Dato etiqueta="Documento">{prestamo.codeudor_documento}</Dato>
          )}
        </div>
      )}

      {esCuotaFija ? (
        /* Préstamo de cuota fija: el estado de cuenta son las cuotas de monto fijo. */
        <>
          <CronogramaCuotaFija prestamo={prestamo} clienteNombre={nombre} recargaToken={version} />
          {pagoCuotaFijaAbierto && (
            <PagoCuotaFijaModal
              open
              prestamo={prestamo}
              clienteNombre={nombre}
              onClose={() => setPagoCuotaFijaAbierto(false)}
              onRegistrar={handleRegistrarCuotaFija}
            />
          )}
        </>
      ) : esCuotas ? (
        /* Préstamo de cuotas: el estado de cuenta es el cronograma. */
        <>
          <CronogramaCuotas prestamo={prestamo} clienteNombre={nombre} recargaToken={version} />
          {pagoCuotasAbierto && (
            <PagoCuotasModal
              open
              prestamo={prestamo}
              clienteNombre={nombre}
              onClose={() => setPagoCuotasAbierto(false)}
              onRegistrar={handleRegistrarCuotas}
            />
          )}
        </>
      ) : (
        <>
          {/* Saldo destacado */}
          <div className="card flex items-end justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Saldo de capital</p>
              <p className="mono mt-1 text-3xl font-bold text-text">{fmtCOP(prestamo.saldo_capital)}</p>
            </div>
            <p className="text-sm text-text-2">
              de <span className="mono font-semibold text-text">{fmtCOP(prestamo.capital_inicial)}</span>
            </p>
          </div>

          {/* Datos */}
          <div className="card p-5">
            <h3 className="mb-2 text-sm font-bold text-text">Condiciones</h3>
            <Dato etiqueta="Capital inicial">
              <span className="mono">{fmtCOP(prestamo.capital_inicial)}</span>
            </Dato>
            <Dato etiqueta="Saldo actual">
              <span className="mono">{fmtCOP(prestamo.saldo_capital)}</span>
            </Dato>
            <Dato etiqueta="Tasa mensual">{tasaMensualTexto(prestamo.tasa_mensual)}</Dato>
            <Dato etiqueta="Modo de interés">{MODO_TEXTO(prestamo.modo_interes)}</Dato>
            <Dato etiqueta="Desembolso">{fmtFecha(prestamo.fecha_desembolso)}</Dato>
          </div>

          {/* Estado de cuenta + ledger de movimientos */}
          <EstadoDeCuenta prestamo={prestamo} clienteNombre={nombre} recargaToken={version} />

          <PagoModal
            open={pagoAbierto}
            prestamo={prestamo}
            clienteNombre={nombre}
            onClose={() => setPagoAbierto(false)}
            onRegistrar={handleRegistrar}
          />
        </>
      )}
    </div>
  )
}

function MODO_TEXTO(modo: string): string {
  if (modo === 'sobre_saldo') return 'Sobre saldo'
  if (modo === 'sobre_capital_inicial') return 'Fijo sobre el monto'
  return modo
}
