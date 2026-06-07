import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CuotaDB } from '@/types/database.types'

/**
 * Todas las cuotas no pagadas del usuario (pendientes y vencidas), vía RLS.
 * Alimenta los cobros de hoy / vencidos de los préstamos tipo 'cuotas' en el
 * dashboard y en la pantalla de Cobros.
 */
export function useCuotasActivas(recargaToken = 0) {
  const [cuotas, setCuotas] = useState<CuotaDB[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('cuotas').select('*').neq('estado', 'pagada')
    if (error) {
      setError('No pudimos cargar las cuotas.')
      setCuotas([])
    } else {
      setCuotas(data ?? [])
    }
    setLoading(false)
    // recargaToken fuerza la recarga a propósito; no se usa en el cuerpo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargaToken])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { cuotas, loading, error, recargar: cargar }
}
