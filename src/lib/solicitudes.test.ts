import { describe, expect, it } from 'vitest'
import {
  estadoVisual,
  formatearCelular,
  hora,
  mensajeFicha,
  normalizarCelular,
  normalizarContacto,
  textoEnlace,
  textoVencimiento,
  tiempoRestante,
  urlFicha,
} from './solicitudes'

describe('normalizarCelular (réplica de normalizar_celular_co)', () => {
  it.each([
    ['3001234567', '573001234567'],
    ['300 123 4567', '573001234567'],
    ['300-123-4567', '573001234567'],
    ['+57 300 123 4567', '573001234567'],
    ['573001234567', '573001234567'],
  ])('%s → %s', (entrada, esperado) => expect(normalizarCelular(entrada)).toBe(esperado))

  it.each(['2001234567', '30012345', '30012345678', '6012345678', '', 'celular'])('rechaza "%s"', (entrada) => {
    expect(normalizarCelular(entrada)).toBeNull()
  })

  it('formatea para mostrar', () => {
    expect(formatearCelular('573001234567')).toBe('300 123 4567')
  })
})

describe('normalizarContacto (contacto para datos personales)', () => {
  it.each([
    ['300 123 4567', '300 123 4567'],
    ['+57 3001234567', '300 123 4567'],
    [' Datos@Ejemplo.com ', 'datos@ejemplo.com'],
  ])('%s → %s', (entrada, esperado) => expect(normalizarContacto(entrada)).toBe(esperado))

  it.each(['', '6012345', 'correo@', 'hola'])('rechaza "%s"', (entrada) => expect(normalizarContacto(entrada)).toBeNull())
})

describe('estado visual', () => {
  const ahora = new Date(2026, 8, 23, 9, 20)
  const futuro = new Date(2026, 8, 24, 8, 2).toISOString()
  const pasado = new Date(2026, 8, 21, 15, 15).toISOString()

  it('vencida = enviada con expira_en pasado (no se guarda)', () => {
    expect(estadoVisual('enviada', futuro, ahora)).toBe('enviada')
    expect(estadoVisual('enviada', pasado, ahora)).toBe('vencida')
    expect(estadoVisual('completada', pasado, ahora)).toBe('por_revisar')
    expect(estadoVisual('aprobada', pasado, ahora)).toBe('aprobada')
  })

  it('textos de la columna Enlace', () => {
    expect(textoEnlace({ estado: 'enviada', expira_en: futuro, completada_en: null }, ahora)).toBe('Vence en 22 h 42 min')
    expect(textoEnlace({ estado: 'enviada', expira_en: pasado, completada_en: null }, ahora)).toBe('Venció el 21/09 a las 3:15 p. m.')
    const usado = new Date(2026, 8, 23, 8, 14).toISOString()
    expect(textoEnlace({ estado: 'completada', expira_en: futuro, completada_en: usado }, ahora)).toBe('Usado el 23/09 a las 8:14 a. m.')
    expect(textoEnlace({ estado: 'aprobada', expira_en: futuro, completada_en: usado }, ahora)).toBe('Usado el 23/09')
  })

  it('tiempo restante y hora', () => {
    expect(tiempoRestante(new Date(ahora.getTime() + 35 * 60000).toISOString(), ahora)).toBe('35 min')
    expect(tiempoRestante(new Date(ahora.getTime() + 20000).toISOString(), ahora)).toBe('menos de 1 min')
    expect(hora(new Date(2026, 8, 23, 0, 5))).toBe('12:05 a. m.')
    expect(hora(new Date(2026, 8, 23, 12, 0))).toBe('12:00 p. m.')
  })

  it('texto de vencimiento: hoy / mañana', () => {
    expect(textoVencimiento(new Date(2026, 8, 23, 16, 10).toISOString(), ahora)).toBe('vence hoy, 23/09/2026, a las 4:10 p. m.')
    expect(textoVencimiento(new Date(2026, 8, 24, 9, 20).toISOString(), ahora)).toBe('vence mañana, 24/09/2026, a las 9:20 a. m.')
  })
})

describe('enlace y mensaje', () => {
  it('url pública', () => {
    expect(urlFicha('https://app.ejemplo.com/', 'abc')).toBe('https://app.ejemplo.com/s/abc')
  })

  it('mensaje del diseño, con y sin nombre', () => {
    expect(mensajeFicha('Paola', 'Créditos La 14', 'https://x/s/t')).toBe(
      'Hola, Paola. Para estudiar su solicitud de préstamo con Créditos La 14, por favor llene sus datos en este enlace: https://x/s/t\nEl enlace vence en 24 horas. Tenga su cédula a la mano.',
    )
    expect(mensajeFicha(null, 'N', 'u')).toMatch(/^Hola\. Para estudiar/)
  })
})
