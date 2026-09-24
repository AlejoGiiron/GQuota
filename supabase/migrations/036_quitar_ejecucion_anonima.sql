-- ============================================================
--  036 — Quitar la ejecución anónima de las funciones internas
--
--  Auditoría (2026-09-24, has_function_privilege): `anon` podía ejecutar 15
--  funciones de public. Postgres le da EXECUTE a PUBLIC a toda función nueva y
--  Supabase, además, se lo da a `anon` por privilegios por defecto; las que no
--  lo revocaron al crearse quedaron abiertas a cualquiera con la anon key.
--
--  Regla: ninguna función de la app se llama sin sesión. Aquí se quita EXECUTE
--  a PUBLIC y a `anon`, y se deja (o reafirma) solo para `authenticated` lo que
--  usan la app y las políticas RLS (que se evalúan con el rol de la sesión).
--
--  NO se toca:
--    - rls_auto_enable(): la función del event trigger `ensure_rls` (activa RLS
--      en cada tabla nueva de public). No sale de ninguna migración del repo; la
--      creó Supabase al crear el proyecto. Queda para una revisión aparte.
--    - Las de mantenimiento (devengar_intereses, marcar_mora,
--      marcar_cuotas_vencidas): ya estaban cerradas desde la 010; solo las corre
--      pg_cron como `postgres` (su dueño). Se reafirma el revoke, sin efecto.
--
--  Efecto sin sesión: la API responde "permission denied" (42501) al llamarlas,
--  y una consulta anónima a una tabla con políticas que las usan también falla
--  con 42501 en vez de devolver cero filas. Con sesión, todo sigue igual.
--  El postgres (dueño) conserva su permiso: el cron no cambia.
-- ============================================================

-- ── Helpers de las políticas RLS (SECURITY DEFINER): solo authenticated ──
revoke execute on function public.mi_negocio() from public, anon;
revoke execute on function public.mi_rol() from public, anon;
revoke execute on function public.mi_miembro_id() from public, anon;
revoke execute on function public.puedo_ver_prestamo(uuid) from public, anon;
revoke execute on function public.cliente_visible_para_cobrador(uuid) from public, anon;
grant execute on function public.mi_negocio() to authenticated;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.mi_miembro_id() to authenticated;
grant execute on function public.puedo_ver_prestamo(uuid) to authenticated;
grant execute on function public.cliente_visible_para_cobrador(uuid) to authenticated;

-- Validación de membresía que usan crear_prestamo* y asignar_cobrador (invoker).
revoke execute on function public.es_miembro_activo_del_negocio(uuid, uuid) from public, anon;
grant execute on function public.es_miembro_activo_del_negocio(uuid, uuid) to authenticated;

-- ── RPC de la app (security invoker): solo authenticated ──
revoke execute on function public.crear_prestamo(uuid, numeric, numeric, text, date, text, text, text, uuid) from public, anon;
revoke execute on function public.crear_prestamo_cuotas(uuid, numeric, numeric, text, integer, date, text, text, text, uuid) from public, anon;
revoke execute on function public.crear_prestamo_cuota_fija(uuid, numeric, text, integer, numeric, date, text, text, text, uuid) from public, anon;
revoke execute on function public.registrar_pago(uuid, numeric, text, text, numeric, numeric, numeric, numeric, numeric) from public, anon;
revoke execute on function public.registrar_pago_cuotas(uuid, numeric, text, boolean) from public, anon;
revoke execute on function public.registrar_pago_cuota_fija(uuid, numeric, text) from public, anon;
grant execute on function public.crear_prestamo(uuid, numeric, numeric, text, date, text, text, text, uuid) to authenticated;
grant execute on function public.crear_prestamo_cuotas(uuid, numeric, numeric, text, integer, date, text, text, text, uuid) to authenticated;
grant execute on function public.crear_prestamo_cuota_fija(uuid, numeric, text, integer, numeric, date, text, text, text, uuid) to authenticated;
grant execute on function public.registrar_pago(uuid, numeric, text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.registrar_pago_cuotas(uuid, numeric, text, boolean) to authenticated;
grant execute on function public.registrar_pago_cuota_fija(uuid, numeric, text) to authenticated;

-- ── Funciones puras de la 035 ──
-- ficha_config_valida: la usa el CHECK de negocios (el dueño guarda la ficha).
-- normalizar_celular_co: la usa crear_solicitud (definer, corre como postgres).
revoke execute on function public.ficha_config_valida(jsonb) from public, anon;
revoke execute on function public.normalizar_celular_co(text) from public, anon;
grant execute on function public.ficha_config_valida(jsonb) to authenticated;
grant execute on function public.normalizar_celular_co(text) to authenticated;

-- ── Mantenimiento (pg_cron como postgres): ya cerradas en la 010; se reafirma ──
revoke execute on function public.devengar_intereses() from public, anon, authenticated;
revoke execute on function public.marcar_mora() from public, anon, authenticated;
revoke execute on function public.marcar_cuotas_vencidas() from public, anon, authenticated;
