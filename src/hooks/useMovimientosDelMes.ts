import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { primerDiaDelMes } from '@/lib/cartera'
import type { Movimiento } from '@/types/database.types'

/**
 * Movimientos del mes en curso (todos los del usuario, vía RLS). Sirve para
 * la ganancia del mes y para saber qué cobros de hoy ya están pagados.
 * `recargaToken` fuerza recarga (p. ej. tras registrar un pago).
 */
export function useMovimientosDelMes(recargaToken = 0) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .gte('fecha', primerDiaDelMes(new Date()))
    if (error) {
      setError('No pudimos cargar los movimientos del mes.')
      setMovimientos([])
    } else {
      setMovimientos(data ?? [])
    }
    setLoading(false)
    // recargaToken no se usa en el cuerpo: se incluye a propósito para forzar la recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargaToken])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { movimientos, loading, error, recargar: cargar }
}
