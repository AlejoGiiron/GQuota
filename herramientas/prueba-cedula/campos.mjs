// Campos que se comparan entre métodos, y su normalización (para no castigar diferencias de forma).
export const CAMPOS = [
  'numero', 'apellidos', 'nombres', 'sexo', 'fecha_nacimiento',
  'rh', 'estatura', 'fecha_expedicion', 'lugar_expedicion', 'fecha_vencimiento',
]

const MESES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12 }
const dos = (n) => String(n).padStart(2, '0')

// Lleva cualquier forma de fecha de la cédula a AAAA-MM-DD; si no la reconoce, devuelve el texto tal cual
// (y la comparación fallará, que es lo honesto).
export function normalizarFecha(s) {
  let m
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return `${m[1]}-${dos(m[2])}-${dos(m[3])}`
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return `${m[1]}-${m[2]}-${m[3]}`
  if ((m = s.match(/^(\d{1,2})[-/ .](\d{1,2})[-/ .](\d{4})$/))) return `${m[3]}-${dos(m[2])}-${dos(m[1])}`
  if ((m = s.match(/^(\d{1,2})[-/ .]([A-Z]{3})[A-Z]*[-/ .](\d{4})$/)) && MESES[m[2]]) return `${m[3]}-${dos(MESES[m[2]])}-${dos(m[1])}`
  return s
}

export function normalizar(campo, v) {
  if (v == null || v === '') return null
  let s = String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
  if (campo === 'numero') s = s.replace(/\D/g, '')
  else if (campo === 'rh') s = s.replace(/\s|RH|G\.?S\.?/g, '')
  else if (campo === 'estatura') s = s.replace(/\D/g, '') // "1.72" y "172" -> "172"
  else if (campo.startsWith('fecha_')) s = normalizarFecha(s)
  else if (campo.startsWith('lugar_')) s = s.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() // "CALI (VALLE)" = "CALI VALLE"
  return s
}
