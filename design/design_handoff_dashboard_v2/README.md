# Handoff: G-Quota — Dashboard (Inicio) · Variación V2 “Operativa del día”

## Overview
Pantalla de **Inicio / Dashboard** de G-Quota, una app web responsive para prestamistas informales en Colombia. Es lo primero que ve el prestamista al entrar y muestra el estado de su cartera priorizando **la operación del día**: los *Cobros de hoy* son el elemento protagonista, con las métricas de cartera reducidas a una franja secundaria.

Audiencia: prestamistas, a menudo no técnicos, muchas veces desde el celular. Idioma: **español (Colombia)**, tono cercano y directo. Moneda: **pesos colombianos sin decimales** (`$1.000.000`, separador de miles con punto). Cifras y montos siempre en fuente monoespaciada para que aterricen alineados.

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML/React+Babel** — prototipos que muestran el aspecto y comportamiento buscados, **no** código de producción para copiar tal cual. La tarea es **recrear este diseño en tu codebase React** usando sus patrones y librerías establecidos (componentes, sistema de estilos, routing, data layer). Si aún no hay entorno, implementa con React + tu librería de estilos preferida. Toma el HTML como fuente de verdad visual (medidas, colores, tipografía, copy) y reescríbelo idiomáticamente.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado y jerarquía son finales. Recréalo pixel-perfect. Los datos son de ejemplo (mock) — conéctalos a tu modelo real.

---

## Screens / Views

### A. Dashboard V2 — Desktop (≥ 1024px, diseñado a 1440px de ancho)

**Layout general:** dos columnas fijas.
- **Sidebar** izquierdo: ancho `248px`, fondo verde tinta `#0c1f1a`, altura completa, `padding: 26px 18px 20px`, columna flex.
- **Main** derecho: `flex: 1`, fondo `#faf9f7`, columna flex. Contiene topbar (no scrollea) + área de contenido.

**Sidebar (de arriba a abajo):**
- **Marca:** cuadro `38×38`, radio `11px`, degradado `linear-gradient(150deg,#10b981,#047857)`, letra “G” blanca 800/19px + sombra `0 4px 12px rgba(4,120,87,.35)`. A la derecha “G·Quota” 20px/800 (el “·” en `#34d399`).
- **Nav:** etiqueta “MENÚ” (11px/700, `#5e7d72`, uppercase, `letter-spacing .08em`). Ítems: `Inicio` (activo), `Clientes`, `Préstamos`, `Cobros`, `Configuración`. Cada ítem: fila flex, gap 12px, `padding 11px 12px`, radio 10px, ícono 19px + texto 14.5px/600 `#a9c4ba`. Hover: fondo `rgba(255,255,255,.05)`, texto `#e6f3ee`. **Activo:** fondo `#047857`, texto blanco, sombra `0 4px 12px rgba(4,120,87,.3)`.
- **Pie (margin-top:auto):** tarjeta de usuario, fondo `rgba(255,255,255,.04)`, radio 12px, padding 10px: avatar “MR” (40px, fondo `#1f8a5b`) + “Marcela Ríos” 13.5px/700 blanco + “Prestamista” 12px `#6f9085`.

**Topbar (`padding: 26px 34px 0`):**
- Izquierda: H1 “Hola, Marcela 👋” 25px/800; debajo “Martes, 3 de junio · Tienes **5 cobros** programados para hoy” (14px `#475a53`, “5 cobros” en `#d97706`).
- Derecha (fila, gap 12px): botón ícono **Buscar** + botón ícono **Notificaciones** (con punto ámbar `#d97706`) — ambos 42px, fondo blanco, borde `#ece8e1`, radio 12px — y botón primario **“Nuevo préstamo”** (ícono `+`).

**Botón primario:** alto 46px, `padding 0 20px`, radio 12px, fondo `#047857`, texto blanco 14.5px/700, sombra `0 6px 16px rgba(4,120,87,.28)`; hover `translateY(-1px)` + sombra `.36`.

**Contenido (`padding: 22px 34px 30px`):**
1. **Franja de métricas compacta (statbar):** tarjeta blanca única, borde `#ece8e1`, radio 14px, `--shadow-card`, fila de 4 celdas iguales separadas por borde interno `#f3f0ea`. Cada celda (`padding 14px 20px`): etiqueta con cuadrito de color 9px + nombre 12px/600 `#475a53`; valor mono 21px/700; sub 11.5px `#8b9a93`.
   - `🟩 Total prestado · $48.500.000 · 32 préstamos activos`
   - `⬛ Saldo por cobrar · $31.200.000 · en 28 clientes` (cuadrito `#3f5b50`)
   - `🟧 Ganancia del mes · $4.350.000 · intereses · junio` (valor en `#d97706`)
   - `🟥 Préstamos en mora · $6.800.000 · 5 préstamos vencidos` (valor en `#dc2626`)
2. **Grid 2 columnas** (`grid-template-columns: 1.55fr 1fr`, gap 18px, margin-top 18px):
   - **Izquierda — Panel protagonista “Cobros de hoy”** (card, radio 14px):
     - Cabecera (`padding 20px 24px`, borde inferior `#f3f0ea`): título “Cobros de hoy” 19px/800; sub “Martes, 3 de junio · 5 programados · **$1.215.000** por cobrar”. A la derecha, **progreso**: texto “**2** de 5 cobrados” 13px/700 + barra 150×8px, radio 6px, fondo `#ece8e1`, relleno al 40% con `linear-gradient(90deg,#10b981,#047857)`.
     - **5 filas grandes** (`padding 15px 24px`, gap 15px, borde superior `#f3f0ea`): avatar iniciales 46px (radio 13px) · nombre 15.5px/700 + sub “teléfono · cuota X de Y” `#8b9a93` · monto mono 15.5px/700 con “a cobrar” debajo · acción: botón fantasma **“Registrar pago”** (fondo `#ecfdf5`, texto `#036249`, ícono billete) o estado **“Cobrado ✓”** (`#036249`) para los ya pagados.
   - **Derecha — Panel “Top deudores”** (card): cabecera “Top deudores” 16px/700 + pastilla “32 activos” (`#ecfdf5`/`#036249`) + enlace “Ver todos →” (`#036249`). 5 filas: avatar 42px · nombre + “Saldo pendiente” · monto mono · **badge de estado**.

**Filas de ejemplo (Cobros de hoy):** Carlos Restrepo (310 555 1234 · Cuota 4 de 12 · $250.000), Luz Mariana Gómez (320 555 8899 · Cuota 7 de 10 · $180.000), Édinson Quintero (301 555 4521 · Cuota 2 de 8 · $420.000), Yuly Andrea Parra ($95.000 · **cobrado**), Néstor Villa ($270.000 · **cobrado**).

**Top deudores:** Jhon Fredy Lopera ($2.400.000 · al día), Sandra Milena Ortiz ($1.850.000 · por vencer), Wilson Castaño ($980.000 · vencido), Diana Restrepo ($3.200.000 · al día), Brayan Stiven Mejía ($640.000 · por vencer).

### B. Dashboard V2 — Móvil (375–430px, diseñado a 390×844)

Columna flex de altura completa: **status bar (44px)** → **header** → **body (scroll)** → **bottom nav**.
- **Header (`padding 6px 18px 14px`):** “Hola, Marcela 👋” 21px/800 (no debe partir línea) + “Martes, 3 de junio” 13px. A la derecha: botón ícono **Notificaciones** (punto ámbar) y botón ícono **Configuración** (40px). *Configuración vive aquí en móvil, no en la barra inferior.*
- **Body (`padding 2px 18px 14px`, gap 14px):**
  1. **Franja de métricas:** fila con dos partes —
     - Un carril **deslizable horizontal** (`overflow-x:auto`, scroll-snap) con 3 chips de 128px: *Prestado*, *Por cobrar*, *Ganancia* (con fade de 22px en el borde derecho como pista de scroll).
     - El chip **“En mora” fijo a la derecha** (108px, fondo `#fef2f2`, borde `#fee2e2`, valor `#dc2626` `$6.800.000` · “5 vencidos”). **Siempre visible**: es la métrica de alerta y no debe perderse de vista en pantalla pequeña.
     - Chip: card, radio 12px, etiqueta 10.5px/600 con cuadrito de color + valor mono 13.5px/700.
  2. **Panel protagonista “Cobros de hoy”** (card):
     - Cabecera (`padding 15px 16px 13px`, borde inferior): “Cobros de hoy” 17px/800 + pastilla “2 de 5” (`#ecfdf5`/`#036249`). Sub “**$1.215.000** por cobrar hoy”. Barra de progreso (flex, 8px, 40%) + “**2** de 5 cobrados”.
     - Etiqueta de sección “PENDIENTES · 3” (11px/700 uppercase `#8b9a93`).
     - **3 cobros pendientes**, cada uno en bloque (`padding 14px`, gap 12px): fila avatar 40px + nombre 14px/700 + “teléfono · cuota” + monto mono 17px (“a cobrar”), y debajo botón **“Registrar pago”** a ancho completo (alto 46px, fondo `#047857`, texto blanco 14px/700, ícono billete).
- **FAB (solo cuando aplica):** botón verde “Nuevo préstamo” flotante (alto 52px, radio 16px, sombra `0 10px 26px rgba(4,120,87,.4)`) — en V2 el alta de préstamo puede vivir en otra sección; mantener el patrón disponible.
- **Bottom nav:** fondo blanco, borde superior `#ece8e1`, `padding 9px 8px 22px`, 4 ítems iguales: **Inicio, Clientes, Préstamos, Cobros** (ícono 23px + label 11px/600). Activo en `#047857` (en esta pantalla, “Cobros”). Hit target ≥ 44px.

---

## Interactions & Behavior
Los prototipos son estáticos; comportamiento esperado en la implementación:
- **“Nuevo préstamo”** → abre el flujo de alta de préstamo (pendiente de diseñar).
- **“Registrar pago”** (fila/cobro) → abre el modal/hoja de registro de pago del préstamo de ese cliente; al confirmar, la fila pasa a estado **“Cobrado ✓”**, el contador “X de 5”, la barra de progreso y “$… por cobrar” se recalculan.
- **Fila de cliente / deudor** → navega al detalle del préstamo/cliente.
- **“Ver todos →”** → navega a la sección completa (Cobros / Préstamos).
- **Sidebar / bottom nav** → routing entre secciones; resaltar la activa.
- **Búsqueda / Notificaciones** → abrir panel correspondiente.
- **Responsive:** ≥1024px usa sidebar + main; <1024px colapsa a la versión móvil (header + bottom nav). La franja de métricas: 4 celdas en línea en desktop; en móvil, 3 deslizables + “En mora” fija.
- **Mensajes a clientes (WhatsApp), cuando se implementen:** tono **formal, de “usted”** (distinto del tono cercano de la interfaz).
- Transiciones suaves en hover (botones `translateY(-1px)`, ~120–150ms). Respetar `prefers-reduced-motion`.

## State Management
Estado/datos que la pantalla necesita:
- **Resumen de cartera:** `totalPrestado`, `saldoPorCobrar`, `gananciaMes` (intereses cobrados en el mes en curso), `montoEnMora`; conteos `prestamosActivos`, `clientesConSaldo`, `prestamosVencidos`.
- **Cobros de hoy:** lista `[{ clienteId, nombre, telefono, cuotaActual, cuotasTotales, montoCuota, pagado:boolean }]`. Derivados: `totalDelDia = Σ montoCuota`, `cobrados = count(pagado)`, `programados = length`, `pct = cobrados/programados`.
- **Top deudores:** lista `[{ clienteId, nombre, saldo, estado: 'aldia'|'porvenc'|'vencido' }]` ordenada por saldo desc.
- **Usuario:** `nombre` (para el saludo) y rol.
- Acción `registrarPago(prestamoId, monto)` que muta el cobro a `pagado` y refresca el resumen.

## Design Tokens
La lista completa (colores hex, tipografía desktop/móvil, spacing, radios, sombras) está en **`design-tokens.md`** dentro de este paquete — formato Markdown listo para pegar en tu `design-system.md`. Resumen:
- **Color:** primario `#047857`; tinta sidebar `#0c1f1a`; fondo `#faf9f7`; card `#ffffff`; bordes `#ece8e1` / `#f3f0ea`; acento ámbar `#d97706`; alerta rojo `#dc2626`. Texto `#16241f` / `#475a53` / `#8b9a93`. Tintes: verde `#ecfdf5`/`#d1fae5`, ámbar `#fef3e2`, rojo `#fef2f2`/`#fee2e2`.
- **Tipografía:** **Plus Jakarta Sans** (UI, 400–800) y **JetBrains Mono** (cifras, `tnum`, `letter-spacing -.02em`). Escalas en `design-tokens.md`.
- **Radios:** 9–11px (chips/avatares), 12px (botones), 14px (cards), 16–18px (FAB/grandes).
- **Sombras:** card `0 1px 2px rgba(12,31,26,.04), 0 4px 14px rgba(12,31,26,.05)`; primario `0 6px 16px rgba(4,120,87,.28)`.
- **Spacing:** gap entre cards 18px; padding card 20px; padding contenido desktop `22px 34px 30px`; márgenes móvil 18px.

## Assets
- **Fuentes:** Google Fonts — Plus Jakarta Sans + JetBrains Mono (import en `gquota.css`). En producción, autoaloja o usa tu pipeline de fuentes.
- **Iconos:** SVG inline de trazo (1.9px), definidos en `gq-common.jsx` (objeto `I`): home, users, loan, cash, gear, plus, bell, search, arrow, check, wallet, clock, alert, phone. Reemplázalos por tu set de íconos (p. ej. Lucide) manteniendo el peso de trazo.
- **Avatares:** iniciales sobre color sólido (sin fotos). Paleta rotativa en `gquota.css` (`.av-1`…`.av-8`).
- **Sin imágenes raster.** El único emoji es 👋 en el saludo (opcional).

## Files
En este paquete (`design_handoff_dashboard_v2/`):
- `Dashboard V2.html` — referencia ejecutable: V2 desktop + móvil a tamaño real.
- `gquota.css` — tokens (`:root`) y todas las clases de estilo (desktop `.gq-*` y móvil `.gqm-*`).
- `gq-common.jsx` — `cop()` (formato COP), iconos `I`, `Avatar`, `Badge`, datos de ejemplo (`COBROS_HOY`, `DEUDORES`, `NAV`), `Sidebar`, `Topbar`, `BottomNav`, `StatusBar`.
- `gq-desktop.jsx` — `DashboardV2` (y `MetricCard`, `StatBar`, `CobroRow`, `DeudorRow`, `PanelHead`). *(También incluye `DashboardV1`, descartado — ignóralo.)*
- `gq-mobile.jsx` — `MobileV2` (y `MHeader`, `MStat`). *(También `MobileV1`, descartado.)*
- `design-tokens.md` — tokens completos para tu design-system.

> Nota: V1 (“Panorámica de cartera”) fue una variación alternativa **no elegida**. La aprobada es **V2**. Implementa solo V2.
