# G-Quota — contexto del proyecto

## Descripción
G-Quota es una app web responsive para personas que prestan dinero de forma informal en Colombia. Permite llevar el control de clientes deudores, préstamos, intereses, cuotas y pagos.

## Stack
- Vite + React + TypeScript
- Tailwind CSS
- React Router
- Supabase (PostgreSQL, autenticación, Edge Functions, storage)

## Estructura
- src/components — componentes reutilizables
- src/pages — pantallas
- src/lib — clientes y lógica (supabase.ts, motor-prestamos.ts)
- src/hooks — hooks
- src/types — tipos (database.types.ts)
- supabase/migrations — esquema SQL
- supabase/functions — Edge Functions (crear-cobrador, gestionar-equipo)
- docs/traspaso.md — estado del proyecto y roadmap (leer junto con este archivo)

## Convenciones
- Todo el texto de la interfaz en español.
- Montos siempre con fmtCOP() de src/lib/formatters.ts (formato es-CO, sin decimales: $1.000.000). No usar Intl.NumberFormat directo en la UI.
- Fechas siempre con fmtFecha() de src/lib/formatters.ts (formato dd/mm/aaaa).
- Los datos pertenecen a un NEGOCIO, no a un usuario: toda consulta queda acotada al negocio del miembro autenticado (`negocio_id = mi_negocio()`) y, si es cobrador, a sus préstamos asignados; la RLS lo exige. No filtrar por `user_id`.
- Pruebas con vitest; se corren con `npm test`.
- Feedback de mutaciones con sonner: éxitos con toast.success(), errores con toast.error().
- Commits en formato Conventional Commits.

## Núcleo financiero
Los cálculos de interés y pagos viven SOLO en src/lib/motor-prestamos.ts (lógica pura, con pruebas). No dupliques fórmulas en la UI ni en las consultas: usa ese módulo.

Hay dos modos de interés: sobre saldo (interés sobre el saldo de capital vigente) y sobre capital inicial (interés fijo calculado sobre el capital desembolsado). En ambos modos el interés NO capitaliza: nunca se suma al capital ni genera interés sobre interés.

## Decisiones de arquitectura

### 2026-06-06 — Modelo de préstamos por cuotas
Al mostrar el MVP se descubrió que el negocio NO opera con "interés mensual flexible / paga cuando quiere" (supuesto original), sino con CUOTAS pactadas. Decisión: conviven DOS tipos de préstamo (campo `tipo` en prestamos):

- **abierto**: el modelo actual (interés sobre saldo, pago flexible, devengo mensual). Intacto, no se toca.
- **cuotas** (nuevo): cronograma fijo de N cuotas (semanal/quincenal/mensual). Interés plano pactado al inicio (capital × tasa mensual × meses; 4 semanas = 1 mes, quincena = ½ mes), repartido parejo; el redondeo de capital lo absorbe la última cuota. El interés pactado NO baja. Abono de más baja solo capital de cuotas siguientes (interés intacto); el total no baja. Pago de solo-interés: la cuota se da por pagada de interés y su capital se corre a una cuota nueva al final que REPITE el mismo interés (penalización); el total sube. Mora: cuota vencida + 5 días de gracia, sin recargo aún.

Implementación: el motor (src/lib/motor-prestamos.ts) NO se reescribe; se le AGREGA la lógica de cronograma de cuotas (generar + aplicar pago + solo-interés), con pruebas nuevas. Las 6 pruebas actuales siguen válidas (cubren "abierto"). Esquema: tabla `cuotas` nueva + campo `tipo` en prestamos. Como no hay datos reales en producción, se reemplaza limpio sin convivencia de datos viejos.

### 2026-09-24 — Lectura automática de la cédula (onboarding de prospectos)
Prueba técnica (sin tocar la base ni producción) para leer la cédula colombiana desde fotos de celular.

**Decisión: método A** — decodificar el PDF417 del RESPALDO con zxing (`zxing-wasm`), en el navegador del prospecto. Si no logra leer, el prospecto escribe los datos a mano y quedan marcados como **"sin verificar"** para el dueño. El método B (visión con la API de Anthropic sobre el frente) queda **descartado por ahora**: la foto completa de la cédula saldría del dispositivo hacia un tercero, tiene costo por lectura y no se llegó a medir.

**Evidencia (limitada):** 1 cédula amarilla, 2 fotos reenviadas por WhatsApp (1600 px, comprimidas). El método A decodificó el respaldo al primer intento (sin preprocesado, ~0,25 s, sin red) y leyó **6/6 campos correctos** contra la verdad: número, apellidos, nombres, sexo, fecha de nacimiento, RH. Autoprueba con códigos sintéticos: 12/12 byte a byte, pero el PDF417 NO se lee con ~8° de inclinación sin enderezar (se resolvió probando giros de ±3° a ±20°; el QR aguanta 20° solo).

**NO probado (riesgos abiertos):** fotos originales de cámara, fotos inclinadas con perspectiva, poca luz/reflejos, la **cédula digital** (se desconoce qué código trae y si sus datos vienen legibles o firmados/cifrados), y más de una cédula amarilla (las posiciones de los campos salen de UNA sola; confirmar con un solo apellido y nombres largos). Antes de dar la función por buena, probar al menos eso.

**Reglas para producción (obligatorias):**
- La lectura corre en el navegador del prospecto; la foto no sale del dispositivo. Al backend solo llegan los campos extraídos.
- `zxing-wasm` por defecto DESCARGA su `.wasm` del CDN jsDelivr (`locateFile`). Servir el `.wasm` desde nuestro dominio (asset de Vite) y pasarlo con `prepareZXingModule({ overrides: { locateFile } })` o `wasmBinary`. Verificar en la pestaña de red: cero peticiones a terceros durante la lectura.
- **Huella:** en el PDF417 de la cédula amarilla, desde el byte 169 hay un bloque binario (~360 bytes, probablemente la plantilla de la huella dactilar = dato biométrico). Parsear solo los bytes 0–168 y descartar el buffer completo en memoria: nunca se guarda, loguea ni envía.
- Formato del PDF417 amarillo (campos de ancho fijo rellenos con NUL; offset, longitud): marcador `PubDSK_1` en [24,8] (validar que esté; si no, no parsear); número [48,10] sin ceros a la izquierda; primer y segundo apellido [58,23] y [81,23]; primer y segundo nombre [104,23] y [127,23]; sexo [151,1]; fecha de nacimiento [152,8] como AAAAMMDD; RH [166,2].
- El código NO trae estatura ni fecha/lugar de expedición. El lugar de nacimiento (viene como código) NO se captura: no hace falta para el préstamo.
- Ley 1581 de 2012 (habeas data): aunque la imagen no salga del dispositivo, los datos extraídos llegan al backend; se necesita la autorización del titular para su tratamiento.

**Scripts de la prueba:** en `pruebas-cedula/` (IGNORADO por git: solo existe en el equipo donde se hizo). `metodo-a.mjs` (con `--autoprueba`), `metodo-b.mjs`, `comparar.mjs`, `convertir-verdad.mjs`, `limpiar.mjs`. Las fotos y resultados con datos personales se borraron al cerrar la prueba.

## Design system
Antes de crear o modificar cualquier componente o pantalla, leer src/design-system.md y seguir esos patrones. No inventar colores, tipografías ni estilos nuevos. Ese archivo es la fuente de verdad visual.

## Deuda técnica (post-MVP / v2)

### Arquitectura y modelo de datos
- [ ] (Opción C del cronograma) Las cuotas pierden su historia al pagarse: la RPC pone capital e interes en 0 y estado='pagada'. El monto real solo queda en `movimientos`, que NO tiene vínculo a la cuota (sin cuota_id ni numero). Arreglo de fondo: agregar numero/cuota_id a movimientos, o NO vaciar la cuota (guardar "monto pactado" aparte de "monto pagado/saldo"). Permitiría mostrar el detalle pactado por cuota y distinguir a nivel de fila una cuota pagada normal de una pagada por solo-interés. Toca esquema + RPC + motor + UI.
  - **Opción de fondo (estructurada):** columna `numero`/`cuota_id` en `movimientos` (o no vaciar la cuota). Es lo correcto a largo plazo.
  - **Opción intermedia (barata, trazabilidad legible):** que `registrar_pago_cuotas` escriba en `movimientos.nota` el/los número(s) de cuota afectados — da trazabilidad por cuota tocando solo la RPC, sin migración de esquema. Advertencia honesta: `nota` es texto libre, así que es trazabilidad para LEER, no para consultar/calcular de forma estructurada (si mañana hay que calcular algo por cuota, un texto no sirve como un `cuota_id` real). Buen puente barato; NO reemplaza la opción de fondo.
- [ ] El préstamo de cuotas no guarda `frecuencia` ni el `nCuotas` original, así que el cronograma no es reconstruible vía generarCronograma una vez hay pagos (sobre todo con solo-interés, que agrega cuotas). Considerar persistir frecuencia/nCuotas.
- [x] HECHO (2026-06-21): CLI de Supabase conectado. El proyecto está vinculado (link), se corrió el migration repair (las 21 migraciones figuran como aplicadas en el remoto del CLI) y los tipos se regeneran desde el esquema real con `gen types`. Los alias (Cliente, Prestamo, Movimiento, CuotaDB, Configuracion) se DERIVAN de `Database` en src/types/db.ts, no se escriben a mano. Flujo en "Aprendizajes".
- [ ] Doble fuente de fórmulas (deuda estructural conocida): la lógica de cálculo vive en motor-prestamos.ts (TS) y replicada en SQL en varias RPC/funciones (devengar_intereses, marcar_mora, crear_prestamo_cuotas, registrar_pago_cuotas, marcar_cuotas_vencidas). Cada una lleva comentario apuntando al motor como referencia. Si una fórmula cambia, hay que tocar ambos lados. No hay test que detecte la desincronización; vive en la disciplina.
- [ ] (prioridad media-alta) Test de integración de las RPC/funciones SQL contra una BD de prueba, comparando su resultado con el motor (motor-prestamos.ts). Es lo único que cazaría la desincronización de la doble fuente de fórmulas; hoy "vive en la disciplina" (= nadie la vigila). Es trabajo real (montar BD de prueba, sembrar datos, correr las RPC, comparar con el motor). Prioridad media-alta porque cada RPC nueva que se replica del motor aumenta la superficie donde algo puede divergir sin que nadie note, hasta que un cliente reclama.

### Funcionalidad pendiente (pedida por el negocio, aplazada)
- [ ] (prioridad ALTA al abrir el registro al público) "Olvidé contraseña": hoy muestra "disponible pronto" (src/pages/LoginPage.tsx). Un usuario que olvida la clave queda fuera sin salida (hoy el dueño sí puede resetear la de sus cobradores desde Equipo). Depende de configurar Resend (o SMTP) en Supabase Auth para enviar el correo de recuperación.
- [ ] Lectura automática de la cédula en el onboarding del prospecto (método A, ver "Decisiones de arquitectura" 2026-09-24): PDF417 del respaldo con zxing en el navegador, sin CDN, huella descartada; si falla, captura manual marcada "sin verificar". Antes de construir: probar cédula digital, fotos de cámara inclinadas y con poca luz, y más cédulas amarillas.
- [ ] Rutas de cobro: organizar a qué clientes visita cada cobrador y en qué orden. Fase propia, alcance por definir (¿fijas o por día?, ¿por zona?, ¿mapa o lista?).
- [ ] Cancelar/archivar préstamos desde la app (hoy no hay borrado, intencional; falta un estado 'cancelado' accesible desde la ficha, sin borrado físico).
- [ ] Recargo por mora: el modelo de cuotas y el abierto dejan el espacio reservado, pero aún no se cobra recargo. Definir con el negocio cuándo se active.
- [ ] Mora multi-mes en producto "abierto": hoy el criterio es solo el ciclo del mes en curso, no rastrea ciclos atrasados de meses anteriores.

### Calidad / UI menores
- [ ] 3 warnings de ESLint react-refresh/only-export-components (PrestamoBadges, ConfiguracionContext): inofensivos (Fast Refresh en dev). Mover constantes/hooks a archivos aparte si se quiere silenciar.
- [ ] Bundle > 500 kB en un solo chunk: dividir con manualChunks.
- [ ] Login con CSS plano lg-* (definición paralela a los primitivos .input/.btn-*). Usa los mismos tokens, pero conviene unificar con Tailwind.
- [ ] Capturar dia_cobro/frecuencia explícito en el préstamo abierto (hoy se deriva del aniversario del desembolso).

## Operación (antes de abrir a usuarios reales)
- Estado del release (2026-06-23, ACTUAL): `main` en `c10e735` (merge `--no-ff` de `develop`, que está en `87bec2e`; mismo árbol, verificado el 2026-09-23 con `git diff origin/develop origin/main` vacío), desplegado a producción. **Las migraciones aplicadas en producción llegan hasta la 034** (confirmado el 2026-09-23 con `supabase migration list`: Local = Remote en 001–034, sin huecos ni migraciones solo-remotas). Agrega la **Fase 5 completa (registro self-service)**: migración 034, RPC `crear_mi_negocio(nombre)` (SECURITY DEFINER, atómica: negocio + membresía de dueño; guard "un usuario, un negocio" reforzado por el UNIQUE de `miembros.user_id`; EXECUTE revocado a anon); pantallas `RegistroPage`, `SinNegocioPage` (recuperación si el signUp quedó OK pero la RPC falló) y onboarding en `InicioPage` (estado vacío que invita a crear el primer cliente/préstamo). El registro queda CERRADO en la práctica por decisión del dueño (2026-09-23): por ahora solo usa la app el cliente actual (ver Confirm email abajo). Con esto las Fases 1–5 del SaaS están en producción. Próximo release: avanzar `main` con lo que entre a `develop`.
- Estado del release (2026-06-23): `main` = `develop` = origin en `0f56d8f` (merge `--no-ff` de `develop`), desplegado a producción. **Las migraciones aplicadas en producción llegan hasta la 033** (confirmado con `db push`). Agrega la **Fase 3 completa (asignación de préstamos a cobradores)**: 3A — backend/RLS (migración 032: `prestamos.cobrador_id` → miembros NULLABLE, RPC `asignar_cobrador` para asignar/reasignar/desasignar solo-dueño, RLS por asignación con helpers SECURITY DEFINER `mi_miembro_id()`/`puedo_ver_prestamo()`/`cliente_visible_para_cobrador()`; el dueño ve todo su negocio, el cobrador solo sus préstamos asignados + cuotas/movimientos/clientes derivados; `cobrador_id` opcional en las RPC de creación); más la **migración 033** (fix: la validación de membresía corría bajo la RLS del invocador, que solo expone la fila propia de `miembros`, así que toda asignación fallaba → se encapsuló en el helper SECURITY DEFINER `es_miembro_activo_del_negocio`). 3B — UI (selector de cobrador al crear, tarjeta de asignación en la ficha, etiqueta "Cobrador: X" en la lista del dueño, vista del cobrador filtrada por RLS). La frontera por asignación se verificó con un test RLS transaccional (impersonando vía `request.jwt.claims`, con rollback): 20+ aserciones verdes. Próximo release: avanzar `main` con lo que entre a `develop`.
- Estado del release (2026-06-23): `main` = `develop` = origin en `10f2aa7` (merge `--no-ff` de `develop`), desplegado a producción. **Las migraciones aplicadas en producción llegan hasta la 031** (confirmado con `db push`). Agrega la **Fase 4 completa (equipo SaaS)** sobre el release de la 4A: 4A — el dueño crea cobradores (migración 030 `miembros.nombre` + primera Edge Function del proyecto `crear-cobrador`); 4B — gestión de equipo (Edge Function `gestionar-equipo`: listar con email vía service_role, reset de contraseña, quitar, cambiar rol) y **reactivar cobradores** (migración 031 `miembros.activo`: `quitar` = inactivar + banear sin borrar la fila, conservando historial; `mi_negocio()`/`mi_rol()` exigen `activo=true`). Decisión clave: NO se borra el usuario de Auth al quitar porque `clientes/prestamos/movimientos/cuotas` tienen `user_id … on delete cascade` (borrarlo destruiría los pagos que registró). Quedaba pendiente la verificación E2E en UI (ya hecha; ver abajo). Próximo release: avanzar `main` con lo que entre a `develop`.
- Estado del release (2026-06-22): `main` = `develop` = origin en `441ea9d` (merge `--no-ff` de `develop`), desplegado a producción. Es el primer release del paquete SaaS: estructura multi-negocio + RLS por negocio (022), default de negocio_id (023), RPC explícitas por negocio (024), validación de cliente del negocio (025), restaurar interés del primer periodo (026, regresión de la 017), roles dueño/cobrador (027-028); más la tarjeta de cronograma como imagen para compartir y los cron de mantenimiento programados (029). Las migraciones 011–029 están aplicadas en la base de producción (confirmado con `supabase migration list`: Remote llega a 028 antes de este release; la 029 se aplicó con `db push`). OJO: durante la fase SaaS la BD (única = producción) ya estaba en 028 mientras `main` seguía en `b513eaf`; este release cerró ese descuadre código↔BD. Próximo release: avanzar `main` con lo que entre a `develop`.
- Estado del release (2026-06-21): `main` = `develop` = origin en `b513eaf`, desplegado a producción. Sobre el release anterior agrega: frecuencia diaria de cuotas (018), el fix de la modal (footer fijo + cronograma scrollable) y el tercer tipo de préstamo `cuota_fija` (motor + esquema 019 + RPC crear 020 / pago 021). Las migraciones 011–021 están aplicadas en la base de producción (confirmado por el dueño). Próximo release: avanzar `main` con lo que entre a `develop`.
- Estado del release (2026-06-08): `main` = `develop` = origin en `72ffcc6`, desplegado a producción. `main` ya NO es la Fase 08: incluye cuotas (011–015), el codeudor (016–017) y el comprobante como imagen. Las migraciones 011–017 están aplicadas en la base de producción (confirmado por el dueño).
- Préstamos 'abierto' creados ANTES de aplicar la 015 nacieron con interes_pendiente = 0. Son datos de prueba: NO se corrigen, se van con la limpieza de datos de prueba (fase de infraestructura).
- Confirm email ON. Con el SMTP por defecto de Supabase (solo entrega al equipo, 2/hora) el registro queda cerrado en la práctica, que es lo que queremos por ahora. Abrir al público requiere configurar Resend/SMTP y decidir si se mantiene la confirmación. Los cobradores creados por el dueño no se ven afectados. (Decisión del dueño, 2026-09-23. Los cobradores no dependen del correo porque `crear-cobrador` usa `email_confirm: true`.)
- [x] HECHO: verificación E2E de la Fase 4 (equipo) en UI con sesiones reales (cuentas LAB, dueño + cobrador): crear cobrador, reset de clave, quitar → reactivar, cambiar rol y los guards (cobrador → 403, frontera entre negocios, último dueño activo). Confirmado por el dueño el 2026-09-23.
- [ ] Borrar el usuario de prueba sin confirmar que quedó en Auth al verificar el guard de la 4A (`test-guard-1782185579@gmail.com`).
- [x] HECHO (2026-06-22, migración 029): cron de mantenimiento programados con pg_cron, los TRES diarios (no mensual). Análisis: `devengar_intereses` está anclada al mes calendario (`ultimo_devengo < primer día del mes`) y es idempotente, así que correrla a diario solo actúa una vez por mes y se auto-corrige si un día falla el cron; `marcar_mora` y `marcar_cuotas_vencidas` también idempotentes. Horarios (pg_cron en UTC; Colombia UTC-5): devengo `0 8 * * *` (03:00 COT), marcar_mora `10 8 * * *` (03:10), marcar_cuotas_vencidas `15 8 * * *` (03:15) — devengo primero. Jobs con nombre (`*_diario`) → `cron.schedule` hace upsert, reaplicar no duplica. Verificado activo en `cron.job`. pg_cron ya estaba habilitado en el proyecto.
- [ ] Confirmar que la URL de Vercel está en Supabase Auth > URL Configuration.
- [ ] Borrar los préstamos de prueba (quedaron en estados artificiales de tanto UPDATE manual). Crear datos limpios.
- [ ] (fase de limpieza) Borrar la tabla `configuracion`, reemplazada por `negocios` desde la 022, con una migración nueva (`drop table`), regenerar tipos y quitar el alias `Configuracion` de src/types/db.ts (hoy no lo usa nadie). Solo después del backup.

## Aprendizajes del proyecto (cómo trabajar aquí)

- NO ASUMIR, CONFIRMAR CONTRA LA BD. Varias veces un "esto debería dar X" no coincidió con lo que la base tenía: el préstamo en modo fijo que daba un "tercio" (era capital_inicial 300k, no un bug), el devengo, el interés del primer periodo. La regla: ante un número raro, mirar el dato real (information_schema, pg_proc, select directo), no teorizar. El bug casi nunca está donde la primera hipótesis dice.

- FLUJO DE MIGRACIONES Y TIPOS (CLI conectado). El CLI de Supabase está vinculado al proyecto.
  - Migraciones nuevas: aplicar con `npx supabase db push` (ya NO copiar-pegar en el SQL Editor a mano). En ORDEN; cada una asume la anterior.
  - Tras un cambio de esquema, regenerar tipos: `npx supabase gen types typescript --linked > src/types/database.types.ts`. Los alias de src/types/db.ts se actualizan solos (derivan de `Database`); no editar a mano database.types.ts ni los alias.
  - Verificar con `npm run build` (NO `tsc --noEmit`: su caché incremental puede dejar pasar errores que el build limpio sí atrapa — lección del deploy; ver abajo).

- MIGRACIONES NUEVAS, NO EDITAR LAS APLICADAS. Una migración ya aplicada no se reescribe; los cambios van en una nueva con create or replace. Mantiene la cadena íntegra.

- ⚠️ crear_prestamo DEBE inicializar interes_pendiente del primer periodo (regla de la 015): interes_pendiente = round(capital_inicial * tasa_mensual) y ultimo_devengo = fecha_desembolso, en AMBOS modos. Ya se perdió una vez en la 017 al recrear la función copiando una versión vieja (regresión arreglada en la 026). Cualquier recreación futura de crear_prestamo debe conservarlo.

- FUNCIONES SECURITY DEFINER → REVOKE EXECUTE. Postgres concede EXECUTE a PUBLIC por defecto, así que toda función de mantenimiento (devengo, moras) quedaría invocable por cualquier usuario vía PostgREST si no se hace `revoke execute ... from public, anon, authenticated`. Hacerlo en la misma migración que crea la función.

- tsc + npm test NO prueban las RPC/funciones SQL. Las 21 pruebas cubren solo el motor (TS): abierto, cuotas y cuota_fija. Toda la lógica que vive en SQL (RPC de pago, devengo, mora) solo se verifica con datos reales contra la BD. "Compila y pasa los tests" ≠ "el comportamiento es correcto".

- EL CHEQUEO REAL ES `npm run build`, NO `tsc --noEmit`. `tsc --noEmit` usa caché incremental (.tsbuildinfo) y puede pasar mientras el build de producción (`tsc -b && vite build`, lo que corre Vercel) falla. Le pasó al release de cuota_fija: un bloque `Returns` de RPC en database.types.ts quedó sin `valor_cuota` y `tsc --noEmit` lo dejó pasar, pero `tsc -b` rompió el deploy. Antes de mergear a `main` / desplegar, correr `npm run build`.

- AL CAMBIAR EL ESQUEMA, REGENERAR LOS TIPOS (no editar database.types.ts a mano). Cuando los tipos eran a mano, cada RPC que retorna `prestamos` duplicaba el shape de la fila; agregar una columna al `Row` sin tocar esos `Returns` rompía el build donde se asigna ese `data` a un `Prestamo` (le pasó a `valor_cuota` en el deploy). Ahora `gen types` produce los `Returns` correctos solos: tras un cambio de esquema, regenerar (ver el flujo arriba) en vez de tocar el archivo o los alias derivados.

- VERIFICAR CADA CASO EN UN PRÉSTAMO LIMPIO. Encadenar muchas operaciones sobre el mismo préstamo mezcla efectos y hace imposible atribuir un número a una operación. Un préstamo por caso (abono de más / solo-interés / mora), cada cifra atribuible.

- IDEMPOTENCIA SIEMPRE QUE HAYA UN JOB. Toda función de mantenimiento (devengo, moras) debe poder correrse dos veces sin duplicar/romper. Probarlo explícitamente: correr, mirar, correr otra vez, confirmar que no cambió.

- INVARIANTES COMO PRUEBA EXPLÍCITA. Ej. en cuotas: "el total solo sube (por solo-interés), nunca baja (por adelantar)". Está como test. Es la mejor red contra bugs futuros de cálculo.

- HONESTIDAD SOBRE LO QUE NO SE PUEDE. Cuando el esquema perdió el vínculo movimiento-cuota, la decisión correcta fue mostrar "—" honesto en vez de reconstruir cifras que serían falsas en algunos casos. En un sistema de plata, un dato real o un "—", nunca un número inventado que se ve bien.

- REVISAR git status ANTES DE COMMITEAR. Un `git add -A` a ciegas se llevó una vez un .docx suelto al repo. Mirar qué se está por incluir; no usar `add -A` sin revisar el estado.

- Convención del repo: ningún commit lleva trailer Co-Authored-By ni menciones a Claude.