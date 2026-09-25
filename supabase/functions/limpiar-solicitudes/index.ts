// ============================================================
//  Edge Function: limpiar-solicitudes  (ficha por enlace, fase 1C)
//
//  Borra de storage las fotos que ya no deben guardarse (Ley 1581): las de
//  enlaces vencidos o anulados sin enviar y las de solicitudes rechazadas. Storage
//  no se puede borrar por SQL: por eso existe esta función.
//
//  La llama la base con pg_net (migración 039):
//    - rechazar_solicitud → { solicitud: <id> }: al instante, solo esa.
//    - pg_cron cada noche (03:30 Colombia) → {}: todas las pendientes (reintenta
//      lo que haya fallado).
//
//  SEGURIDAD: no verifica JWT (supabase/config.toml); exige la cabecera
//  x-limpieza con la clave LIMPIEZA_SECRETO (secreto de la función, y en Vault
//  para pg_net). Nunca va al repo. Lo peor que puede hacer quien la tenga es
//  adelantar un borrado que igual iba a ocurrir.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'solicitudes'
const LOTE = 200

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

/** Comparación en tiempo constante (no revela cuántos caracteres acertó). */
function iguales(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let dif = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) dif |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return dif === 0
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const secreto = Deno.env.get('LIMPIEZA_SECRETO')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secreto || !supabaseUrl || !serviceKey) return json({ error: 'Configuración del servidor incompleta.' }, 500)
  if (!iguales(req.headers.get('x-limpieza') ?? '', secreto)) return json({ error: 'No autorizado.' }, 401)

  let body: { solicitud?: unknown }
  try {
    body = (await req.json()) as { solicitud?: unknown }
  } catch {
    body = {}
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const ahora = new Date().toISOString()

  try {
    // Solicitudes cuyas fotos sobran: rechazadas, anuladas, o enviadas y vencidas.
    let consulta = admin
      .from('solicitudes')
      .select('id, negocio_id')
      .is('fotos_borradas_en', null)
      .or(`estado.in.(rechazada,anulada),and(estado.eq.enviada,expira_en.lt."${ahora}")`)
      .limit(LOTE)
    if (body.solicitud !== undefined) {
      if (typeof body.solicitud !== 'string' || !UUID.test(body.solicitud)) return json({ error: 'Solicitud inválida.' }, 400)
      consulta = consulta.eq('id', body.solicitud)
    }
    const { data: pendientes, error } = await consulta
    if (error) throw new Error(`consulta ${error.code}`)

    let fotos = 0
    for (const s of pendientes ?? []) {
      const carpeta = `${s.negocio_id}/${s.id}`
      const { data: objetos, error: errLista } = await admin.storage.from(BUCKET).list(carpeta)
      if (errLista) throw new Error(`listar ${errLista.message}`)
      const rutas = (objetos ?? []).map((o) => `${carpeta}/${o.name}`)
      if (rutas.length) {
        const { error: errBorrar } = await admin.storage.from(BUCKET).remove(rutas)
        if (errBorrar) throw new Error(`borrar ${errBorrar.message}`)
        fotos += rutas.length
      }
      const { error: errMarcar } = await admin
        .from('solicitudes')
        .update({ fotos_borradas_en: new Date().toISOString(), fotos: null })
        .eq('id', s.id)
      if (errMarcar) throw new Error(`marcar ${errMarcar.code}`)
    }
    return json({ solicitudes: pendientes?.length ?? 0, fotos })
  } catch (e) {
    // Sin datos personales en el log: solo el tipo de falla.
    console.error('limpiar-solicitudes:', e instanceof Error ? e.message : 'error')
    return json({ error: 'No se pudo completar la limpieza.' }, 500)
  }
})
