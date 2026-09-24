// ============================================================
//  Edge Function: ficha-publica  (ficha de cliente por enlace, fases 1A–1B)
//
//  Única puerta del prospecto (sin cuenta) al backend: la página /s/<token>
//  NUNCA toca tablas ni storage con la anon key (regla en CLAUDE.md). Es pública:
//  no verifica JWT (supabase/config.toml: [functions.ficha-publica] verify_jwt = false).
//
//  Acciones (POST { accion, token, ... }):
//    abrir   → marca del negocio (nombre, contacto para datos personales),
//              ficha_config y expira_en.
//    subir   → URLs firmadas de subida (con reemplazo) para las fotos permitidas:
//              frente siempre; respaldo solo si autorizó; fachada si la ficha la pide.
//    enviar  → valida contra ficha_config, comprueba las fotos en storage y guarda
//              todo en UN solo UPDATE condicionado a estado = 'enviada' y sin
//              vencer: un segundo envío no encuentra fila y se rechaza.
//
//  SEGURIDAD
//    - El token solo existe en el navegador del prospecto; aquí se calcula su
//      sha256 y se busca con service_role.
//    - Cualquier token que no sirva (inexistente, mal formado, anulado, vencido,
//      usado) recibe la MISMA respuesta: { estado: 'no_disponible' }.
//    - No devuelve el celular ni el nombre de referencia. No registra tokens.
//    - La foto del respaldo (con la huella) solo se acepta si se autorizó; si no,
//      se borra antes de guardar.
// ============================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { VERSIONES_AUTORIZACION, leerFicha, validarEnvio, type FichaConfig } from '../_shared/ficha.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/
const NO_DISPONIBLE = { estado: 'no_disponible' } as const
const BUCKET = 'solicitudes'
type Foto = 'frente' | 'respaldo' | 'fachada'
const FOTOS: ReadonlyArray<Foto> = ['frente', 'respaldo', 'fachada']

async function sha256Hex(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

type Vigente = {
  id: string
  negocioId: string
  expiraEn: string
  negocio: { nombre: string; contacto_datos: string }
  ficha: FichaConfig
}

/** La solicitud del token si está ENVIADA, sin vencer y el negocio tiene contacto; si no, null. */
async function vigente(admin: SupabaseClient, token: unknown): Promise<Vigente | null> {
  if (typeof token !== 'string' || !FORMATO_TOKEN.test(token)) return null
  const { data: s, error } = await admin
    .from('solicitudes')
    .select('id, negocio_id, estado, expira_en')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle()
  if (error) throw new Error(`solicitud ${error.code}`)
  if (!s || s.estado !== 'enviada' || new Date(s.expira_en).getTime() <= Date.now()) return null
  const { data: n, error: e2 } = await admin
    .from('negocios')
    .select('nombre, contacto_datos, ficha_config')
    .eq('id', s.negocio_id)
    .single()
  if (e2 || !n) throw new Error(`negocio ${e2?.code}`)
  // Sin canal para ejercer los derechos no se puede pedir la autorización.
  if (!n.contacto_datos) return null
  return {
    id: s.id,
    negocioId: s.negocio_id,
    expiraEn: s.expira_en,
    negocio: { nombre: n.nombre, contacto_datos: n.contacto_datos },
    ficha: leerFicha(n.ficha_config),
  }
}

const ruta = (v: Vigente, foto: Foto) => `${v.negocioId}/${v.id}/${foto}.jpg`

/** Fotos que la ficha permite pedir, según lo que autorizó el prospecto. */
function fotoPermitida(v: Vigente, foto: Foto, autorizaRespaldo: boolean): boolean {
  if (foto === 'frente') return true
  if (foto === 'respaldo') return autorizaRespaldo && v.ficha.campos.cedula_reverso !== 'apagado'
  return v.ficha.campos.foto_fachada !== 'apagado'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json(NO_DISPONIBLE)
  }

  try {
    const v = await vigente(admin, body.token)
    if (!v) return json(NO_DISPONIBLE)
    const accion = body.accion ?? 'abrir'

    if (accion === 'abrir') {
      return json({ estado: 'activa', negocio: v.negocio, ficha: v.ficha, expira_en: v.expiraEn })
    }

    if (accion === 'subir') {
      const autoriza = body.autoriza_respaldo === true
      const pedidas = Array.isArray(body.fotos) ? body.fotos : []
      const urls: Partial<Record<Foto, string>> = {}
      for (const f of pedidas) {
        if (!FOTOS.includes(f as Foto) || !fotoPermitida(v, f as Foto, autoriza)) {
          return json({ estado: 'rechazada', error: 'Esa foto no se puede subir.' }, 400)
        }
        // upsert: el prospecto puede repetir la foto y reemplazarla.
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(ruta(v, f as Foto), { upsert: true })
        if (error || !data) throw new Error(`url firmada ${error?.message}`)
        urls[f as Foto] = data.signedUrl
      }
      return json({ estado: 'ok', urls })
    }

    if (accion === 'enviar') {
      const aut = (body.autorizacion ?? {}) as { version?: unknown; datos?: unknown; respaldo?: unknown }
      if (typeof aut.version !== 'string' || !VERSIONES_AUTORIZACION.includes(aut.version) || aut.datos !== true) {
        return json({ estado: 'invalida', errores: { autorizacion: 'Falta la autorización de datos personales.' } }, 400)
      }
      const autorizaRespaldo = aut.respaldo === true

      // Fotos que existen de verdad en storage.
      const { data: objetos, error: errLista } = await admin.storage.from(BUCKET).list(`${v.negocioId}/${v.id}`)
      if (errLista) throw new Error(`listar ${errLista.message}`)
      const hay = new Set((objetos ?? []).map((o) => o.name.replace(/\.jpg$/, '')))

      // Respaldo sin autorización: se borra (tiene la huella) y no se guarda.
      if (hay.has('respaldo') && !fotoPermitida(v, 'respaldo', autorizaRespaldo)) {
        await admin.storage.from(BUCKET).remove([ruta(v, 'respaldo')])
        hay.delete('respaldo')
      }
      if (hay.has('fachada') && v.ficha.campos.foto_fachada === 'apagado') {
        await admin.storage.from(BUCKET).remove([ruta(v, 'fachada')])
        hay.delete('fachada')
      }
      const errores: Record<string, string> = {}
      if (!hay.has('frente')) errores.cedula_frente = 'Falta la foto de la cédula por delante.'
      if (v.ficha.campos.foto_fachada === 'obligatorio' && !hay.has('fachada')) errores.foto_fachada = 'Falta la foto de la fachada.'

      const resultado = validarEnvio(v.ficha, body.datos, body.origen, hay.has('respaldo'))
      if (!resultado.ok) Object.assign(errores, resultado.errores)
      if (Object.keys(errores).length || !resultado.ok) return json({ estado: 'invalida', errores }, 400)

      const fotos: Partial<Record<Foto, string>> = {}
      for (const f of FOTOS) if (hay.has(f)) fotos[f] = ruta(v, f)
      const ahora = new Date().toISOString()

      // Un solo UPDATE condicionado: si otra petición ya la completó (o venció), no hay fila.
      const { data: guardada, error: errGuardar } = await admin
        .from('solicitudes')
        .update({
          datos: resultado.datos,
          origen: resultado.origen,
          fotos,
          autorizacion_en: ahora,
          autorizacion_version: aut.version,
          autorizacion_respaldo: autorizaRespaldo && hay.has('respaldo'),
          estado: 'completada',
          completada_en: ahora,
        })
        .eq('id', v.id)
        .eq('estado', 'enviada')
        .gt('expira_en', ahora)
        .select('id')
        .maybeSingle()
      if (errGuardar) throw new Error(`guardar ${errGuardar.code}`)
      if (!guardada) return json(NO_DISPONIBLE)
      return json({ estado: 'enviada', negocio: v.negocio })
    }

    return json({ error: 'Acción desconocida.' }, 400)
  } catch (e) {
    // Sin token ni datos personales en el log: solo el tipo de falla.
    console.error('ficha-publica:', e instanceof Error ? e.message : 'error')
    return json({ error: 'No pudimos procesar la solicitud. Intente de nuevo.' }, 500)
  }
})
