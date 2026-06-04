import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** Resultado normalizado de una operación de autenticación. */
export interface AuthResult {
  /** Mensaje en español listo para mostrar, o null si todo salió bien. */
  error: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** true mientras Supabase resuelve la sesión inicial (evita parpadeo). */
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Traduce los errores de Supabase Auth a mensajes en español. */
function traducirError(error: AuthError): string {
  const msg = error.message.toLowerCase()
  if (msg.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada.'
  }
  if (msg.includes('user already registered')) {
    return 'Ya existe una cuenta con ese correo.'
  }
  if (msg.includes('password should be at least')) {
    return 'La contraseña es demasiado corta.'
  }
  return 'No pudimos completar la operación. Intenta de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true

    // Sesión inicial (persistida en localStorage por supabase-js).
    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return
      setSession(data.session)
      setLoading(false)
    })

    // Mantiene la sesión sincronizada (login, logout, refresh de token).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? traducirError(error) : null }
      },
      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email, password })
        return { error: error ? traducirError(error) : null }
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }
  }, [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  }
  return ctx
}
