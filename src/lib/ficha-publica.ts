/**
 * Cliente de la Edge Function ficha-publica para la página /s/:token.
 *
 * REGLA: la página pública solo habla con el backend por Edge Function. Aquí no
 * se usa el cliente de Supabase ni la anon key: fetch directo a la función
 * (pública, sin JWT) y PUT directo a las URLs firmadas de subida que ella emite.
 */
import type { DatosFicha, OrigenFicha } from '@/lib/ficha'

const URL_FUNCION = `${import.meta.env.VITE_GQUOTA_SUPABASE_URL}/functions/v1/ficha-publica`

export type FotoFicha = 'frente' | 'respaldo' | 'fachada'

export type Apertura =
  | {
      estado: 'activa'
      negocio: { nombre: string; contacto_datos: string }
      ficha: unknown
      expira_en: string
    }
  | { estado: 'no_disponible' }

export type ResultadoEnvio =
  | { estado: 'enviada'; negocio: { nombre: string; contacto_datos: string } }
  | { estado: 'invalida'; errores: Record<string, string> }
  | { estado: 'no_disponible' }

export class ErrorDeRed extends Error {}

/** Reintenta solo si la red falló (no si el servidor respondió). */
async function conReintentos<T>(f: () => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await f()
    } catch (e) {
      if (!(e instanceof TypeError) || i >= intentos) throw e instanceof TypeError ? new ErrorDeRed() : e
      await new Promise((r) => setTimeout(r, 800 * i))
    }
  }
}

async function llamar<T>(cuerpo: Record<string, unknown>, reintentar = true): Promise<T> {
  const pedir = async () => {
    const r = await fetch(URL_FUNCION, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    const datos = (await r.json().catch(() => ({}))) as T & { error?: string }
    if (r.status >= 500) throw new Error(datos.error ?? 'El servidor no respondió.')
    return datos
  }
  return reintentar ? conReintentos(pedir) : pedir().catch((e) => { throw e instanceof TypeError ? new ErrorDeRed() : e })
}

export function abrirFicha(token: string): Promise<Apertura> {
  return llamar<Apertura>({ accion: 'abrir', token })
}

/** Pide la URL firmada (con reemplazo) y sube la foto ya comprimida. */
export async function subirFoto(token: string, foto: FotoFicha, archivo: Blob, autorizaRespaldo: boolean): Promise<void> {
  const r = await llamar<{ estado: string; urls?: Partial<Record<FotoFicha, string>>; error?: string }>({
    accion: 'subir', token, fotos: [foto], autoriza_respaldo: autorizaRespaldo,
  })
  const url = r.urls?.[foto]
  if (!url) throw new Error(r.error ?? 'No se pudo preparar la subida.')
  const res = await conReintentos(() =>
    fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: archivo }),
  )
  if (!res.ok) throw new Error('No se pudo subir la foto.')
}

/** Envío final. Sin reintento automático: un reintento tras un envío que sí llegó daría "no disponible". */
export function enviarFicha(
  token: string,
  cuerpo: { autorizacion: { version: string; datos: true; respaldo: boolean }; datos: DatosFicha; origen: OrigenFicha },
): Promise<ResultadoEnvio> {
  return llamar<ResultadoEnvio>({ accion: 'enviar', token, ...cuerpo }, false)
}
