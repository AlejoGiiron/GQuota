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

## Convenciones
- Todo el texto de la interfaz en español.
- Montos siempre con fmtCOP() de src/lib/formatters.ts (formato es-CO, sin decimales: $1.000.000). No usar Intl.NumberFormat directo en la UI.
- Fechas siempre con fmtFecha() de src/lib/formatters.ts (formato dd/mm/aaaa).
- Toda consulta a Supabase filtra por el usuario autenticado; la RLS lo exige.
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
- [ ] Codeudor opcional en el préstamo (fácil; datos/relación, no toca cálculos).
- [ ] Tickets de pago por WhatsApp (fácil; reusa el comprobante + wa.me de cobros).
- [ ] Rutas de cobro: organizar a qué clientes visita cada cobrador y en qué orden. Fase propia, alcance por definir (¿fijas o por día?, ¿por zona?, ¿mapa o lista?).
- [ ] Flujo "Crear cuenta" / "Olvidé contraseña" (hoy muestran "disponible pronto"). Decisión de producto pendiente (abierto/invitación/manual).
- [ ] Cancelar/archivar préstamos desde la app (hoy no hay borrado, intencional; falta un estado 'cancelado' accesible desde la ficha, sin borrado físico).
- [ ] Recargo por mora: el modelo de cuotas y el abierto dejan el espacio reservado, pero aún no se cobra recargo. Definir con el negocio cuándo se active.
- [ ] Mora multi-mes en producto "abierto": hoy el criterio es solo el ciclo del mes en curso, no rastrea ciclos atrasados de meses anteriores.

### Calidad / UI menores
- [ ] 3 warnings de ESLint react-refresh/only-export-components (PrestamoBadges, ConfiguracionContext): inofensivos (Fast Refresh en dev). Mover constantes/hooks a archivos aparte si se quiere silenciar.
- [ ] Bundle > 500 kB en un solo chunk: dividir con manualChunks.
- [ ] Login con CSS plano lg-* (definición paralela a los primitivos .input/.btn-*). Usa los mismos tokens, pero conviene unificar con Tailwind.
- [ ] Capturar dia_cobro/frecuencia explícito en el préstamo abierto (hoy se deriva del aniversario del desembolso).

## Operación (antes de abrir a usuarios reales)
- Estado del release (2026-06-21): `main` = `develop` = origin en `b513eaf`, desplegado a producción. Sobre el release anterior agrega: frecuencia diaria de cuotas (018), el fix de la modal (footer fijo + cronograma scrollable) y el tercer tipo de préstamo `cuota_fija` (motor + esquema 019 + RPC crear 020 / pago 021). Las migraciones 011–021 están aplicadas en la base de producción (confirmado por el dueño). Próximo release: avanzar `main` con lo que entre a `develop`.
- Estado del release (2026-06-08): `main` = `develop` = origin en `72ffcc6`, desplegado a producción. `main` ya NO es la Fase 08: incluye cuotas (011–015), el codeudor (016–017) y el comprobante como imagen. Las migraciones 011–017 están aplicadas en la base de producción (confirmado por el dueño).
- [ ] Préstamos 'abierto' creados ANTES de aplicar la 015 nacieron con interes_pendiente = 0 (no se les cargó el primer periodo). Si se quieren corregir retroactivamente, UPDATE puntual (con cuidado de no pisar los que ya devengaron este mes).
- [ ] Reactivar "Confirm email" en Supabase Auth (se desactivó para pruebas).
- [ ] Programar los cron en Supabase: devengar_intereses (mensual), marcar_mora (diario), marcar_cuotas_vencidas (diario). Orden: devengo antes que moras.
- [ ] Confirmar que la URL de Vercel está en Supabase Auth > URL Configuration.
- [ ] Borrar los préstamos de prueba (quedaron en estados artificiales de tanto UPDATE manual). Crear datos limpios.

## Aprendizajes del proyecto (cómo trabajar aquí)

- NO ASUMIR, CONFIRMAR CONTRA LA BD. Varias veces un "esto debería dar X" no coincidió con lo que la base tenía: el préstamo en modo fijo que daba un "tercio" (era capital_inicial 300k, no un bug), el devengo, el interés del primer periodo. La regla: ante un número raro, mirar el dato real (information_schema, pg_proc, select directo), no teorizar. El bug casi nunca está donde la primera hipótesis dice.

- FLUJO DE MIGRACIONES Y TIPOS (CLI conectado). El CLI de Supabase está vinculado al proyecto.
  - Migraciones nuevas: aplicar con `npx supabase db push` (ya NO copiar-pegar en el SQL Editor a mano). En ORDEN; cada una asume la anterior.
  - Tras un cambio de esquema, regenerar tipos: `npx supabase gen types typescript --linked > src/types/database.types.ts`. Los alias de src/types/db.ts se actualizan solos (derivan de `Database`); no editar a mano database.types.ts ni los alias.
  - Verificar con `npm run build` (NO `tsc --noEmit`: su caché incremental puede dejar pasar errores que el build limpio sí atrapa — lección del deploy; ver abajo).

- MIGRACIONES NUEVAS, NO EDITAR LAS APLICADAS. Una migración ya aplicada no se reescribe; los cambios van en una nueva con create or replace. Mantiene la cadena íntegra.

- FUNCIONES SECURITY DEFINER → REVOKE EXECUTE. Postgres concede EXECUTE a PUBLIC por defecto, así que toda función de mantenimiento (devengo, moras) quedaría invocable por cualquier usuario vía PostgREST si no se hace `revoke execute ... from public, anon, authenticated`. Hacerlo en la misma migración que crea la función.

- tsc + npm test NO prueban las RPC/funciones SQL. Las 12 pruebas cubren el motor (TS). Toda la lógica que vive en SQL (RPC de pago, devengo, mora) solo se verifica con datos reales contra la BD. "Compila y pasa los tests" ≠ "el comportamiento es correcto".

- EL CHEQUEO REAL ES `npm run build`, NO `tsc --noEmit`. `tsc --noEmit` usa caché incremental (.tsbuildinfo) y puede pasar mientras el build de producción (`tsc -b && vite build`, lo que corre Vercel) falla. Le pasó al release de cuota_fija: un bloque `Returns` de RPC en database.types.ts quedó sin `valor_cuota` y `tsc --noEmit` lo dejó pasar, pero `tsc -b` rompió el deploy. Antes de mergear a `main` / desplegar, correr `npm run build`.

- AL CAMBIAR EL ESQUEMA, REGENERAR LOS TIPOS (no editar database.types.ts a mano). Cuando los tipos eran a mano, cada RPC que retorna `prestamos` duplicaba el shape de la fila; agregar una columna al `Row` sin tocar esos `Returns` rompía el build donde se asigna ese `data` a un `Prestamo` (le pasó a `valor_cuota` en el deploy). Ahora `gen types` produce los `Returns` correctos solos: tras un cambio de esquema, regenerar (ver el flujo arriba) en vez de tocar el archivo o los alias derivados.

- VERIFICAR CADA CASO EN UN PRÉSTAMO LIMPIO. Encadenar muchas operaciones sobre el mismo préstamo mezcla efectos y hace imposible atribuir un número a una operación. Un préstamo por caso (abono de más / solo-interés / mora), cada cifra atribuible.

- IDEMPOTENCIA SIEMPRE QUE HAYA UN JOB. Toda función de mantenimiento (devengo, moras) debe poder correrse dos veces sin duplicar/romper. Probarlo explícitamente: correr, mirar, correr otra vez, confirmar que no cambió.

- INVARIANTES COMO PRUEBA EXPLÍCITA. Ej. en cuotas: "el total solo sube (por solo-interés), nunca baja (por adelantar)". Está como test. Es la mejor red contra bugs futuros de cálculo.

- HONESTIDAD SOBRE LO QUE NO SE PUEDE. Cuando el esquema perdió el vínculo movimiento-cuota, la decisión correcta fue mostrar "—" honesto en vez de reconstruir cifras que serían falsas en algunos casos. En un sistema de plata, un dato real o un "—", nunca un número inventado que se ve bien.

- REVISAR git status ANTES DE COMMITEAR. Un `git add -A` a ciegas se llevó una vez un .docx suelto al repo. Mirar qué se está por incluir; no usar `add -A` sin revisar el estado.

- Convención del repo: ningún commit lleva trailer Co-Authored-By ni menciones a Claude.