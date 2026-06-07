import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  aplicarPago,
  type FrecuenciaCuota,
  type ModoInteres,
  type ResultadoPago,
} from '@/lib/motor-prestamos'
import type { Prestamo } from '@/types/database.types'

/** Construye el préstamo del motor a partir de la fila de la BD. */
export function prestamoDelMotor(p: Prestamo) {
  return {
    capitalInicial: p.capital_inicial,
    saldoCapital: p.saldo_capital,
    tasaMensual: p.tasa_mensual,
    modoInteres: p.modo_interes as ModoInteres,
    interesPendiente: p.interes_pendiente,
  }
}

/** Tipo del movimiento según el desglose: 'interes' si no abonó capital, 'cuota' si sí. */
export function tipoMovimiento(resultado: ResultadoPago): 'interes' | 'cuota' {
  return resultado.montoCapital > 0 ? 'cuota' : 'interes'
}

/** Datos que captura el formulario de "Nuevo préstamo". */
export interface PrestamoInput {
  cliente_id: string
  capital_inicial: number
  /** Tasa mensual en decimal: 0.10 = 10%. */
  tasa_mensual: number
  modo_interes: ModoInteres
  /** Fecha de desembolso en formato aaaa-mm-dd. */
  fecha_desembolso: string
}

/** Datos del formulario de "Nuevo préstamo" tipo cuotas. */
export interface PrestamoCuotasInput {
  cliente_id: string
  capital_inicial: number
  /** Tasa mensual en decimal: 0.10 = 10%. */
  tasa_mensual: number
  frecuencia: FrecuenciaCuota
  n_cuotas: number
  fecha_desembolso: string
}

export interface PrestamoMutacion {
  data: Prestamo | null
  error: string | null
}

/**
 * Acceso a la tabla `prestamos`. La RLS restringe a las filas del usuario.
 * Pasa `clienteId` para listar solo los préstamos de un cliente (ficha).
 */
export function usePrestamos(clienteId?: string) {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from('prestamos').select('*').order('created_at', { ascending: false })
    if (clienteId) query = query.eq('cliente_id', clienteId)
    const { data, error } = await query
    if (error) {
      setError('No pudimos cargar los préstamos. Intenta de nuevo.')
      setPrestamos([])
    } else {
      setPrestamos(data ?? [])
    }
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /**
   * Crea el préstamo y su movimiento de desembolso de forma atómica
   * (RPC crear_prestamo: ambos insert entran en una sola transacción).
   */
  const crear = useCallback(async (input: PrestamoInput): Promise<PrestamoMutacion> => {
    const { data, error } = await supabase.rpc('crear_prestamo', {
      p_cliente_id: input.cliente_id,
      p_capital: input.capital_inicial,
      p_tasa_mensual: input.tasa_mensual,
      p_modo_interes: input.modo_interes,
      p_fecha_desembolso: input.fecha_desembolso,
    })
    if (error || !data) {
      return { data: null, error: 'No pudimos crear el préstamo. Intenta de nuevo.' }
    }
    setPrestamos((prev) => [data, ...prev])
    return { data, error: null }
  }, [])

  /**
   * Crea un préstamo tipo 'cuotas' de forma atómica: la RPC genera el préstamo,
   * el desembolso y todas las filas del cronograma (mismo reparto que el motor).
   */
  const crearCuotas = useCallback(
    async (input: PrestamoCuotasInput): Promise<PrestamoMutacion> => {
      const { data, error } = await supabase.rpc('crear_prestamo_cuotas', {
        p_cliente_id: input.cliente_id,
        p_capital: input.capital_inicial,
        p_tasa_mensual: input.tasa_mensual,
        p_frecuencia: input.frecuencia,
        p_n_cuotas: input.n_cuotas,
        p_fecha_desembolso: input.fecha_desembolso,
      })
      if (error || !data) {
        return { data: null, error: 'No pudimos crear el préstamo. Intenta de nuevo.' }
      }
      setPrestamos((prev) => [data, ...prev])
      return { data, error: null }
    },
    [],
  )

  /**
   * Registra un pago. El desglose lo calcula el motor (aplicarPago) a partir
   * del préstamo actual; la RPC solo persiste ese resultado, de forma atómica.
   */
  const registrarPago = useCallback(
    async (
      prestamoId: string,
      monto: number,
      metodoPago: string,
    ): Promise<{ resultado: ResultadoPago | null; error: string | null }> => {
      const p = prestamos.find((x) => x.id === prestamoId)
      if (!p) return { resultado: null, error: 'No encontramos el préstamo.' }

      const { resultado } = aplicarPago(prestamoDelMotor(p), monto)

      const { error } = await supabase.rpc('registrar_pago', {
        p_prestamo_id: prestamoId,
        p_monto: monto,
        p_metodo_pago: metodoPago,
        p_tipo: tipoMovimiento(resultado),
        p_monto_interes: resultado.montoInteres,
        p_monto_capital: resultado.montoCapital,
        p_saldo_anterior: resultado.saldoAnterior,
        p_saldo_posterior: resultado.saldoPosterior,
        p_interes_pendiente_restante: resultado.interesPendienteRestante,
      })
      if (error) {
        return { resultado: null, error: 'No pudimos registrar el pago. Intenta de nuevo.' }
      }

      setPrestamos((prev) =>
        prev.map((x) =>
          x.id === prestamoId
            ? {
                ...x,
                saldo_capital: resultado.saldoPosterior,
                interes_pendiente: resultado.interesPendienteRestante,
                estado: resultado.prestamoSaldado ? 'pagado' : x.estado,
              }
            : x,
        ),
      )
      return { resultado, error: null }
    },
    [prestamos],
  )

  /**
   * Registra un pago contra el cronograma de un préstamo de cuotas (RPC atómica
   * que replica aplicarPagoACuotas / pagarSoloInteres del motor). Refresca el
   * préstamo (saldo/estado) al terminar.
   */
  const registrarPagoCuotas = useCallback(
    async (
      prestamoId: string,
      abono: number,
      metodo: string,
      soloInteres: boolean,
    ): Promise<{ error: string | null }> => {
      const { error } = await supabase.rpc('registrar_pago_cuotas', {
        p_prestamo_id: prestamoId,
        p_abono: abono,
        p_metodo_pago: metodo,
        p_solo_interes: soloInteres,
      })
      if (error) return { error: 'No pudimos registrar el pago. Intenta de nuevo.' }
      await cargar()
      return { error: null }
    },
    [cargar],
  )

  return {
    prestamos,
    loading,
    error,
    crear,
    crearCuotas,
    registrarPago,
    registrarPagoCuotas,
    recargar: cargar,
  }
}
