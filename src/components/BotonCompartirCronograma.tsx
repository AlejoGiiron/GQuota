import { useState } from 'react'
import { toast } from 'sonner'
import { MODO_LABEL, tasaMensualTexto } from '@/components/PrestamoBadges'
import { useConfiguracion } from '@/contexts/ConfiguracionContext'
import { supabase } from '@/lib/supabase'
import type { ModoInteres } from '@/lib/motor-prestamos'
import {
  compartirODescargarTarjeta,
  nombreArchivoTarjeta,
  type CuotaTarjeta,
  type DatosTarjeta,
} from '@/lib/tarjeta-cronograma'
import type { CuotaDB, Prestamo } from '@/types/db'

/**
 * Botón "Compartir cronograma": genera la tarjeta del préstamo como imagen y la
 * comparte (móvil → WhatsApp) o la descarga (escritorio). Sirve para los 3 tipos.
 * El cronograma (cuotas/cuota fija) se trae al hacer clic, no al montar, para no
 * duplicar la consulta que ya hacen las tarjetas de cronograma de la ficha.
 */
export default function BotonCompartirCronograma({
  prestamo,
  clienteNombre,
}: {
  prestamo: Prestamo
  clienteNombre: string
}) {
  const { nombreNegocio } = useConfiguracion()
  const [generando, setGenerando] = useState(false)

  async function construirDatos(): Promise<DatosTarjeta> {
    const base = { negocio: nombreNegocio, cliente: clienteNombre, fechaEmision: new Date() }

    // Préstamo "abierto": no tiene cuotas; mostramos saldo y condiciones.
    if (prestamo.tipo !== 'cuotas' && prestamo.tipo !== 'cuota_fija') {
      return {
        ...base,
        variante: 'abierto',
        capital: prestamo.capital_inicial,
        saldo: prestamo.saldo_capital,
        tasaTexto: tasaMensualTexto(prestamo.tasa_mensual),
        modoTexto: MODO_LABEL[prestamo.modo_interes as ModoInteres] ?? prestamo.modo_interes,
      }
    }

    // Cuotas / cuota fija: traer el cronograma (ordenado por número).
    const { data, error } = await supabase
      .from('cuotas')
      .select('*')
      .eq('prestamo_id', prestamo.id)
      .order('numero', { ascending: true })
    if (error) throw error
    const cuotas = (data ?? []) as CuotaDB[]
    const esCuotaFija = prestamo.tipo === 'cuota_fija'
    const pendientes = cuotas.filter((c) => c.estado !== 'pagada')
    // Valor de una cuota: en cuota fija el valor vive en `capital` (sobrevive al
    // pago); en cuotas pactadas la cuota pagada queda en 0, así que tomamos una
    // pendiente (capital + interés). Si no hay pendientes, se omite (0).
    const representativa = pendientes[0]
    const valorCuota = esCuotaFija
      ? cuotas[0]?.capital ?? 0
      : representativa
        ? representativa.capital + representativa.interes
        : 0

    return {
      ...base,
      variante: 'cronograma',
      capital: prestamo.capital_inicial,
      nCuotas: cuotas.length,
      valorCuota,
      pagadas: cuotas.length - pendientes.length,
      proximaFecha: pendientes[0]?.fecha_vence ?? null,
      cuotas: cuotas.map<CuotaTarjeta>((c) => ({
        numero: c.numero,
        fechaVence: c.fecha_vence,
        estado: c.estado,
      })),
    }
  }

  async function compartir() {
    setGenerando(true)
    try {
      const datos = await construirDatos()
      await compartirODescargarTarjeta(datos, nombreArchivoTarjeta(clienteNombre))
    } catch {
      toast.error('No pudimos generar el cronograma.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <button
      type="button"
      className="btn-secondary w-full sm:w-auto"
      onClick={compartir}
      disabled={generando}
    >
      {generando ? 'Generando…' : 'Compartir cronograma'}
    </button>
  )
}
