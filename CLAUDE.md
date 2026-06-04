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
- Montos siempre con Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).
- Toda consulta a Supabase filtra por el usuario autenticado; la RLS lo exige.
- Commits en formato Conventional Commits.

## Núcleo financiero
Los cálculos de interés y pagos viven SOLO en src/lib/motor-prestamos.ts (lógica pura, con pruebas). No dupliques fórmulas en la UI ni en las consultas: usa ese módulo.

## Design system
Antes de crear o modificar cualquier componente o pantalla, leer src/design-system.md y seguir esos patrones. No inventar colores, tipografías ni estilos nuevos. Ese archivo es la fuente de verdad visual.