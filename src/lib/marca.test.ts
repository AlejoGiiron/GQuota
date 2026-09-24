import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CONTRASTE_MINIMO_TEXTO,
  MARCA_G_QUOTA,
  TINTA_SOBRE_MARCA,
  comoTexto,
  contraste,
  mezcla,
  monograma,
  textoSobre,
  tokensDeMarca,
  type TokensDeMarca,
} from './marca'

// Valores esperados: salida de la implementación de referencia del paquete de
// diseño (design/paquete-2a/fuente/gq-comun.js → GQ.tokens) con sus marcas de prueba.
const MARCAS_DEL_PAQUETE: Array<{ nombre: string; principal: string; acento: string; esperado: TokensDeMarca }> = [
  {
    nombre: 'verde (Créditos La 14)',
    principal: '#127A3E',
    acento: '#F2B705',
    esperado: {
      '--marca': '#127A3E',
      '--marca-sobre': '#FFFFFF',
      '--marca-texto': '#127A3E',
      '--marca-suave': '#E3EFE8',
      '--acento': '#F2B705',
      '--acento-sobre': '#17150F',
      '--acento-texto': '#8F6E0A',
    },
  },
  {
    nombre: 'azul marino (Inversiones Morales)',
    principal: '#16284A',
    acento: '#D4A017',
    esperado: {
      '--marca': '#16284A',
      '--marca-sobre': '#FFFFFF',
      '--marca-texto': '#16284A',
      '--marca-suave': '#E3E5E9',
      '--acento': '#D4A017',
      '--acento-sobre': '#17150F',
      '--acento-texto': '#926F14',
    },
  },
  {
    nombre: 'amarillo (Préstamos Doña Rosa)',
    principal: '#F6C90E',
    acento: '#D6336C',
    esperado: {
      '--marca': '#F6C90E',
      '--marca-sobre': '#17150F',
      '--marca-texto': '#876F0F',
      '--marca-suave': '#FEF9E2',
      '--acento': '#D6336C',
      '--acento-sobre': '#FFFFFF',
      '--acento-texto': '#D6336C',
    },
  },
]

describe('tokensDeMarca: las tres marcas de ejemplo del paquete', () => {
  it.each(MARCAS_DEL_PAQUETE)('$nombre', ({ principal, acento, esperado }) => {
    expect(tokensDeMarca(principal, acento)).toEqual(esperado)
  })

  it('texto sobre la marca: blanco en el verde y el azul, tinta en el amarillo', () => {
    expect(textoSobre('#127A3E')).toBe('#FFFFFF')
    expect(textoSobre('#16284A')).toBe('#FFFFFF')
    expect(textoSobre('#F6C90E')).toBe(TINTA_SOBRE_MARCA)
  })

  it('el amarillo como texto se oscurece hasta 4,5:1; el verde y el azul ya cumplen y no cambian', () => {
    const amarilloTexto = comoTexto('#F6C90E')
    expect(amarilloTexto).not.toBe('#F6C90E')
    expect(contraste('#F6C90E', '#FFFFFF')).toBeLessThan(CONTRASTE_MINIMO_TEXTO)
    expect(contraste(amarilloTexto, '#FFFFFF')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_TEXTO)
    // Oscurece lo justo: es el PRIMER paso de 5 % hacia la tinta que llega a 4,5:1.
    const pasos = Array.from({ length: 20 }, (_, i) => mezcla('#F6C90E', TINTA_SOBRE_MARCA, (i + 1) * 0.05))
    const primeroQueCumple = pasos.find((x) => contraste(x, '#FFFFFF') >= CONTRASTE_MINIMO_TEXTO)
    expect(amarilloTexto).toBe(primeroQueCumple)
    expect(comoTexto('#127A3E')).toBe('#127A3E')
    expect(comoTexto('#16284A')).toBe('#16284A')
  })
})

describe('invariantes de contraste (cualquier color que elija un negocio)', () => {
  const colores = ['#127A3E', '#16284A', '#F6C90E', '#D21F3C', '#C8177A', '#00A19A', '#FFFFFF', '#000000', '#FFFF00', '#7FFFD4']

  it.each(colores)('%s: el texto sobre la marca es el de mayor contraste y la marca como texto llega a 4,5:1', (c) => {
    const sobre = textoSobre(c)
    const otro = sobre === '#FFFFFF' ? TINTA_SOBRE_MARCA : '#FFFFFF'
    expect(contraste(sobre, c)).toBeGreaterThanOrEqual(contraste(otro, c))
    expect(contraste(comoTexto(c), '#FFFFFF')).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_TEXTO)
  })

  it('acepta hex corto y minúsculas, y devuelve siempre #RRGGBB en mayúsculas', () => {
    expect(tokensDeMarca('#fff', '#127a3e')['--marca']).toBe('#FFFFFF')
    expect(tokensDeMarca('#fff', '#127a3e')['--acento']).toBe('#127A3E')
  })

  it('rechaza un color inválido en vez de calcular tokens basura', () => {
    expect(() => tokensDeMarca('verde', '#F2B705')).toThrow('Color inválido')
  })
})

describe('los valores por defecto de src/index.css salen de la función', () => {
  // La marca es fija en esta fase: si alguien cambia el verde o el ámbar a mano en
  // el CSS sin recalcular los derivados, esta prueba lo caza.
  const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')
  const esperado = tokensDeMarca(MARCA_G_QUOTA.principal, MARCA_G_QUOTA.acento)

  it.each(Object.entries(esperado))('%s = %s', (token, valor) => {
    const m = css.match(new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})\\s*;`))
    expect(m?.[1]?.toUpperCase()).toBe(valor)
  })
})

describe('monograma', () => {
  it.each([
    ['Créditos La 14', '14'],
    ['Inversiones Morales', 'IM'],
    ['Préstamos Doña Rosa', 'DR'],
    ['Créditos Ramírez', 'CR'],
    ['Multicréditos Yeni', 'MY'],
    ['G-Quota', 'GQ'],
    ['   ', '·'],
  ])('%s → %s', (nombre, esperado) => {
    expect(monograma(nombre)).toBe(esperado)
  })
})
