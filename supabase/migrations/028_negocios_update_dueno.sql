-- ============================================================
--  028 — Editar el negocio es solo del dueño
--
--  La 022 dejó negocios_miembro_update abierto a cualquier miembro. Con roles
--  (027), "administrar el negocio" (nombre, métodos de pago) es del dueño: el
--  cobrador NO administra el negocio. Se restringe el UPDATE de negocios a
--  mi_rol() = 'dueno' (la base; la UI ya oculta/redirige Configuración).
--  El SELECT sigue abierto al miembro (el cobrador necesita el nombre del
--  negocio y los métodos para los comprobantes y el modal de pago).
-- ============================================================

drop policy "negocios_miembro_update" on public.negocios;

create policy "negocios_update_dueno" on public.negocios
  for update using (id = public.mi_negocio() and public.mi_rol() = 'dueno')
           with check (id = public.mi_negocio() and public.mi_rol() = 'dueno');
