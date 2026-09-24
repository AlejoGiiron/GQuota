# Prueba de lectura de cédula

Herramienta de la prueba técnica del 2026-09-24 (decisión y evidencia en el `CLAUDE.md` de la raíz,
"Decisiones de arquitectura"). No es parte de la app: tiene su propio `package.json`.

⚠️ `fotos/` y `resultados/` están ignoradas por git: ahí van las fotos, `verdad.json`, `origen-fotos.json`
y todas las lecturas. Nada con datos personales fuera de esas dos carpetas. Al terminar: `npm run limpiar`.

## Uso

```bash
cd herramientas/prueba-cedula
npm install
npm run autoprueba            # método A con códigos sintéticos (sin fotos, sin red)
npm run metodo-a              # decodifica el respaldo de fotos/*-respaldo*.jpg
npm run comparar              # precisión campo a campo contra fotos/verdad.json
npm run limpiar               # borra fotos/ y resultados/
```

- Nombres de las fotos: `<id>-<amarilla|digital>-<frente|respaldo>[-<condicion>].jpg`
  (ej. `c02-digital-respaldo-inclinada.jpg`). JPG, no HEIC.
- `fotos/verdad.json`: datos correctos de cada cédula, con el formato de `verdad.ejemplo.json`.
  `node convertir-verdad.mjs <archivo>` convierte otro formato sin imprimir los valores.
- `fotos/origen-fotos.json` (opcional): `{ "c01-amarilla-respaldo.jpg": "whatsapp 1600px" }`.
- Las fotos también se pueden leer desde otra carpeta: `CEDULAS_FOTOS=<ruta> npm run metodo-a`.
- La consola nunca imprime valores: solo aciertos, fallos y la estructura enmascarada (A=letra, 9=dígito).

## Métodos

- **A (elegido):** `zxing-wasm` local sobre el PDF417 del respaldo. El `.wasm` se carga de
  `node_modules` y `fetch` queda bloqueado: no hay tráfico de red. El bloque de la huella no se guarda.
- **B (descartado por ahora):** visión de la API de Anthropic sobre el frente. La foto sale del equipo.
  Requiere `ANTHROPIC_API_KEY` en el entorno (nunca en archivos). `node metodo-b.mjs --autoprueba`
  usa una cédula ficticia.

Pendiente, cuando haya una cédula digital disponible: qué código trae su respaldo y si sus datos
vienen legibles.
