import { describe, expect, it } from 'vitest'
import { dimensionesReducidas } from './imagen'

describe('dimensionesReducidas', () => {
  it('lleva el lado mayor a 1600 conservando la proporción', () => {
    expect(dimensionesReducidas(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 })
    expect(dimensionesReducidas(3000, 4000)).toEqual({ ancho: 1200, alto: 1600 })
  })

  it('nunca agranda una foto pequeña', () => {
    expect(dimensionesReducidas(1200, 800)).toEqual({ ancho: 1200, alto: 800 })
  })
})
