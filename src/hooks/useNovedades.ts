import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { VERSION_NOVEDADES, mananaTemprano, type FilaNovedad } from '@/lib/novedades'

/**
 * La guía de novedades del usuario actual (tabla novedades_usuario; la RLS solo
 * devuelve su propia fila). `fila` null = no le corresponde ninguna guía: no se
 * abre sola ni aparece "Novedades" en el menú.
 */
export function useNovedades() {
  const { user } = useAuth()
  const [fila, setFila] = useState<FilaNovedad | null>(null)
  const [cargada, setCargada] = useState(false)

  useEffect(() => {
    let vigente = true
    setFila(null)
    setCargada(false)
    if (!user) return
    void supabase
      .from('novedades_usuario')
      .select('version, estado, mostrar_desde')
      .eq('version', VERSION_NOVEDADES)
      .maybeSingle()
      .then(({ data }) => {
        if (!vigente) return
        // Si falla la lectura, la guía simplemente no aparece: no bloquea la app.
        setFila(data ?? null)
        setCargada(true)
      })
    return () => {
      vigente = false
    }
  }, [user])

  const guardar = useCallback(
    async (cambios: Partial<Pick<FilaNovedad, 'estado' | 'mostrar_desde'>>) => {
      if (!user || !fila) return
      setFila({ ...fila, ...cambios })
      const { error } = await supabase
        .from('novedades_usuario')
        .update(cambios)
        .eq('user_id', user.id)
        .eq('version', VERSION_NOVEDADES)
      if (error) toast.error('No pudimos guardar que vio las novedades. Se lo mostraremos otra vez.')
    },
    [user, fila],
  )

  /** "Entendido": no vuelve a abrirse sola en ningún celular. */
  const marcarVista = useCallback(() => guardar({ estado: 'vista' }), [guardar])

  /** "Ver después": vuelve a abrirse sola mañana. Si ya estaba vista, no cambia nada. */
  const verDespues = useCallback(() => {
    if (fila?.estado !== 'pendiente') return
    return guardar({ mostrar_desde: mananaTemprano(new Date()).toISOString() })
  }, [fila, guardar])

  return { fila, cargada, pendiente: fila?.estado === 'pendiente', marcarVista, verDespues }
}
