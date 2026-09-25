import { describe, expect, it } from 'vitest'
import { PROPORCION_CODIGO, guiaEnCuadro, intentoDeCuadro, zonaDeLectura } from './escaner'

describe('guiaEnCuadro', () => {
  it('celular en vertical (1080×1920): recuadro del código al 90 % del ancho, centrado', () => {
    const g = guiaEnCuadro(1080, 1920)
    expect(g.ancho).toBe(972)
    expect(g.ancho / g.alto).toBeCloseTo(PROPORCION_CODIGO, 1)
    expect(Math.abs(g.x + g.ancho / 2 - 540)).toBeLessThanOrEqual(1)
    expect(Math.abs(g.y + g.alto / 2 - 960)).toBeLessThanOrEqual(1)
  })
  it('cámara horizontal (1280×720): también al 90 % del ancho si cabe en el 40 % del alto', () => {
    const g = guiaEnCuadro(1280, 720)
    expect(g.ancho).toBeLessThanOrEqual(1280 * 0.9)
    expect(g.alto).toBeLessThanOrEqual(720 * 0.4 + 1)
  })
  it('llenándolo, cada módulo del código queda en ~3 px en un video de 1080 px', () => {
    // El PDF417 de la cédula tiene ~300 módulos de ancho.
    expect(guiaEnCuadro(1080, 1920).ancho / 300).toBeGreaterThanOrEqual(3)
  })
})

describe('zonaDeLectura', () => {
  it('es el recuadro con margen, dentro del cuadro', () => {
    const g = guiaEnCuadro(1080, 1920)
    const z = zonaDeLectura(1080, 1920)
    expect(z.x).toBeLessThan(g.x)
    expect(z.y).toBeLessThan(g.y)
    expect(z.alto).toBeGreaterThan(g.alto * 1.9)
    expect(z.x).toBeGreaterThanOrEqual(0)
    expect(z.x + z.ancho).toBeLessThanOrEqual(1080)
  })
})

describe('intentoDeCuadro', () => {
  it('cada 12 cuadros prueba los 3 binarizadores con y sin gris, y con y sin ampliar', () => {
    const vistos = new Set(Array.from({ length: 12 }, (_, n) => JSON.stringify(intentoDeCuadro(n))))
    expect(vistos.size).toBe(12)
  })
})
