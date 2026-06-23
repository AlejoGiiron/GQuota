import { useCallback, useEffect, useMemo, useState } from 'react'
import { invocarEdge } from '@/lib/edge'
import type { Rol } from '@/contexts/ConfiguracionContext'

/** Un miembro del negocio, tal como lo devuelve la Edge Function gestionar-equipo. */
export interface MiembroEquipo {
  /** id de la fila en `miembros` (= prestamos.cobrador_id). */
  id: string
  user_id: string
  nombre: string | null
  rol: Rol
  email: string | null
  es_yo: boolean
  activo: boolean
}

/**
 * Lista los miembros del negocio (vía la Edge Function gestionar-equipo, que usa
 * la service_role). Es solo-dueño: la función rechaza a un cobrador con 403, así
 * que solo se invoca cuando `habilitado` (típicamente esDueno). Sirve para el
 * selector de cobradores al asignar préstamos y para mostrar quién cobra qué.
 */
export function useEquipo(habilitado: boolean) {
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([])
  const [loading, setLoading] = useState(habilitado)

  const cargar = useCallback(async () => {
    if (!habilitado) {
      setMiembros([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await invocarEdge<{ equipo: MiembroEquipo[] }>('gestionar-equipo', {
      accion: 'listar',
    })
    setMiembros(error || !data ? [] : data.equipo)
    setLoading(false)
  }, [habilitado])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /** Cobradores ACTIVOS, para asignar (un préstamo solo se asigna a un activo). */
  const cobradoresActivos = useMemo(
    () => miembros.filter((m) => m.rol === 'cobrador' && m.activo),
    [miembros],
  )

  /** Mapa id→miembro de TODOS (incluye inactivos), para resolver el nombre del
   *  cobrador asignado aunque luego se haya inactivado. */
  const miembroPorId = useMemo(
    () => new Map<string, MiembroEquipo>(miembros.map((m) => [m.id, m])),
    [miembros],
  )

  return { miembros, cobradoresActivos, miembroPorId, loading, recargar: cargar }
}
