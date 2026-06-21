import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Avatar from '@/components/Avatar'
import PagoModal from '@/components/PagoModal'
import PagoCuotasModal from '@/components/PagoCuotasModal'
import PagoCuotaFijaModal from '@/components/PagoCuotaFijaModal'
import { useClientes } from '@/hooks/useClientes'
import { usePrestamos } from '@/hooks/usePrestamos'
import { useMovimientosDelMes } from '@/hooks/useMovimientosDelMes'
import { useCuotasActivas } from '@/hooks/useCuotasActivas'
import { calcularCobrosHoy, calcularVencidos } from '@/lib/cartera'
import { fmtCOP, fmtFecha } from '@/lib/formatters'
import { enlaceWhatsApp } from '@/lib/whatsapp'
import type { Cliente, Prestamo } from '@/types/db'

const IconWhatsApp = (
  <svg className="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.97L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2Zm0 18.13h-.01a8.2 8.2 0 01-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 012.41 5.82c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.12.16 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
  </svg>
)

function mensajeRecordatorio(nombre: string, monto: number, diasAtraso: number, hoy: Date): string {
  const saludo = `Estimado/a ${nombre}, reciba un cordial saludo de G-Quota.`
  if (diasAtraso > 0) {
    return `${saludo} Le recordamos que tiene un pago pendiente de ${fmtCOP(monto)} con ${diasAtraso} ${diasAtraso === 1 ? 'día' : 'días'} de atraso. Le agradecemos ponerse al día. Quedamos atentos. Gracias.`
  }
  return `${saludo} Le recordamos que su pago de ${fmtCOP(monto)} vence hoy ${fmtFecha(hoy)}. Quedamos atentos. Gracias.`
}

function CobroRow({
  prestamo,
  cliente,
  monto,
  diasAtraso,
  cobrado,
  hoy,
  onRegistrar,
}: {
  prestamo: Prestamo
  cliente: Cliente | undefined
  monto: number
  diasAtraso: number
  cobrado: boolean
  hoy: Date
  onRegistrar: (p: Prestamo) => void
}) {
  const nombre = cliente?.nombre ?? 'Cliente'
  const vencido = diasAtraso > 0
  const wa = enlaceWhatsApp(cliente?.telefono, mensajeRecordatorio(nombre, monto, diasAtraso, hoy))

  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3 first:border-t-0 ${
        vencido ? 'border-l-2 border-l-red' : ''
      }`}
    >
      <Avatar nombre={nombre} size={42} />
      <div className="min-w-0 flex-1 leading-tight">
        <Link to={`/prestamos/${prestamo.id}`} className="truncate text-[14.5px] font-bold text-text hover:underline">
          {nombre}
        </Link>
        <div className={`text-xs font-semibold ${vencido ? 'text-red' : 'text-muted'}`}>
          {vencido
            ? `${diasAtraso} ${diasAtraso === 1 ? 'día' : 'días'} de atraso`
            : 'Vence hoy · interés del periodo'}
        </div>
      </div>
      <div className="text-right">
        <div className="mono text-[15px] font-bold text-text">{fmtCOP(monto)}</div>
        <div className="text-[11px] font-semibold text-muted">a cobrar</div>
      </div>
      {cobrado ? (
        <span className="text-sm font-bold text-green-700">Cobrado ✓</span>
      ) : (
        <div className="flex items-center gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !h-9 gap-1.5 !px-3 !text-[13px]"
            >
              {IconWhatsApp}
              WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Este cliente no tiene teléfono registrado"
              className="btn-secondary !h-9 gap-1.5 !px-3 !text-[13px] opacity-50"
            >
              {IconWhatsApp}
              WhatsApp
            </button>
          )}
          <button
            type="button"
            className="btn-primary !h-9 !px-3 !text-[13px]"
            onClick={() => onRegistrar(prestamo)}
          >
            Registrar pago
          </button>
        </div>
      )}
    </div>
  )
}

export default function CobrosPage() {
  const { prestamos, registrarPago, registrarPagoCuotas, registrarPagoCuotaFija } = usePrestamos()
  const { clientes } = useClientes()
  const { movimientos, recargar: recargarMovs } = useMovimientosDelMes()
  const { cuotas, recargar: recargarCuotas } = useCuotasActivas()

  const [pagoPrestamo, setPagoPrestamo] = useState<Prestamo | null>(null)

  const hoy = useMemo(() => new Date(), [])
  const clientePorId = useMemo(
    () => new Map<string, Cliente>(clientes.map((c) => [c.id, c])),
    [clientes],
  )
  const cobros = useMemo(
    () => calcularCobrosHoy(prestamos, movimientos, cuotas, hoy),
    [prestamos, movimientos, cuotas, hoy],
  )
  const vencidos = useMemo(
    () => calcularVencidos(prestamos, movimientos, cuotas, hoy),
    [prestamos, movimientos, cuotas, hoy],
  )

  async function onRegistrar(monto: number, metodo: string) {
    if (!pagoPrestamo) return null
    const { resultado, error } = await registrarPago(pagoPrestamo.id, monto, metodo)
    if (error) {
      toast.error(error)
      return null
    }
    toast.success('Pago registrado.')
    recargarMovs()
    return resultado
  }

  async function onRegistrarCuotas(abono: number, metodo: string, soloInteres: boolean) {
    if (!pagoPrestamo) return false
    const { error } = await registrarPagoCuotas(pagoPrestamo.id, abono, metodo, soloInteres)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Pago registrado.')
    recargarMovs()
    recargarCuotas()
    return true
  }

  async function onRegistrarCuotaFija(monto: number, metodo: string) {
    if (!pagoPrestamo) return false
    const { error } = await registrarPagoCuotaFija(pagoPrestamo.id, monto, metodo)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Pago registrado.')
    recargarMovs()
    recargarCuotas()
    return true
  }

  // Evita que un préstamo aparezca a la vez en "hoy" y "vencidos" (no debería por fechas).
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-text">Cobros</h1>

      {/* Cobros de hoy */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 className="text-base font-bold text-text">Cobros de hoy</h2>
          <span className="text-[13px] font-bold text-text-2">
            <b className="text-green-700">{cobros.cobrados}</b> de {cobros.programados} cobrados
          </span>
        </div>
        {cobros.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-2">No tienes cobros para hoy.</p>
        ) : (
          cobros.items.map((c) => (
            <CobroRow
              key={c.prestamo.id}
              prestamo={c.prestamo}
              cliente={clientePorId.get(c.prestamo.cliente_id)}
              monto={c.montoACobrar}
              diasAtraso={0}
              cobrado={c.cobrado}
              hoy={hoy}
              onRegistrar={setPagoPrestamo}
            />
          ))
        )}
      </section>

      {/* Vencidos */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 className="text-base font-bold text-text">Vencidos</h2>
          {vencidos.length > 0 && (
            <span className="badge badge--vencido">{vencidos.length}</span>
          )}
        </div>
        {vencidos.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-2">No tienes cobros vencidos. 🎉</p>
        ) : (
          vencidos.map((v) => (
            <CobroRow
              key={v.prestamo.id}
              prestamo={v.prestamo}
              cliente={clientePorId.get(v.prestamo.cliente_id)}
              monto={v.montoACobrar}
              diasAtraso={v.diasAtraso}
              cobrado={false}
              hoy={hoy}
              onRegistrar={setPagoPrestamo}
            />
          ))
        )}
      </section>

      {pagoPrestamo && pagoPrestamo.tipo === 'cuota_fija' ? (
        <PagoCuotaFijaModal
          open
          prestamo={pagoPrestamo}
          clienteNombre={clientePorId.get(pagoPrestamo.cliente_id)?.nombre ?? 'Cliente'}
          onClose={() => setPagoPrestamo(null)}
          onRegistrar={onRegistrarCuotaFija}
        />
      ) : pagoPrestamo && pagoPrestamo.tipo === 'cuotas' ? (
        <PagoCuotasModal
          open
          prestamo={pagoPrestamo}
          clienteNombre={clientePorId.get(pagoPrestamo.cliente_id)?.nombre ?? 'Cliente'}
          onClose={() => setPagoPrestamo(null)}
          onRegistrar={onRegistrarCuotas}
        />
      ) : pagoPrestamo ? (
        <PagoModal
          open
          prestamo={pagoPrestamo}
          clienteNombre={clientePorId.get(pagoPrestamo.cliente_id)?.nombre ?? 'Cliente'}
          onClose={() => setPagoPrestamo(null)}
          onRegistrar={onRegistrar}
        />
      ) : null}
    </div>
  )
}
