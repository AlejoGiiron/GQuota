// ============================================================
//  Edge Function: gestionar-equipo  (Fase 4B)
//
//  El DUEÑO gestiona su equipo. Cuatro acciones en una sola función (mismo
//  guard, una sola superficie que auditar). Reusa el patrón de crear-cobrador
//  (4A): el invocador se identifica por su JWT, se verifica que es DUEÑO y se
//  opera SOLO dentro de su negocio; la service_role vive solo aquí (env).
//
//  Acciones (body.accion):
//    - 'listar'         -> [{ id, user_id, nombre, rol, email, es_yo, activo }]
//    - 'reset_password' -> { miembro_id, password }   nueva clave del cobrador
//    - 'quitar'         -> { miembro_id }              inactiva + banea
//    - 'reactivar'      -> { miembro_id }              re-activa + des-banea
//    - 'cambiar_rol'    -> { miembro_id, nuevo_rol }
//
//  INVARIANTE: un negocio SIEMPRE tiene al menos un dueño ACTIVO. No se puede
//  quitar ni degradar al último dueño activo, ni quitarse uno mismo.
//
//  ⚠️ "quitar" NO borra el usuario de Auth ni su fila en `miembros`:
//  clientes/prestamos/movimientos/cuotas tienen user_id ... references auth.users
//  on delete CASCADE, así que borrar al cobrador destruiría los pagos que
//  registró. En su lugar se marca su membresía inactiva (miembros.activo=false,
//  que mi_negocio()/mi_rol() ya excluyen -> deja de ver/poder todo) y se BANEA su
//  cuenta (no puede entrar). Reactivar revierte ambos: vuelve a ser cobrador con
//  su historial intacto, sin crear cuenta nueva.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Baneo "permanente" (no hay infinito en GoTrue): ~100 años.
const BAN_PERMANENTE = '876000h'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Miembro {
  id: string
  user_id: string
  nombre: string | null
  rol: string
  negocio_id: string
  activo: boolean
}

Deno.serve(async (req) => {
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

  // ── 1. Identificar al invocador por su JWT ────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'No autenticado.' }, 401)
  const clienteUsuario = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: invocador },
    error: errorUser,
  } = await clienteUsuario.auth.getUser()
  if (errorUser || !invocador) return json({ error: 'No autenticado.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 2. GUARD: el invocador debe ser DUEÑO de un negocio ───────────────────
  const { data: yo, error: errorYo } = await admin
    .from('miembros')
    .select('negocio_id, rol')
    .eq('user_id', invocador.id)
    .eq('activo', true)
    .maybeSingle()
  if (errorYo) return json({ error: 'No se pudo verificar tu cuenta.' }, 500)
  if (!yo || yo.rol !== 'dueno') {
    return json({ error: 'No tienes permiso para gestionar el equipo.' }, 403)
  }
  const negocioId = yo.negocio_id as string

  // ── 3. Cuerpo ─────────────────────────────────────────────────────────────
  let body: { accion?: unknown; miembro_id?: unknown; password?: unknown; nuevo_rol?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Cuerpo de la solicitud inválido.' }, 400)
  }
  const accion = typeof body.accion === 'string' ? body.accion : ''

  // Carga un miembro OBJETIVO validando que pertenece al negocio del invocador.
  // Nunca se opera sobre un miembro de otro negocio (frontera entre negocios).
  async function cargarObjetivo(): Promise<Miembro | Response> {
    const miembroId = typeof body.miembro_id === 'string' ? body.miembro_id : ''
    if (!miembroId) return json({ error: 'Falta el miembro objetivo.' }, 400)
    const { data, error } = await admin
      .from('miembros')
      .select('id, user_id, nombre, rol, negocio_id, activo')
      .eq('id', miembroId)
      .maybeSingle()
    // Error genérico tanto si no existe como si es de otro negocio: no se
    // revela la existencia ni los datos de miembros ajenos.
    if (error || !data || data.negocio_id !== negocioId) {
      return json({ error: 'Ese miembro no pertenece a tu equipo.' }, 404)
    }
    return data as Miembro
  }

  // Cuántos dueños ACTIVOS quedan en el negocio (para proteger el invariante).
  // Un dueño inactivo no cuenta: el negocio no puede quedar solo con dueños
  // baneados/desvinculados.
  async function contarDuenosActivos(): Promise<number> {
    const { count } = await admin
      .from('miembros')
      .select('id', { count: 'exact', head: true })
      .eq('negocio_id', negocioId)
      .eq('rol', 'dueno')
      .eq('activo', true)
    return count ?? 0
  }

  // ── 4. Acciones ───────────────────────────────────────────────────────────
  switch (accion) {
    case 'listar': {
      // Incluye activos e inactivos (los inactivos conservan su fila y su
      // negocio_id); el frontend separa la sección de reactivables por `activo`.
      const { data: miembros, error } = await admin
        .from('miembros')
        .select('id, user_id, nombre, rol, activo')
        .eq('negocio_id', negocioId)
      if (error) return json({ error: 'No se pudo cargar el equipo.' }, 500)

      // El email vive en auth.users (no en miembros): solo accesible con la
      // service_role, y solo se expone aquí al dueño de ESTE negocio.
      const equipo = await Promise.all(
        (miembros ?? []).map(async (m) => {
          const { data: u } = await admin.auth.admin.getUserById(m.user_id)
          return {
            id: m.id,
            user_id: m.user_id,
            nombre: m.nombre,
            rol: m.rol,
            activo: m.activo,
            email: u?.user?.email ?? null,
            es_yo: m.user_id === invocador.id,
          }
        }),
      )
      return json({ equipo }, 200)
    }

    case 'reset_password': {
      const objetivo = await cargarObjetivo()
      if (objetivo instanceof Response) return objetivo
      const password = typeof body.password === 'string' ? body.password : ''
      if (password.length < 6) {
        return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
      }
      const { error } = await admin.auth.admin.updateUserById(objetivo.user_id, { password })
      if (error) return json({ error: 'No se pudo cambiar la contraseña.' }, 500)
      return json({ ok: true }, 200)
    }

    case 'quitar': {
      const objetivo = await cargarObjetivo()
      if (objetivo instanceof Response) return objetivo
      if (objetivo.user_id === invocador.id) {
        return json({ error: 'No puedes quitarte a ti mismo.' }, 409)
      }
      if (!objetivo.activo) {
        return json({ error: 'Ese miembro ya está inactivo.' }, 409)
      }
      if (objetivo.rol === 'dueno' && (await contarDuenosActivos()) <= 1) {
        return json({ error: 'No puedes quitar al último dueño del negocio.' }, 409)
      }
      // Inactivar: conserva la fila (NO la borra) para poder reactivar luego.
      // mi_negocio()/mi_rol() excluyen activo=false, así que deja de ver/poder todo.
      const { error: errUpd } = await admin
        .from('miembros')
        .update({ activo: false })
        .eq('id', objetivo.id)
        .eq('negocio_id', negocioId)
      if (errUpd) return json({ error: 'No se pudo quitar al miembro.' }, 500)
      // Banear la cuenta para que ya no pueda entrar (sin borrar su historial).
      const { error: errBan } = await admin.auth.admin.updateUserById(objetivo.user_id, {
        ban_duration: BAN_PERMANENTE,
      })
      if (errBan) {
        // La inactivación ya surtió efecto (no ve nada del negocio); el baneo
        // es defensa adicional. Se reporta para no callar el fallo.
        return json({ error: 'Se quitó del negocio, pero no se pudo bloquear el acceso.' }, 500)
      }
      return json({ ok: true }, 200)
    }

    case 'reactivar': {
      const objetivo = await cargarObjetivo()
      if (objetivo instanceof Response) return objetivo
      if (objetivo.activo) {
        return json({ error: 'Ese miembro ya está activo.' }, 409)
      }
      // Reactivar = revertir el quitar: vuelve la membresía activa y se des-banea
      // la cuenta. Entra con su clave anterior (el dueño puede resetearla aparte).
      const { error: errUpd } = await admin
        .from('miembros')
        .update({ activo: true })
        .eq('id', objetivo.id)
        .eq('negocio_id', negocioId)
      if (errUpd) return json({ error: 'No se pudo reactivar al miembro.' }, 500)
      const { error: errUnban } = await admin.auth.admin.updateUserById(objetivo.user_id, {
        ban_duration: 'none',
      })
      if (errUnban) {
        return json({ error: 'Se reactivó, pero no se pudo restaurar el acceso.' }, 500)
      }
      return json({ ok: true }, 200)
    }

    case 'cambiar_rol': {
      const objetivo = await cargarObjetivo()
      if (objetivo instanceof Response) return objetivo
      const nuevoRol = typeof body.nuevo_rol === 'string' ? body.nuevo_rol : ''
      if (nuevoRol !== 'dueno' && nuevoRol !== 'cobrador') {
        return json({ error: 'Rol inválido.' }, 400)
      }
      if (objetivo.rol === nuevoRol) {
        return json({ error: 'El miembro ya tiene ese rol.' }, 409)
      }
      // Degradar un dueño a cobrador no puede dejar el negocio sin dueño.
      if (objetivo.rol === 'dueno' && nuevoRol === 'cobrador' && (await contarDuenosActivos()) <= 1) {
        return json({ error: 'No puedes dejar el negocio sin ningún dueño.' }, 409)
      }
      const { error } = await admin
        .from('miembros')
        .update({ rol: nuevoRol })
        .eq('id', objetivo.id)
        .eq('negocio_id', negocioId)
      if (error) return json({ error: 'No se pudo cambiar el rol.' }, 500)
      return json({ ok: true }, 200)
    }

    default:
      return json({ error: 'Acción no reconocida.' }, 400)
  }
})
