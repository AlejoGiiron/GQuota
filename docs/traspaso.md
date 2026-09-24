# G-Quota — Estado del proyecto y traspaso de contexto

**Fecha:** 23 de septiembre de 2026
**Propósito:** documento de traspaso para retomar el desarrollo desde otro equipo con Claude Code.
Resume qué es el proyecto, qué está construido, cómo se trabaja y qué sigue. Léelo completo antes
de tocar código. Al iniciar una sesión de Claude Code, arranca con:
*"Lee el CLAUDE.md y este documento de traspaso, y dime en qué estado está el código."*

---

## 1. Qué es G-Quota

App web responsive para prestamistas informales en Colombia, evolucionada a **SaaS multi-negocio**.
Cliente inicial y primer usuario real: **Luis** (prestamista). El dueño del proyecto (tú) ejecuta
prompts en Claude Code y **verifica contra la base de datos**; no codifica a mano.

**Stack:** Vite + React + TypeScript + Tailwind + Supabase (PostgreSQL, Auth, Edge Functions) +
React Router + vitest + sonner. Desplegado en **Vercel** (rama `main` = producción).

**Repo:** `gquota`. **Base Supabase (única, ref):** `khxmhavnoydgzhclzwjg`.

**Sistema visual:** dirección 2a Contable, marca blanca (ver `src/design-system.md` y `design/paquete-2a/`).
Tokens de marca por negocio (por ahora fijos: verde `#047857` + ámbar `#D97706`) y tokens de sistema
fijos (estados con ícono + palabra). Fuente IBM Plex Sans servida desde el proyecto.

---

## 2. Estado actual: SaaS completo en producción

**Fases 1 a 5 del SaaS: COMPLETAS y desplegadas en producción.** El registro está CERRADO en la
práctica por decisión (2026-09-23): por ahora solo usa la app el cliente actual (ver Confirm email).

El producto hoy hace:
- **Tres tipos de préstamo** conviviendo: `abierto` (interés sobre saldo o sobre capital inicial,
  pago flexible), `cuotas` (cuotas pactadas con interés calculado), `cuota_fija` (N cuotas de valor
  fijo, sin tasa, el interés va "inmerso").
- **Cuatro frecuencias:** diaria, semanal, quincenal, mensual.
- **Codeudor opcional** (datos sueltos) en el préstamo.
- **Comprobante de pago** como imagen (canvas) para compartir por WhatsApp.
- **Tarjeta de cronograma** como imagen (canvas, cuotas en columnas a lo ancho) para WhatsApp.
- **Multi-negocio:** cada negocio aislado por RLS (frontera hermética probada).
- **Roles** dueño/cobrador con permisos en base (RLS/RPC) y UI.
- **Gestión de equipo:** el dueño crea/gestiona cobradores (Edge Functions).
- **Asignación de préstamos a cobradores:** cada cobrador ve solo su cartera asignada.
- **Registro self-service:** un prestamista nuevo se registra y crea su negocio.

---

## 3. Arquitectura de préstamos (el corazón del dominio)

**`src/lib/motor-prestamos.ts` es la ÚNICA fuente de fórmulas en TypeScript.** Las funciones/RPC
SQL las **replican a mano** (deuda conocida: "doble fuente"; NO hay test que cace la desincronización).
Toda lógica financiera se verifica con datos reales contra la BD, no teorizando.

**Tipo `abierto`:** interés sobre saldo o fijo sobre capital inicial; pago flexible; devengo mensual.
El interés del PRIMER periodo se carga al desembolso (`interes_pendiente = round(capital*tasa)`,
`ultimo_devengo = desembolso`) en AMBOS modos.
⚠️ **REGLA CRÍTICA:** `crear_prestamo` DEBE inicializar `interes_pendiente` del primer periodo
(regla de la migración 015). Ya se perdió una vez en la 017 (una recreación de la función copió una
versión vieja) y se restauró en la 026. Cualquier recreación futura de `crear_prestamo` debe conservarlo.

**Tipo `cuotas` (pactadas):** interés plano (capital*tasa*meses; 4sem=1mes, quincena=½mes,
diaria=1/30 mes). N cuotas, separa capital/interés. Abono de más baja capital de cuotas siguientes.
Solo-interés agrega cuota al final. Última cuota absorbe el redondeo. El total solo sube, nunca baja.

**Tipo `cuota_fija`:** el prestamista pone capital + nº cuotas + valor de cuota + frecuencia. SIN tasa,
SIN %. total = N×valor, ganancia = total−capital (alerta si negativa). NO separa capital/interés.
Cada cuota guarda `abonado`; estados: pendiente / parcial / pagada. El pago llena cuotas en orden,
acepta cualquier monto, deja la última tocada en parcial. Sin solo-interés, sin recálculos.

**Mora:** cuota vencida + 5 días de gracia, sin recargo en sistema. `cuota_fija` NO tiene mora en
sistema (Luis la maneja aparte con el cliente). TODOS los recordatorios de WhatsApp llevan un aviso
preventivo fijo: "si se pasa de la fecha se cobra un valor adicional" (sin monto).

**Tests:** 21/21 en el motor TS (vitest). Cubren los tres tipos, la frecuencia diaria y los casos
de borde verificados con números. Las RPC SQL NO están cubiertas por tests (ver deuda técnica).

---

## 4. Modelo SaaS (multi-negocio)

**Concepto central:** los datos pertenecen a un **negocio**, no a un usuario. Las personas son
**miembros** de un negocio con un **rol**.

- **`negocios`**: cada negocio (nombre, métodos de pago). Aquí vive lo que antes era `configuracion`.
- **`miembros`**: `user_id` (UNIQUE — un usuario, UN negocio), `negocio_id`, `rol` (`dueno`|`cobrador`),
  `activo` (boolean), `nombre`.
- `negocio_id` en `clientes`, `prestamos`, `cuotas`, `movimientos`.
- `prestamos.cobrador_id` → `miembros` (nullable): el cobrador asignado.

**Helpers SQL (SECURITY DEFINER STABLE, evitan recursión en políticas):**
- `mi_negocio()` → negocio_id del usuario actual **activo** (null si no es miembro activo).
- `mi_rol()` → rol del usuario actual activo.
- `mi_miembro_id()` → id de miembro del usuario actual activo.
- `puedo_ver_prestamo(id)`, `cliente_visible_para_cobrador(id)`, `es_miembro_activo_del_negocio()`.

**RLS (reglas de acceso):**
- Frontera entre negocios: se ve una fila si su `negocio_id = mi_negocio()`.
- **Dueño:** ve/gestiona todo su negocio.
- **Cobrador:** ve SOLO los préstamos asignados a él (`cobrador_id = mi_miembro_id()`), y sus cuotas,
  movimientos y los clientes de esos préstamos. De un cliente compartido, solo ve SUS préstamos.
  No crea préstamos, no crea/edita clientes, no ve dashboard de ganancias (su inicio es Cobros).
- Préstamo sin asignar o asignado a cobrador inactivo → solo lo ve el dueño.
- Miembro inactivo → `mi_negocio()`/`mi_rol()` devuelven null → no ve nada + cuenta baneada.

**Roles: solo dos.** "Administrador" = dueño (mismo rol). Solo el dueño invita/gestiona equipo.

**Edge Functions (primera vez en el proyecto; usan service_role protegida por env var, NUNCA en repo):**
- `crear-cobrador`: el dueño crea un cobrador (email+contraseña). Guard: solo dueño; email duplicado
  da error genérico (no filtra otros negocios); no deja usuarios huérfanos.
- `gestionar-equipo`: listar (con email), reset de contraseña, quitar (inactiva+banea, NO borra por el
  `on delete cascade`), cambiar rol, reactivar. Guards: solo dueño, solo su negocio, invariante del
  "último dueño activo" (no se puede dejar el negocio sin dueño).

**Registro self-service:** RPC `crear_mi_negocio(nombre)` (SECURITY DEFINER) que el usuario recién
registrado llama para crear su negocio + membresía dueño (atómica, guard "un usuario un negocio").
Pantallas: `RegistroPage`, `SinNegocioPage` (recuperación si la creación falla a mitad), onboarding
en `InicioPage` (estado vacío que invita a crear el primer cliente/préstamo).
**Confirm email ON.** Con el SMTP por defecto de Supabase (solo entrega al equipo, 2/hora) el registro
queda cerrado en la práctica, que es lo que queremos por ahora. Abrir al público requiere configurar
Resend/SMTP y decidir si se mantiene la confirmación. Los cobradores creados por el dueño no se ven
afectados.

---

## 5. Migraciones (todas aplicadas en producción)

Numeradas **001–034**, todas en la base de la nube (confirmado el 2026-09-23 con
`supabase migration list` desde el equipo nuevo: Local = Remote en 001–034, sin huecos). Hitos:
- 001–010: esquema base, préstamo abierto, pagos, mora, configuración.
- 011–014: modelo de cuotas pactadas.
- 015: interés del primer periodo (abierto).
- 016–017: codeudor.
- 018: frecuencia diaria.
- 019–021: cuota fija (esquema, crear, pagar).
- 022: SaaS multi-negocio (negocios, miembros, negocio_id, mi_negocio(), RLS por negocio).
- 023: default mi_negocio() en negocio_id.
- 024: RPC explícitas por negocio.
- 025: validar que el cliente pertenece al negocio.
- 026: restaurar interés primer periodo (regresión de la 017).
- 027: roles dueño/cobrador con efecto en la base: mi_rol() + permisos en RPC y RLS (el cobrador
  registra pagos; no crea préstamos ni crea/edita clientes).
- 028: editar el negocio (nombre, métodos de pago) es solo del dueño (política UPDATE de `negocios`).
- 029: cron de mantenimiento (pg_cron).
- 030: miembros.nombre.
- 031: miembros.activo + mi_negocio()/mi_rol() exigen activo=true.
- 032: cobrador_id + RLS por asignación + RPC asignar_cobrador + helpers.
- 033: fix validación de membresía bajo SECURITY DEFINER.
- 034: RPC crear_mi_negocio (registro self-service).

**Cron activos (pg_cron, en UTC; Colombia = UTC−5):**
- `devengar_intereses_diario` — 08:00 UTC (03:00 COT) — diario (idempotente, ancla al mes calendario).
- `marcar_mora_diario` — 08:10 UTC.
- `marcar_cuotas_vencidas_diario` — 08:15 UTC.
Las funciones de mantenimiento son globales (SECURITY DEFINER, sin auth.uid(), solo UPDATE); corren
para todos los negocios en una pasada. NO usan mi_negocio() (bajo cron correría null).

---

## 6. Cómo se trabaja aquí (convenciones — IMPORTANTE)

- **NO asumir, verificar contra la BD.** Cada bug de este proyecto se cazó mirando datos reales.
- **Verificar tipos con `npm run build`** (el build real, `tsc -b && vite build`), NUNCA con
  `tsc --noEmit`: su caché incremental deja pasar errores que el build limpio sí atrapa (causó un
  deploy roto). Lección registrada.
- **CLI de Supabase conectado.** Flujo de migraciones: `npx supabase db push` (ya NO copiar-pegar en
  el SQL Editor). Tipos: `npx supabase gen types typescript --linked --schema public > src/types/database.types.ts`.
  ⚠️ **`database.types.ts` es GENERADO, nunca editar a mano.** Los alias (Cliente, Prestamo,
  Movimiento, CuotaDB, Configuracion, Negocio, Miembro) se DERIVAN de `Database` en `src/types/db.ts`.
- **Edge Functions:** `npx supabase functions deploy <nombre>`. La service_role va como env var de la
  función en Supabase, NUNCA en el repo ni en el frontend.
- **Las RPC/funciones SQL NO las cubren los tests** (21/21 son solo el motor TS). Toda lógica SQL se
  verifica con datos reales contra la BD, con sesión real por **anon key** (NUNCA service_role para
  probar RLS — bypasea la seguridad).
- **La prueba de frontera** (un negocio/cobrador no ve lo de otro, sesión real anon key) es el criterio
  central de toda fase que toca RLS. Técnica usada: test transaccional con `set local role authenticated`
  + `request.jwt.claims` + `rollback` (cero datos en prod).
- **Git:** una rama por fase (`feature/NN-...`), merge `--no-ff` a develop, `branch -d` al cerrar.
  `develop` → integración; `main` → producción (deploy en Vercel). **Ningún commit lleva trailer
  Co-Authored-By.** Revisar `git status` antes de commitear; evitar `add -A` a ciegas.
- **Idioma:** todo en español (Colombia). Sin `any`. Montos con `fmtCOP`, fechas con `fmtFecha`
  (en `src/lib/formatters.ts`). Errores con `toast.error()`.
- Migraciones nuevas, nunca editar las aplicadas. `create or replace` al recrear funciones (ojo: si se
  agregan parámetros a una RPC, es `drop + create` por la sobrecarga de PostgREST).

⚠️ **CUIDADO — una sola base:** hoy la base de pruebas ES la de producción. Cada `db push` y
`functions deploy` toca producción al instante. (Esto lo resuelve la fase de infraestructura, abajo.)

---

## 7. Estado de git y despliegue

- `main` (`c10e735`) = producción, con Fases 1–5 desplegadas. `develop` (`87bec2e`) tiene el MISMO
  contenido: `main` solo suma los merges `--no-ff` de cada release (verificado el 2026-09-23 con
  `git diff origin/develop origin/main` vacío). En el remoto solo existen `main` y `develop`.
- Migraciones 001–034 aplicadas en producción.
- El registro está CERRADO en la práctica (Confirm email ON + SMTP por defecto). Solo usa la app el
  cliente actual.
- Hay **datos de prueba mezclados en producción**: el negocio "LAB - Negocio Prueba", cobradores de
  prueba, y registros creados al probar. La RLS los aísla (Luis no los ve), pero hay que limpiarlos.
- Cuentas de prueba (negocio LAB): dueno.lab@prueba.com / cobrador.lab@prueba.com. La clave NO va en
  el repo: pedírsela al dueño.
- La verificación E2E de la Fase 4 (equipo) con sesiones reales ya se hizo.

---

## 8. Qué sigue (roadmap)

### INMEDIATO — Fase de infraestructura (PAUSADA, esperando un servidor Linux que se monta en días)
Es lo siguiente a hacer. Tres piezas, EN ESTE ORDEN:
1. **Backups automáticos:** `pg_dump` (o el CLI con Docker) programado (cron del sistema) en el
   servidor Linux. Red de seguridad antes de cualquier cambio. (El `db dump` del CLI necesita Docker,
   que falló en el Windows del dueño; por eso se hará en el Linux.)
2. **Limpieza de datos de prueba** en producción (negocio LAB, cobradores de prueba, registros de
   prueba) — SOLO después de tener el backup. Identificar el negocio de Luis con CERTEZA antes de
   borrar. El borrado respeta el orden de FK (movimientos → cuotas → prestamos → clientes → miembros
   → negocio). Los usuarios de Auth de prueba se borran aparte, incluido
   `test-guard-1782185579@gmail.com` (quedó sin confirmar al probar el guard de la 4A). Los préstamos
   'abierto' anteriores a la 015 (con `interes_pendiente = 0`) son de prueba: se borran, no se corrigen.
   En esta misma limpieza: migración nueva que borra la tabla `configuracion` (reemplazada por
   `negocios` desde la 022), regenerar tipos y quitar el alias `Configuracion` de `src/types/db.ts`.
3. **Docker + Supabase local** (`supabase start`): base de pruebas con esquema aislado, para probar
   migraciones localmente antes de `db push` a producción. Documentar el flujo local → push.

### ANTES DE ABRIR EL REGISTRO AL PÚBLICO (hoy cerrado a propósito)
- **Configurar Resend (o SMTP)** en Supabase Auth y decidir si se mantiene la confirmación de email.
- **"Olvidé contraseña"** (prioridad alta al abrir): hoy muestra "disponible pronto" (`LoginPage`);
  quien olvida la clave queda fuera. Requiere Resend/SMTP.
- **Revisar que la URL de Vercel esté en Supabase Auth → URL Configuration** (los enlaces de correo,
  el de confirmación y el de recuperación, redirigen ahí).

### DESPUÉS — Fase 6: Suscripción/cobro
El dueño dice tener la base del modelo clara, pero NO se ha diseñado a fondo. Antes de construir hay
que definir: a quién se le cobra y cuánto, unidad (plano por negocio / por cobradores / por préstamos),
prueba gratis, pasarela de pago (Colombia: Wompi/Mercado Pago/PayU/ePayco), qué pasa si no paga
(bloquear acceso sin borrar datos), ciclo (recurrente vs manual).
⚠️ **NO construir la Fase 6 antes de la infraestructura:** cobrar dinero real necesita backups y base
limpia. Es la fase que más red de seguridad requiere.

### Deuda técnica de fondo (anotada, para cuando toque)
- **Test de integración de las RPC contra la BD:** lo único que cazaría la desincronización motor TS ↔
  SQL (la "doble fuente"). La regresión del interés (017) es la prueba viviente de por qué importa.
- **`on delete cascade` por `user_id`** en clientes/prestamos/movimientos/cuotas: frágil en el modelo
  multi-negocio (por eso "quitar" cobrador inactiva+banea, no borra). Los datos financieros deberían
  depender del negocio, no del usuario que los creó. Revisar algún día.
- **Seed reproducible** de datos de prueba (para el entorno local).
- **Reactivar cobrador con mismo email:** resuelto con el flag `activo` (quitar = inactivar+banear;
  reactivar = activar+desbanear). No se pierde historial.

---

## 9. Cómo retomar en el equipo nuevo

1. Clona el repo (`https://github.com/AlejoGiiron/GQuota`, privado), `git checkout develop`, `npm install`.
2. Conecta el CLI: `npx supabase login --token <token>` (token desde el dashboard de Supabase →
   Account → Access Tokens), luego `npx supabase link --project-ref khxmhavnoydgzhclzwjg`.
3. Verifica el estado de migraciones: `npx supabase migration list` (debe dar Local=Remote hasta 034).
4. `npm run build` y `npm test` (deben dar verde / 21 pruebas) para confirmar el entorno.
5. Lee el `CLAUDE.md` del repo (contexto para Claude Code) además de este documento.
6. Retoma por la **fase de infraestructura** cuando el servidor Linux esté listo (empezando por backups).

⚠️ Recuerda: la base vinculada es PRODUCCIÓN. No apliques migraciones ni corras scripts destructivos
sin backup. No uses service_role para probar RLS. Verifica siempre contra datos reales.
