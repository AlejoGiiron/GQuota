// Compara lo que leyó cada método contra la verdad, campo por campo. Solo imprime aciertos/fallos.
//
// fotos/verdad.json (lo llenas tú, a mano, mirando la cédula; ignorado por git):
//   { "c01": { "numero": "...", "apellidos": "...", "nombres": "...", "sexo": "M",
//              "fecha_nacimiento": "AAAA-MM-DD", "lugar_nacimiento": "...", "rh": "O+", ... } }
// Solo los campos que pongas cuentan; los que omitas no se evalúan.
import fs from 'node:fs'
import path from 'node:path'
import { RESULTADOS, VERDAD, tabla } from './comun.mjs'
import { CAMPOS, normalizar } from './campos.mjs'

const rutaVerdad = VERDAD
if (!fs.existsSync(rutaVerdad)) {
  console.log('Falta fotos/verdad.json. Copia verdad.ejemplo.json a fotos/verdad.json y llénalo con los datos reales.')
  process.exit(1)
}
const verdad = JSON.parse(fs.readFileSync(rutaVerdad, 'utf8'))

// Resultados disponibles: b-*.json (método B) y a-*.json con campos parseados (método A, si hay parser).
const archivos = fs.existsSync(RESULTADOS) ? fs.readdirSync(RESULTADOS).filter((f) => /^[ab]-.*\.json$/.test(f)) : []
const porMetodo = { A: {}, B: {} }
const detalle = []
for (const archivo of archivos) {
  const r = JSON.parse(fs.readFileSync(path.join(RESULTADOS, archivo), 'utf8'))
  const metodo = archivo.startsWith('a-') ? 'A' : 'B'
  const esperado = verdad[r.id]
  if (!esperado || !r.campos) continue
  const fallos = []
  for (const campo of CAMPOS) {
    if (!(campo in esperado)) continue
    const esp = normalizar(campo, esperado[campo])
    const obt = normalizar(campo, r.campos[campo])
    // Si el campo no está impreso en ese lado, que venga null es lo CORRECTO (no se evalúa como acierto ni fallo).
    const k = (porMetodo[metodo][campo] ??= { aciertos: 0, fallos: 0, vacios: 0 })
    if (obt == null) { k.vacios++; continue }
    if (obt === esp) k.aciertos++
    else { k.fallos++; fallos.push(campo) }
  }
  detalle.push({ metodo, archivo: r.archivo, condicion: r.condicion, origen: r.origen, 'campos mal leídos': fallos.join(', ') || '—' })
}

for (const [metodo, campos] of Object.entries(porMetodo)) {
  if (!Object.keys(campos).length) continue
  console.log(`\nMétodo ${metodo} — precisión por campo (vacío = no lo devolvió; se cuenta aparte)`)
  tabla(Object.entries(campos).map(([campo, k]) => ({
    campo,
    aciertos: k.aciertos,
    'leído mal': k.fallos,
    vacío: k.vacios,
    precisión: k.aciertos + k.fallos ? `${Math.round((100 * k.aciertos) / (k.aciertos + k.fallos))}%` : '—',
  })))
}
console.log('\nPor foto (solo NOMBRES de campos, sin valores):')
tabla(detalle)
