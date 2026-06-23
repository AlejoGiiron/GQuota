// ============================================================
//  Edge Function: crear-cobrador  (Fase 4A)
//
//  El DUEÑO de un negocio crea un cobrador dándole nombre, email y contraseña
//  inicial (Opción B: sin invitación por email). Crear un usuario en Auth exige
//  la service_role, que NUNCA puede vivir en el frontend; por eso esta lógica
//  corre aquí, en el servidor, con la llave protegida.
//
//  SEGURIDAD (lo único en lo que se confía del cliente es el JWT):
//    1. Se identifica a quien INVOCA con su JWT (auth.getUser). No se confía en
//       ningún negocio_id ni rol que mande el frontend.
//    2. Se deriva su negocio y su rol leyendo `miembros` con la service_role
//       (misma lógica que mi_negocio()/mi_rol()). Si no es 'dueno' -> 403.
//    3. El cobrador se crea en el negocio del DUEÑO (no en uno que él elija).
//    4. Email duplicado -> error genérico, sin revelar a qué negocio pertenece
//       (no se filtran datos de otros negocios).
//
//  Variables de entorno (inyectadas por la plataforma de Supabase Edge):
//    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//    La service_role solo vive aquí; jamás en el repo ni en el frontend.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Preflight CORS (el navegador lo manda antes del POST real).
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Configuración del servidor incompleta.' }, 500)
  }

  // ── 1. Identificar a quien invoca por su JWT ──────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'No autenticado.' }, 401)
  }
  // Cliente con el JWT del que llama: getUser valida la firma del token.
  const clienteUsuario = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: invocador },
    error: errorUser,
  } = await clienteUsuario.auth.getUser()
  if (errorUser || !invocador) {
    return json({ error: 'No autenticado.' }, 401)
  }

  // Cliente admin (service_role): bypassa RLS para la verificación y el alta.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 2. GUARD: el invocador debe ser DUEÑO de un negocio ───────────────────
  // Misma lógica que mi_negocio()/mi_rol(): su fila en `miembros`.
  const { data: miembro, error: errorMiembro } = await admin
    .from('miembros')
    .select('negocio_id, rol')
    .eq('user_id', invocador.id)
    .maybeSingle()
  if (errorMiembro) {
    return json({ error: 'No se pudo verificar tu cuenta.' }, 500)
  }
  if (!miembro || miembro.rol !== 'dueno') {
    return json({ error: 'No tienes permiso para agregar cobradores.' }, 403)
  }
  const negocioId = miembro.negocio_id as string

  // ── 3. Validar el cuerpo ──────────────────────────────────────────────────
  let body: { nombre?: unknown; email?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Cuerpo de la solicitud inválido.' }, 400)
  }
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!nombre) {
    return json({ error: 'El nombre es obligatorio.' }, 400)
  }
  if (!email || !email.includes('@')) {
    return json({ error: 'El correo no es válido.' }, 400)
  }
  if (password.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
  }

  // ── 4. Crear el usuario en Auth (email confirmado, contraseña dada) ────────
  // Si el email ya existe, createUser falla: se devuelve un error GENÉRICO, sin
  // revelar nada del otro negocio (no se consulta a qué negocio pertenece).
  const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (errorCrear || !creado?.user) {
    return json({ error: 'Ese correo no está disponible.' }, 409)
  }
  const nuevoUserId = creado.user.id

  // ── 5. Crear su fila en `miembros` (negocio del dueño, rol cobrador) ───────
  // Atómico en lo posible: si esto falla, se elimina el usuario de Auth para no
  // dejar una cuenta huérfana sin membresía.
  const { error: errorInsert } = await admin.from('miembros').insert({
    negocio_id: negocioId,
    user_id: nuevoUserId,
    rol: 'cobrador',
    nombre,
  })
  if (errorInsert) {
    await admin.auth.admin.deleteUser(nuevoUserId)
    return json({ error: 'No se pudo crear el cobrador. Intenta de nuevo.' }, 500)
  }

  return json({ ok: true }, 201)
})
