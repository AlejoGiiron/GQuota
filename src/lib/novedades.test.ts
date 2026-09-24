import { describe, expect, it } from 'vitest'
import {
  CONTACTO_SOPORTE,
  VERSION_NOVEDADES,
  mananaTemprano,
  pasosDe,
  seAbreSola,
  type PantallaGuia,
  type RolGuia,
} from './novedades'

const ahora = new Date(2026, 9, 1, 15, 30) // 1 de octubre de 2026, 3:30 p. m.
const fila = (estado: string, mostrarDesde: Date) => ({
  version: VERSION_NOVEDADES,
  estado,
  mostrar_desde: mostrarDesde.toISOString(),
})

describe('seAbreSola', () => {
  it('pendiente y con la fecha cumplida: se abre', () => {
    expect(seAbreSola(fila('pendiente', new Date(2026, 8, 30)), ahora)).toBe(true)
  })
  it('"Ver después" la corre a mañana: hoy no se abre', () => {
    expect(seAbreSola(fila('pendiente', mananaTemprano(ahora)), ahora)).toBe(false)
  })
  it('vista: no se abre nunca', () => {
    expect(seAbreSola(fila('vista', new Date(2026, 8, 30)), ahora)).toBe(false)
  })
  it('sin fila (usuario creado después de la versión): no se abre', () => {
    expect(seAbreSola(null, ahora)).toBe(false)
  })
})

describe('mananaTemprano', () => {
  it('es el día siguiente a las 00:00, en la hora local', () => {
    const m = mananaTemprano(ahora)
    expect([m.getFullYear(), m.getMonth(), m.getDate(), m.getHours(), m.getMinutes()]).toEqual([2026, 9, 2, 0, 0])
  })
  it('cruza fin de mes', () => {
    const m = mananaTemprano(new Date(2026, 9, 31, 23, 59))
    expect([m.getMonth(), m.getDate()]).toEqual([10, 1])
  })
})

describe('pasos de la guía diseno-2a', () => {
  const combinaciones: Array<[RolGuia, PantallaGuia, number]> = [
    ['dueno', 'celular', 4],
    ['dueno', 'computador', 4],
    ['cobrador', 'celular', 3],
    ['cobrador', 'computador', 3],
  ]

  it.each(combinaciones)('%s en %s: %i pasos, cortos y con texto', (rol, pantalla, n) => {
    const pasos = pasosDe(VERSION_NOVEDADES, rol, pantalla)
    expect(pasos).toHaveLength(n)
    for (const p of pasos) {
      expect(p.titulo.length).toBeGreaterThan(0)
      expect(p.parrafos.length).toBeGreaterThan(0)
    }
  })

  it.each(combinaciones)('%s en %s: el primer paso dice que las imágenes se ven igual', (rol, pantalla) => {
    const [primero] = pasosDe(VERSION_NOVEDADES, rol, pantalla)
    expect(primero.parrafos.join(' ')).toContain(
      'Las imágenes que les envía a sus clientes (comprobantes y cronogramas) se ven igual que antes.',
    )
  })

  it.each(combinaciones)('%s en %s: el último paso trae el contacto y dónde volver a verla', (rol, pantalla) => {
    const pasos = pasosDe(VERSION_NOVEDADES, rol, pantalla)
    const cierre = pasos[pasos.length - 1].parrafos.join(' ')
    expect(cierre).toContain(CONTACTO_SOPORTE)
    expect(cierre).toContain('«Novedades»')
  })

  it('el menú cambia de texto según la pantalla', () => {
    const celular = pasosDe(VERSION_NOVEDADES, 'dueno', 'celular')[1].parrafos.join(' ')
    const computador = pasosDe(VERSION_NOVEDADES, 'dueno', 'computador')[1].parrafos.join(' ')
    expect(celular).toContain('Abajo siguen Inicio, Clientes, Préstamos y Cobros')
    expect(computador).toContain('abajo a la izquierda')
  })

  it('el cobrador no ve Inicio, Equipo ni Configuración en su guía', () => {
    for (const pantalla of ['celular', 'computador'] as const) {
      const texto = pasosDe(VERSION_NOVEDADES, 'cobrador', pantalla)
        .flatMap((p) => p.parrafos)
        .join(' ')
      expect(texto).not.toMatch(/Inicio|Equipo|Configuración/)
    }
  })

  it('una versión desconocida no tiene pasos', () => {
    expect(pasosDe('no-existe', 'dueno', 'celular')).toEqual([])
  })
})
