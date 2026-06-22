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
import type { Negocio } from '@/types/db'

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
  /** El negocio del usuario actual (SaaS multi-negocio), o null si no es miembro. */
  negocio: Negocio | null
  /** id del negocio actual, o null si el usuario no pertenece a ninguno. */
  negocioId: string | null
  loading: boolean
  /** Nombre del negocio o 'G-Quota' si no se ha configurado. */
  nombreNegocio: string
  /** Métodos de pago activos; si no hay negocio, el catálogo completo. */
  metodosActivos: string[]
  guardar: (input: ConfiguracionInput) => Promise<{ error: string | null }>
  refrescar: () => Promise<void>
}

const ConfiguracionContext = createContext<ConfiguracionContextValue | undefined>(undefined)

const NOMBRE_POR_DEFECTO = 'G-Quota'

// El nombre/métodos del negocio viven ahora en la tabla `negocios` (modelo
// SaaS multi-negocio). La RLS de `negocios` solo expone el negocio del
// usuario actual (id = mi_negocio()), así que un select sin filtro devuelve
// exactamente su fila. La antigua tabla `configuracion` queda deprecada.
export function ConfiguracionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!user) {
      setNegocio(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from('negocios').select('*').maybeSingle()
    setNegocio(data ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = useCallback(
    async (input: ConfiguracionInput): Promise<{ error: string | null }> => {
      if (!user) return { error: 'No hay una sesión activa.' }
      if (!negocio) return { error: 'No tienes un negocio asignado.' }
      const { data, error } = await supabase
        .from('negocios')
        // `nombre` es NOT NULL: el nombre vacío se guarda como '' (no null),
        // que el getter nombreNegocio muestra como 'G-Quota'.
        .update({ nombre: input.nombre_negocio?.trim() ?? '', metodos_pago: input.metodos_pago })
        .eq('id', negocio.id)
        .select()
        .single()
      if (error || !data) {
        return { error: 'No pudimos guardar la configuración. Intenta de nuevo.' }
      }
      setNegocio(data)
      return { error: null }
    },
    [user, negocio],
  )

  const value = useMemo<ConfiguracionContextValue>(() => {
    const metodos =
      negocio?.metodos_pago && negocio.metodos_pago.length > 0
        ? negocio.metodos_pago
        : METODOS_PAGO.map((m) => m.valor)
    return {
      negocio,
      negocioId: negocio?.id ?? null,
      loading,
      nombreNegocio: negocio?.nombre?.trim() || NOMBRE_POR_DEFECTO,
      metodosActivos: metodos,
      guardar,
      refrescar: cargar,
    }
  }, [negocio, loading, guardar, cargar])

  return <ConfiguracionContext.Provider value={value}>{children}</ConfiguracionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfiguracion(): ConfiguracionContextValue {
  const ctx = useContext(ConfiguracionContext)
  if (!ctx) throw new Error('useConfiguracion debe usarse dentro de <ConfiguracionProvider>.')
  return ctx
}
