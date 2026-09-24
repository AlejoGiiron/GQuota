// MÉTODO B — leer el FRENTE con visión de Claude (API de Anthropic). La imagen SALE del equipo.
//
// Uso (la clave SOLO por variable de entorno, nunca en archivos):
//   ANTHROPIC_API_KEY=... node metodo-b.mjs              -> procesa fotos/*-frente*.jpg
//   ANTHROPIC_API_KEY=... node metodo-b.mjs --respaldo   -> también los respaldos (opcional)
//   ANTHROPIC_API_KEY=... node metodo-b.mjs --autoprueba -> una cédula FICTICIA generada aquí
//   MODELO=claude-... para probar otro modelo (por defecto claude-opus-5).
//
// Consola: solo tokens, costo, latencia, stop_reason y QUÉ campos vinieron llenos (no sus valores).
// Los valores extraídos van a resultados/b-<archivo>.json (ignorado por git; limpiar.mjs los borra).
import fs from 'node:fs'
import sharp from 'sharp'
import Anthropic from '@anthropic-ai/sdk'
import { listarFotos, guardarResultado, tabla } from './comun.mjs'
import { CAMPOS } from './campos.mjs'

const MODELO = process.env.MODELO ?? 'claude-opus-5'
// USD por millón de tokens (precios de lista de la API a 2026-06; verificar antes de decidir).
const PRECIOS = {
  'claude-opus-5': { entrada: 5, salida: 25 },
  'claude-opus-4-8': { entrada: 5, salida: 25 },
  'claude-sonnet-5': { entrada: 2, salida: 10 },
  'claude-haiku-4-5': { entrada: 1, salida: 5 },
}

const texto = { type: ['string', 'null'] }
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo_documento', 'lado', ...CAMPOS, 'campos_dudosos'],
  properties: {
    tipo_documento: { type: 'string', enum: ['cedula_amarilla', 'cedula_digital', 'otro', 'ilegible'] },
    lado: { type: 'string', enum: ['frente', 'respaldo', 'desconocido'] },
    numero: texto,
    apellidos: texto,
    nombres: texto,
    sexo: { type: ['string', 'null'], enum: ['M', 'F', null] },
    fecha_nacimiento: texto,
    rh: texto,
    estatura: texto,
    fecha_expedicion: texto,
    lugar_expedicion: texto,
    fecha_vencimiento: texto,
    campos_dudosos: { type: 'array', items: { type: 'string' } },
  },
}

const INSTRUCCIONES = `Esta imagen es una foto de celular de una cédula de ciudadanía colombiana (puede ser la amarilla con hologramas o la cédula digital), tomada para registrar a un cliente en una app de préstamos.

Transcribe los campos que estén impresos y visibles en ESTE lado del documento.
- Si un campo no aparece en este lado o no se puede leer, devuélvelo como null. No lo deduzcas ni lo inventes.
- numero: solo dígitos, sin puntos ni espacios.
- Fechas en formato AAAA-MM-DD.
- apellidos y nombres tal como aparecen impresos, en mayúsculas.
- rh: grupo sanguíneo y factor, por ejemplo O+.
- estatura: tal como aparece impresa.
- Pon en campos_dudosos el nombre de cada campo que transcribiste pero cuya lectura no es segura (reflejo, desenfoque, texto cortado).`

// El lado largo máximo que usa el modelo es 2576 px: enviar más solo gasta ancho de banda.
async function prepararImagen(buffer) {
  const jpeg = await sharp(buffer).rotate().resize({ width: 2576, height: 2576, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()
  return jpeg.toString('base64')
}

function costo(usage) {
  const p = PRECIOS[MODELO]
  if (!p) return null
  // Con fallback, el uso real viene desglosado en iterations; si no, el total directo.
  const it = usage.iterations?.length ? usage.iterations : [usage]
  let usd = 0
  for (const u of it) usd += ((u.input_tokens ?? 0) * p.entrada + (u.output_tokens ?? 0) * p.salida) / 1e6
  return usd
}

export async function leer(client, bufferImagen) {
  const data = await prepararImagen(bufferImagen)
  const t0 = performance.now()
  const resp = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    // Si un clasificador de seguridad rechaza la petición, la API reintenta en el modelo recomendado.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
        { type: 'text', text: INSTRUCCIONES },
      ],
    }],
  })
  const ms = Math.round(performance.now() - t0)
  let campos = null
  if (resp.stop_reason !== 'refusal') {
    const bloque = resp.content.find((b) => b.type === 'text')
    if (bloque) campos = JSON.parse(bloque.text)
  }
  return { campos, stop: resp.stop_reason, modelo: resp.model, usage: resp.usage, usd: costo(resp.usage), ms }
}

async function procesarFotos(client) {
  const fotos = listarFotos(process.argv.includes('--respaldo') ? undefined : 'frente')
  if (fotos.length === 0) {
    console.log('No hay fotos en fotos/. Convención: c01-amarilla-frente[-condicion].jpg')
    return
  }
  const filas = []
  let totalUsd = 0
  for (const f of fotos) {
    const r = await leer(client, fs.readFileSync(f.ruta))
    guardarResultado(`b-${f.archivo}.json`, { ...f, ...r })
    totalUsd += r.usd ?? 0
    const llenos = r.campos ? CAMPOS.filter((c) => r.campos[c] != null) : []
    filas.push({
      archivo: f.archivo,
      detecta: r.campos?.tipo_documento ?? '—',
      stop: r.stop,
      servidoPor: r.modelo,
      'tok in': r.usage.input_tokens,
      'tok out': r.usage.output_tokens,
      USD: r.usd?.toFixed(4) ?? '?',
      seg: (r.ms / 1000).toFixed(1),
      llenos: `${llenos.length}/${CAMPOS.length}`,
      dudosos: r.campos?.campos_dudosos?.length ?? '—',
    })
  }
  tabla(filas)
  console.log(`\nModelo pedido: ${MODELO}. Costo total: US$${totalUsd.toFixed(4)} · promedio por lectura: US$${(totalUsd / fotos.length).toFixed(4)}`)
  console.log('Campos llenos por foto (sin valores):')
  for (const f of fotos) {
    const r = JSON.parse(fs.readFileSync(new URL(`./resultados/b-${f.archivo}.json`, import.meta.url)))
    const llenos = r.campos ? CAMPOS.filter((c) => r.campos[c] != null) : []
    console.log(`  ${f.archivo}: ${llenos.join(', ') || '(ninguno)'}`)
  }
}

// Cédula FICTICIA dibujada aquí (datos inventados) para validar el pipeline sin datos reales.
async function autoprueba(client) {
  const esperado = { numero: '1234567890', apellidos: 'PRUEBA EJEMPLO', nombres: 'NOMBRE FICTICIO', sexo: 'M', fecha_nacimiento: '1990-01-01', rh: 'O+' }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630">
    <rect width="1000" height="630" rx="30" fill="#f2e3a0"/>
    <text x="40" y="70" font-family="Arial" font-size="30" font-weight="bold">REPÚBLICA DE COLOMBIA — DOCUMENTO FICTICIO DE PRUEBA</text>
    <text x="40" y="160" font-family="Arial" font-size="28">NÚMERO 1.234.567.890</text>
    <text x="40" y="240" font-family="Arial" font-size="40" font-weight="bold">PRUEBA EJEMPLO</text>
    <text x="40" y="275" font-family="Arial" font-size="20">APELLIDOS</text>
    <text x="40" y="350" font-family="Arial" font-size="40" font-weight="bold">NOMBRE FICTICIO</text>
    <text x="40" y="385" font-family="Arial" font-size="20">NOMBRES</text>
    <text x="40" y="470" font-family="Arial" font-size="24">SEXO M   FECHA DE NACIMIENTO 01-ENE-1990   G.S. RH O+</text>
  </svg>`
  const img = await sharp(Buffer.from(svg)).rotate(4, { background: '#777777' }).jpeg({ quality: 70 }).toBuffer()
  const r = await leer(client, img)
  const filas = Object.entries(esperado).map(([campo, v]) => ({ campo, correcto: r.campos?.[campo] === v ? 'SÍ' : 'no' }))
  tabla(filas)
  console.log(`\nstop=${r.stop} · servido por ${r.modelo} · ${r.usage.input_tokens} tok in / ${r.usage.output_tokens} tok out · US$${r.usd?.toFixed(4)} · ${(r.ms / 1000).toFixed(1)} s`)
}

// Solo corre si se ejecuta directo (comparar.mjs lo importa para reusar CAMPOS).
if (process.argv[1]?.endsWith('metodo-b.mjs')) {
  const client = new Anthropic() // toma ANTHROPIC_API_KEY del entorno
  if (process.argv.includes('--autoprueba')) await autoprueba(client)
  else await procesarFotos(client)
}
