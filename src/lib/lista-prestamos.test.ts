import { describe, expect, it } from 'vitest'
import { separarPrestamos } from './lista-prestamos'

const p = (id: string, estado: string) => ({ id, estado })

describe('separarPrestamos', () => {
  const lista = [p('a', 'activo'), p('b', 'pagado'), p('c', 'en_mora'), p('d', 'activo'), p('e', 'cancelado'), p('f', 'en_mora')]

  it('por cobrar: activos y en mora, con la mora primero y el resto en su orden', () => {
    expect(separarPrestamos(lista).porCobrar.map((x) => x.id)).toEqual(['c', 'f', 'a', 'd'])
  })
  it('pagados: pagados y cancelados, en su orden', () => {
    expect(separarPrestamos(lista).pagados.map((x) => x.id)).toEqual(['b', 'e'])
  })
  it('no modifica la lista original', () => {
    const copia = lista.map((x) => x.id)
    separarPrestamos(lista)
    expect(lista.map((x) => x.id)).toEqual(copia)
  })
  it('lista vacía', () => {
    expect(separarPrestamos([])).toEqual({ porCobrar: [], pagados: [] })
  })
})
