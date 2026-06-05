import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Cliente } from '@/types/database.types'

/** Campos editables de un cliente (lo que captura el formulario). */
export interface ClienteInput {
  nombre: string
  documento: string | null
  telefono: string | null
  direccion: string | null
  notas: string | null
}

export interface MutacionResultado {
  data: Cliente | null
  error: string | null
}

function ordenarPorNombre(lista: Cliente[]): Cliente[] {
  return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

/**
 * Acceso a la tabla `clientes`. La RLS garantiza que cada usuario solo ve y
 * opera sus propias filas; las mutaciones fijan el user_id de la sesión.
 */
export function useClientes() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('clientes').select('*')
    if (error) {
      setError('No pudimos cargar los clientes. Intenta de nuevo.')
      setClientes([])
    } else {
      setClientes(ordenarPorNombre(data ?? []))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const crear = useCallback(
    async (input: ClienteInput): Promise<MutacionResultado> => {
      if (!user) return { data: null, error: 'No hay una sesión activa.' }
      const { data, error } = await supabase
        .from('clientes')
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error || !data) {
        return { data: null, error: 'No pudimos crear el cliente. Intenta de nuevo.' }
      }
      setClientes((prev) => ordenarPorNombre([...prev, data]))
      return { data, error: null }
    },
    [user],
  )

  const actualizar = useCallback(
    async (id: string, input: ClienteInput): Promise<MutacionResultado> => {
      const { data, error } = await supabase
        .from('clientes')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error || !data) {
        return { data: null, error: 'No pudimos guardar los cambios. Intenta de nuevo.' }
      }
      setClientes((prev) => ordenarPorNombre(prev.map((c) => (c.id === id ? data : c))))
      return { data, error: null }
    },
    [],
  )

  const eliminar = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) {
      return { error: 'No pudimos eliminar el cliente. Intenta de nuevo.' }
    }
    setClientes((prev) => prev.filter((c) => c.id !== id))
    return { error: null }
  }, [])

  return { clientes, loading, error, crear, actualizar, eliminar, recargar: cargar }
}
