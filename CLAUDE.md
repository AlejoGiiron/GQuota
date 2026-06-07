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
- [ ] El préstamo de cuotas no guarda `frecuencia` ni el `nCuotas` original, así que el cronograma no es reconstruible vía generarCronograma una vez hay pagos (sobre todo con solo-interés, que agrega cuotas). Considerar persistir frecuencia/nCuotas.
- [ ] Conectar el CLI de Supabase: link + migration repair (las migraciones están aplicadas a mano, el historial del CLI está vacío) + regenerar database.types.ts real. Hoy los tipos están escritos a mano (riesgo de desincronización con la BD).
- [ ] Doble fuente de fórmulas (deuda estructural conocida): la lógica de cálculo vive en motor-prestamos.ts (TS) y replicada en SQL en varias RPC/funciones (devengar_intereses, marcar_mora, crear_prestamo_cuotas, registrar_pago_cuotas, marcar_cuotas_vencidas). Cada una lleva comentario apuntando al motor como referencia. Si una fórmula cambia, hay que tocar ambos lados. No hay test que detecte la desincronización; vive en la disciplina.

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
- [ ] Aplicar en Supabase, en orden, las migraciones 011–015 ANTES de avanzar `main` a producción: el código de cuotas y el fix del primer periodo las asumen (hoy `main` = MVP Fase 08, sin cuotas).
- [ ] Préstamos 'abierto' creados ANTES de aplicar la 015 nacieron con interes_pendiente = 0 (no se les cargó el primer periodo). Si se quieren corregir retroactivamente, UPDATE puntual (con cuidado de no pisar los que ya devengaron este mes).
- [ ] Reactivar "Confirm email" en Supabase Auth (se desactivó para pruebas).
- [ ] Programar los cron en Supabase: devengar_intereses (mensual), marcar_mora (diario), marcar_cuotas_vencidas (diario). Orden: devengo antes que moras.
- [ ] Confirmar que la URL de Vercel está en Supabase Auth > URL Configuration.
- [ ] Borrar los préstamos de prueba (quedaron en estados artificiales de tanto UPDATE manual). Crear datos limpios.

## Aprendizajes del proyecto (cómo trabajar aquí)

- NO ASUMIR, CONFIRMAR CONTRA LA BD. Varias veces un "esto debería dar X" no coincidió con lo que la base tenía: el préstamo en modo fijo que daba un "tercio" (era capital_inicial 300k, no un bug), el devengo, el interés del primer periodo. La regla: ante un número raro, mirar el dato real (information_schema, pg_proc, select directo), no teorizar. El bug casi nunca está donde la primera hipótesis dice.

- LAS MIGRACIONES SE APLICAN A MANO Y EL CÓDIGO LAS ASUME. Antes de probar una fase, confirmar qué migraciones están realmente aplicadas (la consulta de diagnóstico con information_schema/pg_proc). Aplicar en ORDEN estricto; cada una asume la anterior.

- MIGRACIONES NUEVAS, NO EDITAR LAS APLICADAS. Una migración ya aplicada no se reescribe; los cambios van en una nueva con create or replace. Mantiene la cadena íntegra.

- FUNCIONES SECURITY DEFINER → REVOKE EXECUTE. Postgres concede EXECUTE a PUBLIC por defecto, así que toda función de mantenimiento (devengo, moras) quedaría invocable por cualquier usuario vía PostgREST si no se hace `revoke execute ... from public, anon, authenticated`. Hacerlo en la misma migración que crea la función.

- tsc + npm test NO prueban las RPC/funciones SQL. Las 12 pruebas cubren el motor (TS). Toda la lógica que vive en SQL (RPC de pago, devengo, mora) solo se verifica con datos reales contra la BD. "Compila y pasa los tests" ≠ "el comportamiento es correcto".

- VERIFICAR CADA CASO EN UN PRÉSTAMO LIMPIO. Encadenar muchas operaciones sobre el mismo préstamo mezcla efectos y hace imposible atribuir un número a una operación. Un préstamo por caso (abono de más / solo-interés / mora), cada cifra atribuible.

- IDEMPOTENCIA SIEMPRE QUE HAYA UN JOB. Toda función de mantenimiento (devengo, moras) debe poder correrse dos veces sin duplicar/romper. Probarlo explícitamente: correr, mirar, correr otra vez, confirmar que no cambió.

- INVARIANTES COMO PRUEBA EXPLÍCITA. Ej. en cuotas: "el total solo sube (por solo-interés), nunca baja (por adelantar)". Está como test. Es la mejor red contra bugs futuros de cálculo.

- HONESTIDAD SOBRE LO QUE NO SE PUEDE. Cuando el esquema perdió el vínculo movimiento-cuota, la decisión correcta fue mostrar "—" honesto en vez de reconstruir cifras que serían falsas en algunos casos. En un sistema de plata, un dato real o un "—", nunca un número inventado que se ve bien.

- Convención del repo: ningún commit lleva trailer Co-Authored-By ni menciones a Claude.