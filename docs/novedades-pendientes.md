# Novedades para los usuarios

Registro de los cambios que un usuario de la app puede notar. Cada cambio se anota aquí apenas entra a `main`. Los arreglos internos que nadie nota no van.

Cuando haya suficientes entradas pendientes, o cuando el dueño del proyecto lo pida, se propone la guía de novedades siguiente con ellas. Usa el mismo mecanismo de la v1: una versión nueva que queda pendiente para los usuarios existentes. Al publicar la guía, sus entradas pasan a "Publicadas". La regla completa está en `CLAUDE.md`, sección "Novedades para los usuarios".

Cada entrada lleva:
- **Fecha y release**
- **Qué cambió**, en lenguaje simple
- **A quién afecta:** dueño, cobrador o ambos
- **Dónde se ve:** la pantalla
- **¿Tiene que hacer algo?**

## Pendientes (todavía no están en una guía)

### Préstamos: "Por cobrar" y "Pagados"
- **Fecha y release:** 25/09/2026, `main` en `a8df014`.
- **Qué cambió:**
  - La lista de préstamos muestra primero lo que falta cobrar, con los préstamos en mora arriba.
  - Los préstamos ya pagados quedan aparte, en "Pagados".
  - En la ficha de cada cliente, los préstamos pagados aparecen recogidos. Se ven al tocar "Ver 2 pagados" (con la cantidad de ese cliente).
- **A quién afecta:** dueño y cobrador.
- **Dónde se ve:** Préstamos y la ficha del cliente.
- **¿Tiene que hacer algo?** No. Para ver los pagados, toque "Pagados".

### Los préstamos nuevos ya no salen en mora antes de tiempo
- **Fecha y release:** 25/09/2026, `main` en `a8df014`.
- **Qué cambió:**
  - Antes, un préstamo abierto o de cuota fija recién creado podía salir "En mora" antes de su primer cobro. Ya no pasa.
  - El abierto se empieza a cobrar el mes siguiente al desembolso.
  - La cuota fija entra en mora solo cuando una cuota lleva más de 5 días sin pagarse completa.
  - Los préstamos que habían quedado en mora por este error ya se corrigieron.
- **A quién afecta:** dueño y cobrador.
- **Dónde se ve:**
  - Préstamos (el estado de cada préstamo)
  - Cobros (los vencidos)
  - Inicio (los préstamos en mora)
- **¿Tiene que hacer algo?** No.

## Publicadas (ya contadas en una guía)

### Guía v1 (`diseno-2a`, 24/09/2026)
- El diseño nuevo de la app.
- Dónde quedó cada cosa en el menú.
- Los estados se ven más claros.
- No tiene que hacer nada.
