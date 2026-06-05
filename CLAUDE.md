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

## Design system
Antes de crear o modificar cualquier componente o pantalla, leer src/design-system.md y seguir esos patrones. No inventar colores, tipografías ni estilos nuevos. Ese archivo es la fuente de verdad visual.

## Pendientes técnicos
- [ ] (Fase 05) Regenerar src/types/database.types.ts con el CLI de Supabase.
- [ ] (Fase 08) Revisar consistencia de estilos: el login usa CSS plano (lg-*); confirmar que no divergió de los primitivos de Tailwind.
- [ ] Definir flujo de "Crear cuenta": abierto, por invitación, o cuentas creadas manualmente (hoy muestra toast de "disponible pronto").
- [ ] (Fase 08) Añadir vitest.config.ts mínimo sin el plugin de React, para silenciar warnings de esbuild/oxc al correr los tests.
- [ ] (Fase 07) Transición a 'en_mora': definir quién/cuándo marca un préstamo como vencido (job diario tipo devengo, o cálculo al vuelo). Hoy nada lo marca, así que la métrica de mora del dashboard es 0 fija.
- [ ] (Fase 07/08) Capturar dia_cobro / frecuencia en el préstamo; hoy se deriva del aniversario del desembolso.