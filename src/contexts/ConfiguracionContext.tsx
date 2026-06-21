import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Configuracion } from '@/types/db'

/** Métodos de pago soportados por la app (catálogo maestro). */
export const METODOS_PAGO: ReadonlyArray<{ valor: string; label: string }> = [
  { valor: 'efectivo', label: 'Efectivo' },
  { valor: 'nequi', label: 'Nequi' },
  { valor: 'daviplata', label: 'Daviplata' },
  { valor: 'transferencia', label: 'Transferencia' },
]

export interface ConfiguracionInput {
  nombre_negocio: string | null
  metodos_pago: string[]
}

interface ConfiguracionContextValue {
  configuracion: Configuracion | null
  loading: boolean
  /** Nombre del negocio o 'G-Quota' si no se ha configurado. */
  nombreNegocio: string
  /** Métodos de pago activos; si no hay config, el catálogo completo. */
  metodosActivos: string[]
  guardar: (input: ConfiguracionInput) => Promise<{ error: string | null }>
  refrescar: () => Promise<void>
}

const ConfiguracionContext = createContext<ConfiguracionContextValue | undefined>(undefined)

const NOMBRE_POR_DEFECTO = 'G-Quota'

export function ConfiguracionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!user) {
      setConfiguracion(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from('configuracion').select('*').maybeSingle()
    setConfiguracion(data ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = useCallback(
    async (input: ConfiguracionInput): Promise<{ error: string | null }> => {
      if (!user) return { error: 'No hay una sesión activa.' }
      const { data, error } = await supabase
        .from('configuracion')
        .upsert({ user_id: user.id, ...input }, { onConflict: 'user_id' })
        .select()
        .single()
      if (error || !data) {
        return { error: 'No pudimos guardar la configuración. Intenta de nuevo.' }
      }
      setConfiguracion(data)
      return { error: null }
    },
    [user],
  )

  const value = useMemo<ConfiguracionContextValue>(() => {
    const metodos =
      configuracion?.metodos_pago && configuracion.metodos_pago.length > 0
        ? configuracion.metodos_pago
        : METODOS_PAGO.map((m) => m.valor)
    return {
      configuracion,
      loading,
      nombreNegocio: configuracion?.nombre_negocio?.trim() || NOMBRE_POR_DEFECTO,
      metodosActivos: metodos,
      guardar,
      refrescar: cargar,
    }
  }, [configuracion, loading, guardar, cargar])

  return <ConfiguracionContext.Provider value={value}>{children}</ConfiguracionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfiguracion(): ConfiguracionContextValue {
  const ctx = useContext(ConfiguracionContext)
  if (!ctx) throw new Error('useConfiguracion debe usarse dentro de <ConfiguracionProvider>.')
  return ctx
}
