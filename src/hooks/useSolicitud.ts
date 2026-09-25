import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Solicitud } from '@/types/db'
import type { Verificacion } from '@/lib/revision'
import type { DatosFicha } from '@/lib/ficha'

/** Columnas de la revisión (sin token_hash). */
const COLUMNAS =
  'id, telefono, nombre_referencia, estado, expira_en, created_at, completada_en, datos, origen, fotos, ' +
  'autorizacion_en, autorizacion_version, autorizacion_respaldo, verificacion, verificacion_en, ' +
  'verificacion_detalle, motivo_rechazo, revisada_en, cliente_id, fotos_borradas_en'

export type SolicitudRevision = Pick<
  Solicitud,
  | 'id' | 'telefono' | 'nombre_referencia' | 'estado' | 'expira_en' | 'created_at' | 'completada_en' | 'datos'
  | 'origen' | 'fotos' | 'autorizacion_en' | 'autorizacion_version' | 'autorizacion_respaldo' | 'verificacion'
  | 'verificacion_en' | 'verificacion_detalle' | 'motivo_rechazo' | 'revisada_en' | 'cliente_id' | 'fotos_borradas_en'
>

export type NombreFoto = 'frente' | 'respaldo' | 'fachada'
export type FotosSolicitud = Partial<Record<NombreFoto, string>>

/** Cliente con la misma cédula (aprobar_solicitud devuelve "duplicado"). */
export type ClienteExistente = { id: string; nombre: string; desde: string; prestamos: number }
export type ResultadoAprobar =
  | { resultado: 'aprobada'; cliente_id: string; vinculado: boolean }
  | { resultado: 'duplicado'; cliente: ClienteExistente }

/**
 * URL firmada de 2 minutos para ver una foto de la solicitud. Solo el dueño puede
 * firmarlas (política de storage de la migración 039); al cobrador le falla.
 */
export async function urlFoto(ruta: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('solicitudes').createSignedUrl(ruta, 120)
  return error ? null : data.signedUrl
}

/** Una solicitud para revisar, con las acciones de la fase 1C (todas por RPC). */
export function useSolicitud(id: string | undefined) {
  const [solicitud, setSolicitud] = useState<SolicitudRevision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!id) return
    const { data, error: err } = await supabase.from('solicitudes').select(COLUMNAS).eq('id', id).maybeSingle()
    if (err) setError('No pudimos cargar la solicitud.')
    else setError(null)
    setSolicitud((data as SolicitudRevision | null) ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    setLoading(true)
    void cargar()
  }, [cargar])

  const guardarVerificacion = useCallback(
    async (resultado: Verificacion, detalle: Record<string, string> | null) => {
      if (!id) return false
      const { error: err } = await supabase.rpc('guardar_verificacion', {
        p_solicitud: id,
        p_resultado: resultado,
        p_detalle: detalle ?? undefined,
      })
      if (!err) await cargar()
      return !err
    },
    [id, cargar],
  )

  const aprobar = useCallback(
    async (datos: DatosFicha, clienteExistente?: string): Promise<{ ok: ResultadoAprobar | null; error: string | null }> => {
      if (!id) return { ok: null, error: 'Falta la solicitud.' }
      const { data, error: err } = await supabase.rpc('aprobar_solicitud', {
        p_solicitud: id,
        p_datos: datos,
        p_cliente_existente: clienteExistente,
      })
      if (err) return { ok: null, error: err.message || 'No pudimos aprobar la solicitud. Intente de nuevo.' }
      return { ok: data as unknown as ResultadoAprobar, error: null }
    },
    [id],
  )

  const rechazar = useCallback(
    async (motivo: string): Promise<string | null> => {
      if (!id) return 'Falta la solicitud.'
      const { error: err } = await supabase.rpc('rechazar_solicitud', { p_solicitud: id, p_motivo: motivo })
      if (err) return err.message || 'No pudimos rechazar la solicitud. Intente de nuevo.'
      await cargar()
      return null
    },
    [id, cargar],
  )

  return { solicitud, loading, error, recargar: cargar, guardarVerificacion, aprobar, rechazar }
}
