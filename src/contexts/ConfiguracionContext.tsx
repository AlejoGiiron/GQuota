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

/** Rol del miembro dentro del negocio (Fase de roles). */
export type Rol = 'dueno' | 'cobrador'

interface ConfiguracionContextValue {
  /** El negocio del usuario actual (SaaS multi-negocio), o null si no es miembro. */
  negocio: Negocio | null
  /** id del negocio actual, o null si el usuario no pertenece a ninguno. */
  negocioId: string | null
  /** Rol del usuario en su negocio, o null si no es miembro de ninguno. */
  rol: Rol | null
  /** true si el usuario es dueño (puede crear préstamos, gestionar clientes, etc.). */
  esDueno: boolean
  loading: boolean
  /** Nombre del negocio o 'G-Quota' si no se ha configurado. */
  nombreNegocio: string
  /** Métodos de pago activos; si no hay negocio, el catálogo completo. */
  metodosActivos: string[]
  guardar: (input: ConfiguracionInput) => Promise<{ error: string | null }>
  /**
   * Registro self-service: el usuario autenticado crea su negocio y queda como
   * dueño (RPC crear_mi_negocio). Refresca el contexto al terminar, así la app
   * pasa del estado "sin negocio" a su negocio vacío sin recargar.
   */
  crearNegocio: (nombre: string) => Promise<{ error: string | null }>
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
  const [rol, setRol] = useState<Rol | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!user) {
      setNegocio(null)
      setRol(null)
      setLoading(false)
      return
    }
    setLoading(true)
    // El negocio y el rol salen de tablas distintas (negocios / miembros), ambas
    // acotadas por RLS a lo del usuario; se leen en paralelo.
    // Solo la membresía ACTIVA cuenta: un miembro inactivo (quitado) no pertenece
    // a ningún negocio activo, igual que mi_negocio()/mi_rol() en la base. El
    // negocio ya viene null por RLS (id = mi_negocio()); el rol se filtra aquí.
    const [{ data: neg }, { data: miembro }] = await Promise.all([
      supabase.from('negocios').select('*').maybeSingle(),
      supabase.from('miembros').select('rol').eq('activo', true).maybeSingle(),
    ])
    setNegocio(neg ?? null)
    setRol((miembro?.rol as Rol | undefined) ?? null)
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

  const crearNegocio = useCallback(
    async (nombre: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'No hay una sesión activa.' }
      const limpio = nombre.trim()
      if (!limpio) return { error: 'Escribe el nombre de tu negocio.' }
      // La RPC valida "un usuario, un negocio" y lanza mensajes en español ya
      // listos para mostrar (ej. 'Ya perteneces a un negocio.'); se pasan tal cual.
      const { error } = await supabase.rpc('crear_mi_negocio', { p_nombre: limpio })
      if (error) {
        return { error: error.message || 'No pudimos crear tu negocio. Intenta de nuevo.' }
      }
      // Recarga negocio + rol: la app sale del estado "sin negocio".
      await cargar()
      return { error: null }
    },
    [user, cargar],
  )

  const value = useMemo<ConfiguracionContextValue>(() => {
    const metodos =
      negocio?.metodos_pago && negocio.metodos_pago.length > 0
        ? negocio.metodos_pago
        : METODOS_PAGO.map((m) => m.valor)
    return {
      negocio,
      negocioId: negocio?.id ?? null,
      rol,
      esDueno: rol === 'dueno',
      loading,
      nombreNegocio: negocio?.nombre?.trim() || NOMBRE_POR_DEFECTO,
      metodosActivos: metodos,
      guardar,
      crearNegocio,
      refrescar: cargar,
    }
  }, [negocio, rol, loading, guardar, crearNegocio, cargar])

  return <ConfiguracionContext.Provider value={value}>{children}</ConfiguracionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfiguracion(): ConfiguracionContextValue {
  const ctx = useContext(ConfiguracionContext)
  if (!ctx) throw new Error('useConfiguracion debe usarse dentro de <ConfiguracionProvider>.')
  return ctx
}
