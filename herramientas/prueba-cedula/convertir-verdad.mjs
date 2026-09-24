// Convierte uno o más archivos de verdad (p. ej. verdad-c01.json) al formato de verdad.json, sin imprimir valores.
//   node convertir-verdad.mjs <ruta/verdad-c01.json> [otra...]
// - Toma solo los campos que compara el banco de pruebas (CAMPOS); descarta notas (_formato, _fotos) y extras.
// - Fusiona en fotos/verdad.json (ignorado por git): si la cédula ya existía, la reemplaza.
import fs from 'node:fs'
import path from 'node:path'
import { VERDAD } from './comun.mjs'
import { CAMPOS } from './campos.mjs'

const rutaVerdad = VERDAD
const verdad = fs.existsSync(rutaVerdad) ? JSON.parse(fs.readFileSync(rutaVerdad, 'utf8')) : {}

for (const origen of process.argv.slice(2)) {
  const datos = JSON.parse(fs.readFileSync(origen, 'utf8'))
  for (const [id, registro] of Object.entries(datos)) {
    const limpio = {}
    for (const campo of CAMPOS) if (registro[campo] != null && registro[campo] !== '') limpio[campo] = registro[campo]
    const descartados = Object.keys(registro).filter((k) => !CAMPOS.includes(k))
    verdad[id.toLowerCase()] = limpio
    console.log(`${id}: ${Object.keys(limpio).length} campos convertidos (${Object.keys(limpio).join(', ')}); descartados: ${descartados.join(', ') || '—'}`)
  }
}
fs.mkdirSync(path.dirname(rutaVerdad), { recursive: true })
fs.writeFileSync(rutaVerdad, JSON.stringify(verdad, null, 2))
console.log(`verdad.json: ${Object.keys(verdad).length} cédula(s)`)
