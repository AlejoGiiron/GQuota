/**
 * Lectura de la cédula AMARILLA desde su código PDF417 (método A, decisión del
 * 2026-09-24 en CLAUDE.md). Lógica pura: recibe los bytes ya decodificados por
 * zxing (src/lib/lector-cedula.ts) y devuelve solo los campos que se guardan.
 *
 * Formato (campos de ancho fijo rellenos con NUL; [offset, longitud]):
 *   marcador "PubDSK_1" [24,8] · número [48,10] · apellidos [58,23]+[81,23] ·
 *   nombres [104,23]+[127,23] · sexo [151,1] · nacimiento [152,8] AAAAMMDD · RH [166,2]
 * Desde el byte 169 viene un bloque binario (probablemente la plantilla de la
 * HUELLA dactilar, dato biométrico): se BORRA en memoria y nunca sale de aquí.
 */

export const FIN_TEXTO_CEDULA = 169
const MARCADOR = 'PubDSK_1'

export type CamposCedula = {
  cedula: string
  apellidos: string
  nombres: string
  sexo: 'M' | 'F' | null
  /** AAAA-MM-DD */
  fecha_nacimiento: string | null
  rh: string | null
}

/**
 * Lee los campos del PDF417 y SIEMPRE borra la huella del buffer recibido
 * (bytes 169 en adelante quedan en cero), lo lea o no. null si no es una cédula
 * amarilla válida.
 */
export function leerCamposCedula(bytes: Uint8Array): CamposCedula | null {
  try {
    if (bytes.length < FIN_TEXTO_CEDULA) return null
    // Solo la parte de texto; latin1 para Ñ y tildes.
    const texto = new TextDecoder('latin1').decode(bytes.subarray(0, FIN_TEXTO_CEDULA))
    const s = (i: number, n: number) => texto.slice(i, i + n).replace(/\0+/g, ' ').trim()
    if (texto.slice(24, 32) !== MARCADOR) return null

    const cedula = s(48, 10).replace(/^0+/, '')
    const apellidos = `${s(58, 23)} ${s(81, 23)}`.replace(/\s+/g, ' ').trim()
    const nombres = `${s(104, 23)} ${s(127, 23)}`.replace(/\s+/g, ' ').trim()
    if (!/^\d{5,10}$/.test(cedula) || !apellidos || !nombres) return null

    const sexo = s(151, 1)
    const f = s(152, 8)
    const fecha = /^(\d{4})(\d{2})(\d{2})$/.exec(f)
    const fechaValida =
      fecha && Number(fecha[2]) >= 1 && Number(fecha[2]) <= 12 && Number(fecha[3]) >= 1 && Number(fecha[3]) <= 31
    const rh = s(166, 2)
    return {
      cedula,
      apellidos,
      nombres,
      sexo: sexo === 'M' || sexo === 'F' ? sexo : null,
      fecha_nacimiento: fechaValida ? `${fecha[1]}-${fecha[2]}-${fecha[3]}` : null,
      rh: /^(A|B|AB|O)[+-]$/.test(rh) ? rh : null,
    }
  } finally {
    bytes.fill(0, FIN_TEXTO_CEDULA)
  }
}
