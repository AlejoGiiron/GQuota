import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CuotaDB } from '@/types/db'

/**
 * Cronograma (filas de la tabla cuotas) de un préstamo tipo 'cuotas',
 * ordenado por número. La RLS restringe a las filas del usuario.
 */
export function useCuotas(prestamoId: string, recargaToken = 0) {
  const [cuotas, setCuotas] = useState<CuotaDB[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('cuotas')
      .select('*')
      .eq('prestamo_id', prestamoId)
      .order('numero', { ascending: true })
    if (error) {
      setError('No pudimos cargar el cronograma. Intenta de nuevo.')
      setCuotas([])
    } else {
      setCuotas(data ?? [])
    }
    setLoading(false)
    // recargaToken no se usa en el cuerpo: se incluye a propósito para forzar la recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestamoId, recargaToken])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { cuotas, loading, error, recargar: cargar }
}
