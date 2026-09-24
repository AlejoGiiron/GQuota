import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Solicitud } from '@/types/db'

/** Columnas que usa la lista (sin token_hash ni los datos del prospecto). */
export type SolicitudLista = Pick<
  Solicitud,
  'id' | 'telefono' | 'nombre_referencia' | 'estado' | 'expira_en' | 'created_at' | 'completada_en' | 'revisada_en' | 'cliente_id'
>

/** Lo que devuelve crear_solicitud. El token solo existe aquí: no se guarda en ningún lado. */
export type EnlaceCreado = {
  id: string
  token: string
  telefono: string
  nombre_referencia: string | null
  expira_en: string
}

/**
 * Solicitudes del negocio (solo el dueño: la RLS no le devuelve nada a un cobrador).
 * Las anuladas no se listan: un enlace nuevo las reemplazó.
 */
export function useSolicitudes(habilitado: boolean) {
  const [solicitudes, setSolicitudes] = useState<SolicitudLista[]>([])
  const [loading, setLoading] = useState(habilitado)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!habilitado) {
      setSolicitudes([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('solicitudes')
      .select('id, telefono, nombre_referencia, estado, expira_en, created_at, completada_en, revisada_en, cliente_id')
      .neq('estado', 'anulada')
      .order('created_at', { ascending: false })
    setError(err ? 'No pudimos cargar las solicitudes. Intenta de nuevo.' : null)
    setSolicitudes(data ?? [])
    setLoading(false)
  }, [habilitado])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /** Genera un enlace nuevo (anula el enviado anterior del mismo celular). */
  const crearEnlace = useCallback(
    async (celular: string, nombre: string | null): Promise<{ enlace: EnlaceCreado | null; error: string | null }> => {
      const { data, error: err } = await supabase.rpc('crear_solicitud', {
        p_celular: celular,
        ...(nombre ? { p_nombre: nombre } : {}),
      })
      const fila = data?.[0]
      if (err || !fila) {
        // Los mensajes de la RPC ya vienen en español (celular inválido, no es dueño…).
        return { enlace: null, error: err?.message ?? 'No pudimos generar el enlace. Intenta de nuevo.' }
      }
      void cargar()
      return { enlace: { ...fila, nombre_referencia: fila.nombre_referencia ?? null }, error: null }
    },
    [cargar],
  )

  return { solicitudes, loading, error, recargar: cargar, crearEnlace }
}
