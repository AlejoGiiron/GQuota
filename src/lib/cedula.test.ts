import { describe, expect, it } from 'vitest'
import { FIN_TEXTO_CEDULA, leerCamposCedula } from './cedula'

/**
 * Payload SINTÉTICO con el formato de la cédula amarilla (datos inventados).
 * Nunca datos reales en el repo.
 */
function payload(campos: Partial<{
  marcador: string; numero: string; ap1: string; ap2: string; n1: string; n2: string; sexo: string; fecha: string; rh: string
}> = {}): Uint8Array {
  const c = { marcador: 'PubDSK_1', numero: '0001000000089', ap1: 'PRUEBA', ap2: 'SINTÉTICA', n1: 'ANA', n2: 'MARÍA', sexo: 'F', fecha: '19900115', rh: 'O+', ...campos }
  const b = new Uint8Array(531)
  const escribir = (i: number, t: string) => { for (let k = 0; k < t.length; k++) b[i + k] = t.charCodeAt(k) & 0xff }
  escribir(0, '12345678901')
  escribir(24, c.marcador)
  escribir(40, c.numero.padStart(18, '0'))
  escribir(58, c.ap1); escribir(81, c.ap2); escribir(104, c.n1); escribir(127, c.n2)
  escribir(150, '0'); escribir(151, c.sexo); escribir(152, c.fecha); escribir(160, '760010'); escribir(166, c.rh)
  // "Huella": bytes binarios desde el 169.
  for (let i = FIN_TEXTO_CEDULA; i < b.length; i++) b[i] = (i * 37 + 11) % 256 || 1
  return b
}

describe('leerCamposCedula (PDF417 de la cédula amarilla)', () => {
  it('lee número, apellidos, nombres, sexo, fecha y RH', () => {
    expect(leerCamposCedula(payload())).toEqual({
      cedula: '1000000089',
      apellidos: 'PRUEBA SINTÉTICA',
      nombres: 'ANA MARÍA',
      sexo: 'F',
      fecha_nacimiento: '1990-01-15',
      rh: 'O+',
    })
  })

  it('BORRA la huella en memoria: del byte 169 en adelante queda en cero, lea o no', () => {
    const b = payload()
    expect(b.subarray(FIN_TEXTO_CEDULA).some((x) => x !== 0)).toBe(true)
    leerCamposCedula(b)
    expect(b.subarray(FIN_TEXTO_CEDULA).every((x) => x === 0)).toBe(true)
    // También cuando no es una cédula válida.
    const malo = payload({ marcador: 'OTRA_COS' })
    expect(leerCamposCedula(malo)).toBeNull()
    expect(malo.subarray(FIN_TEXTO_CEDULA).every((x) => x === 0)).toBe(true)
  })

  it('el resultado no contiene nada de la huella: solo los 6 campos', () => {
    const r = leerCamposCedula(payload())!
    expect(Object.keys(r).sort()).toEqual(['apellidos', 'cedula', 'fecha_nacimiento', 'nombres', 'rh', 'sexo'])
  })

  it('rechaza lo que no es una cédula amarilla', () => {
    expect(leerCamposCedula(payload({ marcador: 'XXXXXXXX' }))).toBeNull()
    expect(leerCamposCedula(new Uint8Array(100))).toBeNull()
    expect(leerCamposCedula(payload({ numero: '0000000000ABCDEFGH' }))).toBeNull()
  })

  it('con un solo apellido y un solo nombre', () => {
    const r = leerCamposCedula(payload({ ap2: '', n2: '' }))!
    expect([r.apellidos, r.nombres]).toEqual(['PRUEBA', 'ANA'])
  })

  it('sexo, fecha o RH raros quedan en null sin tumbar la lectura', () => {
    const r = leerCamposCedula(payload({ sexo: 'X', fecha: '19901399', rh: 'Z?' }))!
    expect([r.sexo, r.fecha_nacimiento, r.rh]).toEqual([null, null, null])
    expect(r.cedula).toBe('1000000089')
  })
})
