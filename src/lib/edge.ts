import { supabase } from '@/lib/supabase'

/**
 * Invoca una Edge Function y normaliza el error a un mensaje en español ya listo
 * para mostrar. Las funciones del proyecto (crear-cobrador, gestionar-equipo)
 * devuelven { error } con un texto seguro (genérico, sin filtrar datos entre
 * negocios); para respuestas no-2xx supabase-js entrega un FunctionsHttpError
 * cuyo cuerpo está en error.context. Aquí se extrae ese mensaje.
 */
export async function invocarEdge<T>(
  nombre: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(nombre, { body })
  if (error) {
    let mensaje = 'No pudimos completar la operación. Intenta de nuevo.'
    const contexto = (error as { context?: Response }).context
    if (contexto && typeof contexto.json === 'function') {
      try {
        const cuerpo = (await contexto.json()) as { error?: string }
        if (cuerpo?.error) mensaje = cuerpo.error
      } catch {
        // Sin cuerpo JSON: queda el mensaje genérico.
      }
    }
    return { data: null, error: mensaje }
  }
  // La función puede responder 200 con { error } (caso de negocio controlado).
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    return { data: null, error: (data as { error: string }).error }
  }
  return { data: (data as T) ?? null, error: null }
}
