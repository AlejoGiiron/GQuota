import { describe, expect, it } from 'vitest'
import type { CamposCedula } from './cedula'
import {
  camposCorregidos,
  compararConCedula,
  formatearCedula,
  mismoValor,
  normalizarTexto,
  origenDe,
  valorVisible,
} from './revision'

// Datos inventados (cédula sintética de las pruebas).
const leidos: CamposCedula = {
  cedula: '1000000089',
  apellidos: 'PRUEBA SINTÉTICA',
  nombres: 'ANA MARÍA',
  sexo: 'F',
  fecha_nacimiento: '1990-01-15',
  rh: 'O+',
}
const enviados = { cedula: '1000000089', nombres: 'Ana María', apellidos: 'Prueba Sintetica', fecha_nacimiento: '1990-01-15' }

describe('compararConCedula', () => {
  it('coincide aunque cambien mayúsculas, tildes y espacios: verificado', () => {
    expect(compararConCedula({ ...enviados, apellidos: '  prueba   sintética ' }, leidos)).toEqual({ resultado: 'verificado', distintos: {} })
  })
  it('una cédula distinta es discrepancia, con el valor leído', () => {
    const r = compararConCedula({ ...enviados, cedula: '1000000090' }, leidos)
    expect(r.resultado).toBe('discrepancia')
    expect(r.distintos).toEqual({ cedula: '1000000089' })
  })
  it('nombre y fecha distintos también se marcan', () => {
    const r = compararConCedula({ ...enviados, nombres: 'Ana', fecha_nacimiento: '1991-01-15' }, leidos)
    expect(Object.keys(r.distintos).sort()).toEqual(['fecha_nacimiento', 'nombres'])
  })
  it('sin fecha enviada (campo apagado) no hay discrepancia por la fecha', () => {
    const { cedula, nombres, apellidos } = enviados
    expect(compararConCedula({ cedula, nombres, apellidos }, leidos).resultado).toBe('verificado')
  })
  it('sin lectura (no hay respaldo o no se pudo leer): sin verificar', () => {
    expect(compararConCedula(enviados, null)).toEqual({ resultado: 'sin_verificar', distintos: {} })
  })
})

describe('origenDe (igual que aprobar_solicitud)', () => {
  it('lo que corrige el dueño gana sobre todo', () => {
    expect(origenDe('cedula', '1000000089', '1000000080', 'verificado', null)).toBe('dueno')
    expect(origenDe('barrio', 'Centro', 'Centro Sur', null, null)).toBe('dueno')
  })
  it('datos de la cédula según la relectura', () => {
    expect(origenDe('nombres', 'ANA', 'ANA', 'verificado', null)).toBe('cedula')
    expect(origenDe('cedula', '1', '1', 'discrepancia', { cedula: '2' })).toBe('discrepancia')
    expect(origenDe('nombres', 'ANA', 'ANA', 'discrepancia', { cedula: '2' })).toBe('cedula')
    expect(origenDe('fecha_nacimiento', '1990-01-15', '1990-01-15', 'sin_verificar', null)).toBe('sin_verificar')
    expect(origenDe('fecha_nacimiento', '1990-01-15', '1990-01-15', null, null)).toBe('sin_verificar')
  })
  it('el resto lo escribió el prospecto y el celular viene del enlace', () => {
    expect(origenDe('direccion_casa', 'Calle 1', 'Calle 1', 'verificado', null)).toBe('prospecto')
    expect(origenDe('celular', '573000000000', '573000000000', null, null)).toBe('enlace')
  })
})

describe('correcciones', () => {
  it('mismoValor compara referencias sin importar el orden de las llaves', () => {
    expect(mismoValor({ nombre: 'A', telefono: '1', parentesco: 'x' }, { parentesco: 'x', nombre: 'A', telefono: '1' })).toBe(true)
    expect(mismoValor('', undefined)).toBe(true)
  })
  it('camposCorregidos lista solo lo que cambió', () => {
    expect(camposCorregidos({ ...enviados, barrio: 'Centro' }, { ...enviados, barrio: 'Norte' })).toEqual(['barrio'])
    expect(camposCorregidos(enviados, { ...enviados })).toEqual([])
  })
})

describe('formatos', () => {
  it('cédula con puntos de mil', () => {
    expect(formatearCedula('1000000089')).toBe('1.000.000.089')
    expect(formatearCedula('12345')).toBe('12.345')
  })
  it('valores legibles', () => {
    expect(valorVisible('fecha_nacimiento', '1990-01-15')).toBe('15/01/1990')
    expect(valorVisible('tipo_vivienda', 'arriendo')).toBe('Arriendo')
    expect(valorVisible('ingresos', '1800000')).toBe('$1.800.000 al mes')
    expect(valorVisible('celular', '573000000019')).toBe('300 000 0019')
    expect(valorVisible('referencia_1', { nombre: 'Martha Ruiz', telefono: '3000000027', parentesco: 'hermana' })).toBe(
      'Martha Ruiz · 300 000 0027 · hermana',
    )
    expect(valorVisible('sexo', 'F')).toBe('Femenino')
    expect(valorVisible('barrio', '')).toBe('')
  })
  it('normalizarTexto', () => {
    expect(normalizarTexto('  José   Ñoño ')).toBe('JOSE NONO')
  })
})
