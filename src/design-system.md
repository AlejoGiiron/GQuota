# G-Quota — Guía de diseño (design-system.md)

> Esta guía es la **dirección inicial** del proyecto. Una vez Claude Design genere las pantallas, extrae los tokens reales (colores y medidas exactas) de su código y actualiza este archivo para que sea 100% fiel. A partir de ahí, este archivo **manda**: ningún componente nuevo inventa estilos.

G-Quota es una app de dinero usada por prestamistas, muchas veces personas no técnicas y desde el celular. Las dos prioridades visuales son: **confianza** (se ve serio y ordenado) y **legibilidad de las cifras** (los montos se leen en un vistazo).

## Colores

- **Sidebar / superficie oscura:** verde tinta muy oscuro `#0c1f1a`
- **Fondo principal:** blanco hueso `#faf9f7`
- **Tarjetas:** blanco `#ffffff`
- **Primario (acción):** verde esmeralda `#047857` · hover `#065f46`
- **Acento (valor/dinero destacado):** ámbar `#d97706` — usar con moderación
- **Texto principal:** `#1c2b27`
- **Texto secundario:** `#6b7770`
- **Bordes:** `#e7e5e0`
- **Estados:** activo/al día verde `#16a34a` · en mora (por vencer) ámbar `#d97706` · vencido rojo `#dc2626` · pagado/inactivo gris `#9ca3af`

## Tipografía

- **Interfaz:** Plus Jakarta Sans
- **Montos y cifras:** JetBrains Mono (tabular, para que las columnas de dinero alineen)
- **Pesos:** títulos 600–700, cuerpo 400–500

## Componentes establecidos

- **Tarjeta de préstamo:** nombre del cliente, saldo en mono grande, badge del modo de interés (Sobre saldo / Fijo), badge de estado con color, y el próximo cobro.
- **Sidebar:** fondo verde tinta, items en gris claro; activo en blanco con fondo translúcido y borde de acento.
- **Botón primario:** verde esmeralda, texto blanco, `rounded-lg`, hover más oscuro.
- **Botón secundario:** borde gris, fondo blanco. **Destructivo:** rojo.
- **Inputs:** borde gris, `focus` con ring verde. Los inputs de dinero van alineados a la derecha y en mono.
- **Modales:** fondo blanco, header con título en bold, footer con botones alineados a la derecha.
- **Badges de estado:** verde (al día), ámbar (por vencer), rojo (vencido), gris (pagado).
- **Ledger de movimientos:** tabla con fecha, tipo, interés, capital y saldo; las cifras en mono alineadas a la derecha.

## Patrones de layout

- **Lista + detalle:** 60/40 en desktop; apilado en móvil.
- **Dashboard:** grid responsive de tarjetas de métricas.
- **Móvil:** navegación inferior (Inicio, Clientes, Préstamos, Cobros) con objetivos táctiles grandes.
- **Spacing:** padding interno de tarjetas `p-4`/`p-5`, `gap-4` entre tarjetas, grids de 3 columnas en desktop.

## Patrones de UX

- **Dinero siempre** con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })` → `$1.000.000`.
- **Todo el texto en español.** Fechas en formato local `dd/mm/aaaa`.
- **Estados obligatorios** en cualquier vista con datos: skeleton al cargar, estado vacío con botón de acción, error con mensaje claro.
- **Confirmación** antes de eliminar o cancelar. **Toast** de éxito/error tras cada mutación.
- Al crear un préstamo, **mostrar siempre la tasa efectiva anual equivalente** y alertar si supera el tope de usura configurado.
- **Cifras grandes y legibles**: la app se usa a veces en la calle, desde el celular.
