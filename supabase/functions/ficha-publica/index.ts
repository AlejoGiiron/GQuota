// ============================================================
//  Edge Function: ficha-publica  (Fase 1A · ficha de cliente por enlace)
//
//  El PROSPECTO abre el enlace /s/<token> sin cuenta. Esta función valida el
//  token y dice en qué estado está el enlace. Es pública: NO verifica JWT (el
//  prospecto no tiene sesión). Eso lo fija supabase/config.toml
//  ([functions.ficha-publica] verify_jwt = false), así que basta con:
//
//    npx supabase functions deploy ficha-publica --use-api
//
//  SEGURIDAD
//    - En la base solo existe el HASH del token (sha256). Aquí se calcula el hash
//      del token recibido y se busca con la service_role (solicitudes no tiene
//      ninguna política para anon).
//    - Respuestas: activa · vencida · usada · no_disponible. Token inexistente,
//      mal formado o anulado → "no_disponible", el MISMO mensaje: no se distingue
//      si alguna vez existió.
//    - Solo devuelve lo que la pantalla necesita: nombre del negocio, la
//      ficha_config, el nombre de referencia y la hora de vencimiento (activa);
//      el nombre del negocio (vencida) y la fecha de envío (usada). Nada más del
//      negocio ni de otras solicitudes.
//    - NUNCA registra el token ni su hash en logs.
//
//  Variables de entorno (inyectadas por Supabase Edge): SUPABASE_URL,
//  SUPABASE_SERVICE_ROLE_KEY. La service_role solo vive aquí.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

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

// Token de crear_solicitud: 32 bytes en base64url sin relleno = 43 caracteres.
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/
const NO_DISPONIBLE = { estado: 'no_disponible' } as const

async function sha256Hex(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)

  let token: unknown
  try {
    token = ((await req.json()) as { token?: unknown })?.token
  } catch {
    return json(NO_DISPONIBLE)
  }
  // Mal formado = no disponible (sin tocar la base ni decir por qué).
  if (typeof token !== 'string' || !FORMATO_TOKEN.test(token)) return json(NO_DISPONIBLE)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: solicitud, error } = await admin
    .from('solicitudes')
    .select('estado, expira_en, completada_en, nombre_referencia, negocio_id')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle()
  if (error) {
    // Sin token ni hash en el log: solo el código del error.
    console.error('ficha-publica: error al buscar la solicitud', error.code)
    return json({ error: 'No pudimos revisar el enlace. Intente de nuevo.' }, 500)
  }
  if (!solicitud || solicitud.estado === 'anulada') return json(NO_DISPONIBLE)

  const { data: negocio, error: errorNegocio } = await admin
    .from('negocios')
    .select('nombre, ficha_config')
    .eq('id', solicitud.negocio_id)
    .single()
  if (errorNegocio || !negocio) {
    console.error('ficha-publica: error al leer el negocio', errorNegocio?.code)
    return json({ error: 'No pudimos revisar el enlace. Intente de nuevo.' }, 500)
  }
  const negocioPublico = { nombre: negocio.nombre }

  // completada / aprobada / rechazada: el prospecto ya envió sus datos.
  if (solicitud.estado !== 'enviada') {
    return json({ estado: 'usada', negocio: negocioPublico, enviada_en: solicitud.completada_en })
  }
  // "Vencida" no se guarda: es enviada con expira_en ya pasado.
  if (new Date(solicitud.expira_en).getTime() <= Date.now()) {
    return json({ estado: 'vencida', negocio: negocioPublico })
  }
  return json({
    estado: 'activa',
    negocio: negocioPublico,
    ficha: negocio.ficha_config,
    nombre_referencia: solicitud.nombre_referencia,
    expira_en: solicitud.expira_en,
  })
})
