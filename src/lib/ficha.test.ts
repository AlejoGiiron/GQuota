import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FICHA_POR_DEFECTO,
  aplicarReglas,
  bloqueo,
  contarModos,
  leerFicha,
  mismaFicha,
  pasosFormulario,
  type FichaConfig,
} from './ficha'

describe('FICHA_POR_DEFECTO', () => {
  it('coincide con el valor por defecto de la migración 035 (doble fuente vigilada)', () => {
    const sql = readFileSync(
      fileURLToPath(new URL('../../supabase/migrations/035_solicitudes_ficha_enlace.sql', import.meta.url)),
      'utf8',
    )
    const m = sql.match(/add column ficha_config jsonb not null default '([\s\S]*?)'::jsonb/)
    expect(m).not.toBeNull()
    expect(JSON.parse(m![1])).toEqual(FICHA_POR_DEFECTO)
  })

  it('tiene los valores del diseño: 22 campos, 15 obligatorios, 6 opcionales y 1 apagado', () => {
    expect(Object.keys(FICHA_POR_DEFECTO.campos)).toHaveLength(22)
    expect(contarModos(FICHA_POR_DEFECTO)).toEqual({ obligatorio: 15, opcional: 6, apagado: 1 })
    expect(FICHA_POR_DEFECTO.lectura_automatica).toBe(true)
  })
})

describe('reglas', () => {
  const conCambios = (cambios: Partial<FichaConfig['campos']>, lectura = true): FichaConfig => ({
    ...FICHA_POR_DEFECTO,
    lectura_automatica: lectura,
    campos: { ...FICHA_POR_DEFECTO.campos, ...cambios },
  })

  it('nombres, apellidos, cédula y celular siempre obligatorios', () => {
    const r = aplicarReglas(conCambios({ nombres: 'apagado', apellidos: 'opcional', cedula: 'apagado', celular: 'opcional' }))
    expect([r.campos.nombres, r.campos.apellidos, r.campos.cedula, r.campos.celular]).toEqual(Array(4).fill('obligatorio'))
    expect(bloqueo(r, 'cedula')).toBe('Siempre obligatorio')
  })

  it('con lectura automática, la cédula por detrás es obligatoria; sin lectura, se puede cambiar', () => {
    expect(aplicarReglas(conCambios({ cedula_reverso: 'opcional' }, true)).campos.cedula_reverso).toBe('obligatorio')
    expect(bloqueo(conCambios({}, true), 'cedula_reverso')).toBe('Obligatoria por la lectura')
    const sinLectura = aplicarReglas(conCambios({ cedula_reverso: 'opcional' }, false))
    expect(sinLectura.campos.cedula_reverso).toBe('opcional')
    expect(bloqueo(sinLectura, 'cedula_reverso')).toBeNull()
  })

  it('leerFicha tolera datos raros: campos desconocidos o modos inválidos caen al valor por defecto', () => {
    const leida = leerFicha({ lectura_automatica: 'sí', campos: { correo: 'opcional', barrio: 'tal vez', inventado: 'obligatorio' } })
    expect(leida.lectura_automatica).toBe(true)
    expect(leida.campos.correo).toBe('opcional')
    expect(leida.campos.barrio).toBe('obligatorio')
    expect(leida).not.toHaveProperty('campos.inventado')
    expect(leerFicha(null)).toEqual(FICHA_POR_DEFECTO)
  })

  it('mismaFicha detecta cambios', () => {
    expect(mismaFicha(FICHA_POR_DEFECTO, leerFicha(FICHA_POR_DEFECTO))).toBe(true)
    expect(mismaFicha(FICHA_POR_DEFECTO, conCambios({ correo: 'opcional' }))).toBe(false)
  })
})

describe('pasosFormulario', () => {
  it('con los valores por defecto: 5 secciones + autorización, numeradas de 1 a 6', () => {
    const pasos = pasosFormulario(FICHA_POR_DEFECTO)
    expect(pasos.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6])
    expect(pasos[1].detalle).toContain('salen del código de barras')
    expect(pasos[5]).toEqual({ titulo: 'Autorización y envío', detalle: 'Siempre se pide', numero: 6 })
  })

  it('una sección con todo apagado no se muestra y no consume número', () => {
    const sinTrabajo = aplicarReglas({
      ...FICHA_POR_DEFECTO,
      campos: { ...FICHA_POR_DEFECTO.campos, ocupacion: 'apagado', negocio_empresa: 'apagado', direccion_trabajo: 'apagado', ingresos: 'apagado', foto_fachada: 'apagado' },
    })
    const pasos = pasosFormulario(sinTrabajo)
    expect(pasos[3]).toEqual({ titulo: 'Trabajo', detalle: 'Apagado: no se muestra', numero: null })
    expect(pasos.map((p) => p.numero)).toEqual([1, 2, 3, null, 4, 5])
  })
})
