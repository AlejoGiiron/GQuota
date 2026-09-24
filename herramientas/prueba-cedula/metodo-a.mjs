// MÉTODO A — decodificar el código del RESPALDO con zxing (zxing-cpp compilado a wasm), 100% local.
//
// Uso:
//   node metodo-a.mjs              -> procesa fotos/*-respaldo*.jpg
//   node metodo-a.mjs --autoprueba -> valida el pipeline con códigos SINTÉTICOS (datos falsos), sin fotos
//
// Consola: solo formato, longitud, intento que funcionó y la MÁSCARA de estructura (sin datos).
// resultados/a-<archivo>.json guarda los bytes reales (ignorado por git; se borra con limpiar.mjs).
import fs from 'node:fs'
import sharp from 'sharp'
import { createRequire } from 'node:module'
import { readBarcodes, prepareZXingModule as prepararLector } from 'zxing-wasm/reader'
import { writeBarcode, prepareZXingModule as prepararEscritor } from 'zxing-wasm/writer'
import { listarFotos, guardarResultado, enmascarar, corridas, tabla } from './comun.mjs'

// zxing-wasm, por defecto, DESCARGA su .wasm del CDN jsDelivr. Aquí se carga el binario local de
// node_modules: el método A no hace ninguna conexión de red.
// Garantía: cualquier intento de red dentro de este proceso falla en vez de salir en silencio.
globalThis.fetch = () => { throw new Error('Método A: la red está bloqueada a propósito') }
const requerir = createRequire(import.meta.url)
const wasmLocal = (tipo) => fs.readFileSync(requerir.resolve(`zxing-wasm/${tipo}/zxing_${tipo}.wasm`))
await prepararLector({ overrides: { wasmBinary: wasmLocal('reader') }, fireImmediately: true })
if (process.argv.includes('--autoprueba')) {
  await prepararEscritor({ overrides: { wasmBinary: wasmLocal('writer') }, fireImmediately: true })
}

// Opciones base: busca TODOS los formatos (queremos descubrir cuál trae cada cédula).
const BASE = { formats: [], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 4 }

// Escalera de intentos, del más barato al más agresivo. Se registra cuál fue el primero que leyó.
const INTENTOS = [
  { nombre: 'original', prep: (img) => img },
  { nombre: 'gris+normalizar', prep: (img) => img.grayscale().normalise() },
  { nombre: 'gris+normalizar+enfocar', prep: (img) => img.grayscale().normalise().sharpen({ sigma: 1.2 }) },
  { nombre: 'reducir 2000px', prep: (img) => img.resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).grayscale().normalise() },
  { nombre: 'reducir 1200px', prep: (img) => img.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).grayscale().normalise() },
  { nombre: 'global-histogram', prep: (img) => img.grayscale().normalise(), opciones: { binarizer: 'GlobalHistogram' } },
  { nombre: 'umbral fijo', prep: (img) => img.grayscale().normalise().threshold(140), opciones: { binarizer: 'FixedThreshold' } },
  // zxing solo prueba giros de 90°; el PDF417 falla con pocos grados de inclinación.
  // Barrido de enderezado: gira la imagen en pasos pequeños y reintenta.
  ...[-3, 3, -6, 6, -9, 9, -12, 12, -15, 15, -20, 20].map((grados) => ({
    nombre: `enderezar ${grados > 0 ? '+' : ''}${grados}°`,
    prep: (img) => img.rotate(grados, { background: '#ffffff' }).grayscale().normalise(),
  })),
]

async function decodificar(bufferImagen) {
  for (const intento of INTENTOS) {
    // .rotate() sin argumentos aplica la orientación EXIF del celular.
    // Dos pasos: primero la orientación EXIF (sharp aplica una sola rotación por pipeline).
    const orientada = await sharp(bufferImagen).rotate().png().toBuffer()
    const png = await intento.prep(sharp(orientada)).png().toBuffer()
    const t0 = performance.now()
    const res = await readBarcodes(new Uint8Array(png), { ...BASE, ...(intento.opciones ?? {}) })
    const ms = Math.round(performance.now() - t0)
    const validos = res.filter((r) => r.isValid)
    if (validos.length) return { ok: true, intento: intento.nombre, ms, codigos: validos }
  }
  return { ok: false, intento: '—', ms: 0, codigos: [] }
}

// PDF417 de la cédula AMARILLA: campos de ancho fijo rellenos con NUL. Posiciones deducidas de la
// estructura y verificadas contra verdad.json (c01). Marcador "PubDSK_1" en [24,8].
// Desde el byte 169 viene un bloque binario (probablemente la plantilla de la huella): NO se guarda.
const FIN_TEXTO_AMARILLA = 169
function parsearAmarilla(bytes) {
  const b = Buffer.from(bytes)
  if (b.length < FIN_TEXTO_AMARILLA || b.subarray(24, 32).toString('latin1') !== 'PubDSK_1') return null
  const s = (i, n) => b.subarray(i, i + n).toString('latin1').replace(/\0+/g, ' ').trim()
  const f = s(152, 8)
  return {
    numero: s(48, 10).replace(/^0+/, ''),
    apellidos: `${s(58, 23)} ${s(81, 23)}`.trim(),
    nombres: `${s(104, 23)} ${s(127, 23)}`.trim(),
    sexo: s(151, 1),
    fecha_nacimiento: /^\d{8}$/.test(f) ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6)}` : f,
    rh: s(166, 2),
    estatura: null, fecha_expedicion: null, lugar_expedicion: null, fecha_vencimiento: null,
  }
}

function describir(codigo) {
  const bytes = codigo.bytes ?? new TextEncoder().encode(codigo.text)
  const imprimibles = [...bytes].filter((b) => b >= 32 && b < 127).length
  return {
    formato: codigo.format,
    tipoContenido: codigo.contentType,
    bytes: bytes.length,
    pctImprimible: Math.round((100 * imprimibles) / Math.max(bytes.length, 1)),
    mascara: enmascarar(bytes),
  }
}

async function procesarFotos() {
  const fotos = listarFotos('respaldo')
  if (fotos.length === 0) {
    console.log('No hay fotos de respaldo en fotos/. Convención: c01-amarilla-respaldo[-condicion].jpg')
    return
  }
  const filas = []
  const estructuras = []
  for (const f of fotos) {
    const r = await decodificar(fs.readFileSync(f.ruta))
    const desc = r.codigos.map(describir)
    // Solo se guardan los campos parseados; ni el contenido crudo ni el bloque binario (huella).
    const campos = r.codigos.map((c) => (c.format === 'PDF417' ? parsearAmarilla(c.bytes ?? []) : null)).find(Boolean) ?? null
    guardarResultado(`a-${f.archivo}.json`, {
      ...f,
      ok: r.ok,
      intento: r.intento,
      formatos: r.codigos.map((c) => c.format),
      campos,
    })
    filas.push({
      archivo: f.archivo,
      tipo: f.tipo,
      condicion: f.condicion,
      origen: f.origen,
      lee: r.ok ? 'SÍ' : 'no',
      intento: r.intento,
      formato: desc.map((d) => d.formato).join('+') || '—',
      bytes: desc.map((d) => d.bytes).join('+') || '—',
      '%imprimible': desc.map((d) => d.pctImprimible).join('+') || '—',
      ms: r.ms || '—',
    })
    for (const d of desc) estructuras.push({ archivo: f.archivo, tipo: f.tipo, ...d })
  }
  tabla(filas)

  const porTipo = {}
  for (const f of filas) {
    porTipo[f.tipo] ??= { total: 0, leidas: 0 }
    porTipo[f.tipo].total++
    if (f.lee === 'SÍ') porTipo[f.tipo].leidas++
  }
  console.log('\nResumen por tipo de cédula:')
  for (const [tipo, v] of Object.entries(porTipo)) console.log(`  ${tipo}: ${v.leidas}/${v.total} fotos decodificadas`)

  console.log('\nEstructura del contenido (máscara: A=letra 9=dígito _=espacio ·=NUL ¤=binario):')
  for (const e of estructuras) {
    console.log(`\n  ${e.archivo} [${e.tipo}] ${e.formato}, ${e.bytes} bytes, ${e.pctImprimible}% imprimible, contentType=${e.tipoContenido}`)
    console.log(`  ${corridas(e.mascara)}`)
  }
}

// Autoprueba con DATOS FALSOS: genera un PDF417 y un QR, los degrada como una foto de celular
// (inclinación, desenfoque, luz irregular, JPEG) y verifica que el pipeline los recupere.
async function autoprueba() {
  const falso = 'ABC123\0\0PEREZ\0GOMEZ\0JUAN\0CARLOS\0M19900101O+'
  const casos = [
    { formato: 'PDF417', contenido: falso },
    { formato: 'QRCode', contenido: 'https://ejemplo.invalid/verificar?id=0000' },
  ]
  const filas = []
  for (const c of casos) {
    const { image, error } = await writeBarcode(c.contenido, { format: c.formato, scale: 4 })
    if (!image) throw new Error(`No se pudo generar ${c.formato}: ${error}`)
    const limpio = Buffer.from(await image.arrayBuffer())
    const degradaciones = {
      limpia: (s) => s,
      'inclinada 8°': (s) => s.rotate(8, { background: '#ffffff' }),
      'inclinada 20°': (s) => s.rotate(20, { background: '#ffffff' }),
      'desenfocada': (s) => s.blur(1.5),
      'oscura+jpeg q40': (s) => s.linear(0.55, 20).jpeg({ quality: 40 }),
      'pequeña (40%)': (s) => s.resize({ width: 300 }),
    }
    for (const [nombre, fn] of Object.entries(degradaciones)) {
      const buf = await fn(sharp(limpio).flatten({ background: '#ffffff' }).extend({ top: 60, bottom: 60, left: 60, right: 60, background: '#ffffff' })).toBuffer()
      const r = await decodificar(buf)
      const esperado = Buffer.from(c.contenido, 'latin1')
      const exacto = r.ok && r.codigos.some((x) => Buffer.from(x.bytes ?? []).equals(esperado))
      filas.push({ formato: c.formato, degradacion: nombre, lee: r.ok ? 'SÍ' : 'no', exacto: exacto ? 'SÍ' : 'no', intento: r.intento })
    }
  }
  tabla(filas)
  console.log('\n(Autoprueba con datos sintéticos: solo valida el pipeline; la evidencia real sale de las fotos.)')
}

if (process.argv.includes('--autoprueba')) await autoprueba()
else await procesarFotos()
