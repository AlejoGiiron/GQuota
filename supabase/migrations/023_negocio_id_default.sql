-- ============================================================
--  023 — negocio_id con DEFAULT mi_negocio()
--
--  La 022 dejó negocio_id NOT NULL en clientes/prestamos/cuotas/movimientos.
--  En la Fase 1A las RPC (crear_prestamo*, registrar_pago*) y los inserts
--  directos del frontend (clientes) NO se reescriben todavía: siguen sin
--  pasar negocio_id. Para que sigan funcionando de forma transparente, el
--  valor por defecto de negocio_id es el negocio del usuario que inserta.
--
--  Por qué es seguro:
--   - TODOS los sitios que INSERTAN en estas tablas corren con contexto de
--     usuario (las RPC son SECURITY INVOKER; los inserts del front usan la
--     sesión del usuario), así que mi_negocio() resuelve a su negocio y la
--     RLS `with check (negocio_id = mi_negocio())` pasa.
--   - Las funciones de mantenimiento (devengar_intereses, marcar_mora,
--     marcar_cuotas_vencidas) son SECURITY DEFINER y corren por cron sin
--     auth.uid(), pero SOLO hacen UPDATE de filas existentes; nunca INSERT.
--     Por eso jamás evalúan este default con mi_negocio() = null.
--
--  Efecto secundario útil: en los tipos generados, negocio_id pasa a ser
--  opcional en el Insert, así que el front no necesita pasarlo aún.
-- ============================================================

alter table public.clientes    alter column negocio_id set default public.mi_negocio();
alter table public.prestamos   alter column negocio_id set default public.mi_negocio();
alter table public.cuotas      alter column negocio_id set default public.mi_negocio();
alter table public.movimientos alter column negocio_id set default public.mi_negocio();
