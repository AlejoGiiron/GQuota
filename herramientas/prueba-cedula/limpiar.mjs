// Borra todo lo que contiene datos personales generado por la prueba.
//   node limpiar.mjs          -> borra resultados/ (lecturas de ambos métodos)
//   node limpiar.mjs --todo   -> además borra fotos/ (fotos, verdad.json y origen-fotos.json)
import fs from 'node:fs'
import path from 'node:path'
import { RAIZ, RESULTADOS, FOTOS } from './comun.mjs'

const borrar = [RESULTADOS]
if (process.argv.includes('--todo')) borrar.push(FOTOS)
for (const ruta of borrar) {
  if (fs.existsSync(ruta)) {
    fs.rmSync(ruta, { recursive: true, force: true })
    console.log(`borrado: ${path.relative(RAIZ, ruta)}`)
  }
}
fs.mkdirSync(RESULTADOS, { recursive: true })
if (process.argv.includes('--todo')) fs.mkdirSync(FOTOS, { recursive: true })
