import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Movimiento } from '@/types/database.types'

/**
 * Movimientos (ledger) de un préstamo, más reciente primero.
 * La RLS restringe a las filas del usuario. `recargaToken` fuerza una
 * recarga cuando cambia (p. ej. tras registrar un pago).
 */
export function useMovimientos(prestamoId: string, recargaToken = 0) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .eq('prestamo_id', prestamoId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      setError('No pudimos cargar los movimientos. Intenta de nuevo.')
      setMovimientos([])
    } else {
      setMovimientos(data ?? [])
    }
    setLoading(false)
    // recargaToken no se usa en el cuerpo: se incluye a propósito para forzar la recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestamoId, recargaToken])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { movimientos, loading, error, recargar: cargar }
}
