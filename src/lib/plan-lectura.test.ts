import { describe, expect, it } from 'vitest'
import { LADO_MAXIMO_INTENTO, cajaConMargen, planDeLectura } from './plan-lectura'

describe('planDeLectura', () => {
  it('empieza con la imagen tal cual y el binarizador de siempre', () => {
    expect(planDeLectura(1600, 1018)[0]).toEqual({ grados: 0, escala: 1, prep: 'color', binarizador: 'LocalAverage' })
  })

  it('foto de WhatsApp (1600 px): la amplía ×1,5, ×1,25 y ×2 antes de girar', () => {
    const plan = planDeLectura(1600, 1018)
    const rectas = plan.filter((i) => i.grados === 0 && !i.recorte).map((i) => i.escala)
    expect([...new Set(rectas)]).toEqual([1, 1.5, 1.25, 2])
    const primerGiro = plan.findIndex((i) => i.grados !== 0)
    expect(plan.slice(0, primerGiro).some((i) => i.escala === 2)).toBe(true)
  })

  it('foto de cámara (4000 px): resolución completa y reducida a 2400, sin ampliar', () => {
    const plan = planDeLectura(4000, 3000)
    const rectas = [...new Set(plan.filter((i) => i.grados === 0 && !i.recorte).map((i) => i.escala))]
    expect(rectas).toEqual([1, 0.6])
  })

  it('nunca amplía más allá del lado máximo (la resolución completa sí se prueba)', () => {
    for (const [w, h] of [[800, 600], [1600, 1018], [2400, 1800], [4000, 3000], [3000, 4000]]) {
      for (const i of planDeLectura(w, h).filter((x) => !x.recorte && x.escala > 1)) {
        expect(Math.max(w, h) * i.escala).toBeLessThanOrEqual(LADO_MAXIMO_INTENTO)
      }
    }
  })

  it('incluye recortes del código detectado y giros de ±2 a ±12°', () => {
    const plan = planDeLectura(1600, 1018)
    expect(plan.some((i) => i.recorte)).toBe(true)
    expect([...new Set(plan.map((i) => i.grados))].sort((a, b) => a - b)).toEqual([-12, -8, -4, -2, 0, 2, 4, 8, 12])
  })

  it('cabe en unos segundos: no más de 60 intentos', () => {
    expect(planDeLectura(1600, 1018).length).toBeLessThanOrEqual(60)
    expect(planDeLectura(4000, 3000).length).toBeLessThanOrEqual(60)
  })
})

describe('cajaConMargen', () => {
  it('agrega margen y no se sale de la imagen', () => {
    const c = cajaConMargen([{ x: 100, y: 400 }, { x: 1400, y: 400 }, { x: 100, y: 620 }, { x: 1400, y: 620 }], 1600, 1018)!
    expect(c.x).toBeLessThan(100)
    expect(c.x + c.ancho).toBeGreaterThan(1400)
    expect(c.x + c.ancho).toBeLessThanOrEqual(1600)
    expect(c.y).toBeLessThan(400)
    expect(c.y + c.alto).toBeLessThanOrEqual(1018)
  })
  it('una detección diminuta no sirve', () => {
    expect(cajaConMargen([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 4 }, { x: 10, y: 4 }], 100, 100)).toBeNull()
  })
})
