// Utilidades compartidas de la prueba técnica de lectura de cédulas.
// REGLA: nada de lo que se imprime en consola puede contener datos personales.
// Los valores reales solo se escriben en resultados/ (ignorado por git, se borra con limpiar.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = path.dirname(fileURLToPath(import.meta.url))
// Las fotos se leen donde estén (CEDULAS_FOTOS) para no multiplicar copias de datos personales.
export const FOTOS = process.env.CEDULAS_FOTOS ?? path.join(RAIZ, 'fotos')
export const RESULTADOS = path.join(RAIZ, 'resultados')
// Datos de entrada con datos personales: viven junto a las fotos (carpeta ignorada por git).
export const VERDAD = path.join(FOTOS, 'verdad.json')

// fotos/origen-fotos.json (sin datos personales): { "c01-amarilla-frente.jpg": "whatsapp 1600px comprimida" }.
// Lo que no esté listado se asume "camara original".
const rutaOrigen = path.join(FOTOS, 'origen-fotos.json')
const ORIGEN = fs.existsSync(rutaOrigen) ? JSON.parse(fs.readFileSync(rutaOrigen, 'utf8')) : {}

// Convención de nombres: <id>-<tipo>-<lado>[-<condicion>].<ext>
//   id: c01, c02...  tipo: amarilla | digital  lado: frente | respaldo
//   condicion (opcional): luz, sombra, inclinada, reflejo, lejos...
// Ej: c01-amarilla-respaldo-inclinada.jpg
const PATRON = /^(?<id>[a-z0-9]+)-(?<tipo>amarilla|digital)-(?<lado>frente|respaldo)(?:-(?<condicion>[a-z0-9_]+))?\.(jpe?g|png|webp|heic)$/i

export function listarFotos(lado) {
  if (!fs.existsSync(FOTOS)) return []
  const todas = fs.readdirSync(FOTOS).filter((f) => !f.startsWith('.') && !f.endsWith('.json'))
  const validas = []
  for (const archivo of todas) {
    const m = archivo.match(PATRON)
    if (!m) {
      console.warn(`  (se ignora "${archivo}": no sigue la convención <id>-<tipo>-<lado>[-<condicion>].jpg)`)
      continue
    }
    const g = m.groups
    if (lado && g.lado.toLowerCase() !== lado) continue
    validas.push({
      archivo,
      ruta: path.join(FOTOS, archivo),
      id: g.id.toLowerCase(),
      tipo: g.tipo.toLowerCase(),
      lado: g.lado.toLowerCase(),
      condicion: (g.condicion ?? 'normal').toLowerCase(),
      origen: ORIGEN[archivo] ?? 'camara original',
    })
  }
  return validas.sort((a, b) => a.archivo.localeCompare(b.archivo))
}

export function guardarResultado(nombre, datos) {
  fs.mkdirSync(RESULTADOS, { recursive: true })
  fs.writeFileSync(path.join(RESULTADOS, nombre), JSON.stringify(datos, null, 2))
}

export function leerResultado(nombre) {
  const ruta = path.join(RESULTADOS, nombre)
  return fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : null
}

// Máscara de estructura: permite ver el FORMATO de un contenido sin ver los datos.
//   letra -> A   dígito -> 9   espacio -> _   NUL -> ·   otro no imprimible -> ¤
//   la puntuación ASCII se conserva (separadores, '/', ':', etc.)
export function enmascarar(bytes) {
  let s = ''
  for (const b of bytes) {
    if (b === 0) s += '·'
    else if (b >= 48 && b <= 57) s += '9'
    else if ((b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b >= 192) s += 'A'
    else if (b === 32) s += '_'
    else if (b > 32 && b < 127) s += String.fromCharCode(b)
    else s += '¤'
  }
  return s
}

// Comprime la máscara en corridas: "AAAA9999··" -> "A×4 9×4 ·×2"
export function corridas(mascara) {
  const partes = []
  let i = 0
  while (i < mascara.length) {
    let j = i
    while (j < mascara.length && mascara[j] === mascara[i]) j++
    partes.push(j - i > 1 ? `${mascara[i]}×${j - i}` : mascara[i])
    i = j
  }
  return partes.join(' ')
}

export function tabla(filas) {
  if (filas.length === 0) return
  const cols = Object.keys(filas[0])
  const ancho = cols.map((c) => Math.max(c.length, ...filas.map((f) => String(f[c] ?? '').length)))
  const linea = (vals) => vals.map((v, i) => String(v ?? '').padEnd(ancho[i])).join(' | ')
  console.log(linea(cols))
  console.log(ancho.map((w) => '-'.repeat(w)).join('-|-'))
  for (const f of filas) console.log(linea(cols.map((c) => f[c])))
}
