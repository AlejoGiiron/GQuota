import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ModoInteres } from '@/lib/motor-prestamos'
import type { Prestamo } from '@/types/database.types'

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

  return { prestamos, loading, error, crear, recargar: cargar }
}
