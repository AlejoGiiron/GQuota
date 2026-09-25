import { describe, expect, it } from 'vitest'
import type { CuotaDB, Movimiento, Prestamo } from '@/types/db'
import { calcularCobrosHoy, calcularVencidos } from './cartera'

// Préstamos y cuotas mínimos, con datos inventados.
function prestamo(parcial: Partial<Prestamo>): Prestamo {
  return {
    id: 'p1', user_id: 'u', cliente_id: 'c', capital_inicial: 1_000_000, saldo_capital: 1_000_000, tasa_mensual: 0.1,
    modo_interes: 'sobre_saldo', fecha_desembolso: '2026-09-25', dia_cobro: null, estado: 'activo', notas: null,
    created_at: '2026-09-25T15:00:00Z', interes_pendiente: 100_000, ultimo_devengo: '2026-09-25', tipo: 'abierto',
    codeudor_nombre: null, codeudor_telefono: null, codeudor_documento: null, valor_cuota: null, negocio_id: 'n',
    cobrador_id: null, regla_mora: 2,
    ...parcial,
  } as Prestamo
}
function pago(fecha: string, prestamoId = 'p1'): Movimiento {
  return { id: `m-${fecha}`, prestamo_id: prestamoId, fecha, tipo: 'interes', monto_total: 100_000, monto_interes: 100_000, monto_capital: 0 } as Movimiento
}
function cuota(fechaVence: string, prestamoId = 'p1'): CuotaDB {
  return { id: `q-${fechaVence}`, prestamo_id: prestamoId, numero: 1, fecha_vence: fechaVence, capital: 250_000, interes: 25_000, estado: 'pendiente', abonado: 0 } as CuotaDB
}
const dia = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 10, 0)
}
const vencido = (p: Prestamo, hoy: string, movs: Movimiento[] = [], cuotas: CuotaDB[] = []) =>
  calcularVencidos([p], movs, cuotas, dia(hoy)).length === 1
const cobroHoy = (p: Prestamo, hoy: string, movs: Movimiento[] = [], cuotas: CuotaDB[] = []) =>
  calcularCobrosHoy([p], movs, cuotas, dia(hoy)).items.length === 1

describe('abierto de regla 2 (préstamos nuevos, migración 040)', () => {
  const p = prestamo({ fecha_desembolso: '2026-09-25', regla_mora: 2 })

  it('el día que se crea no aparece como cobro de hoy', () => {
    expect(cobroHoy(p, '2026-09-25')).toBe(false)
  })
  it('del día siguiente a fin de mes NO sale vencido (el primer cobro es el mes siguiente)', () => {
    for (const d of ['2026-09-26', '2026-09-28', '2026-09-30']) expect(vencido(p, d)).toBe(false)
  })
  it('el mes siguiente: cobro de hoy el día de cobro', () => {
    expect(cobroHoy(p, '2026-10-25')).toBe(true)
  })
  it('el mes siguiente: vencido si pasa el día de cobro sin pago', () => {
    expect(vencido(p, '2026-10-26')).toBe(true)
  })
  it('el mes siguiente: no vencido si pagó el interés', () => {
    expect(vencido(p, '2026-10-27', [pago('2026-10-25')])).toBe(false)
  })
  it('desembolso el 31: en un mes corto el cobro (día 28/30) cuenta', () => {
    const p31 = prestamo({ fecha_desembolso: '2026-01-31', regla_mora: 2 })
    expect(vencido(p31, '2026-01-31')).toBe(false)
    expect(cobroHoy(p31, '2026-02-28')).toBe(true)
    expect(cobroHoy(p31, '2026-03-31')).toBe(true) // en marzo el cobro es el 31
  })
})

describe('abierto de regla 1 (los que ya existían): igual que antes', () => {
  const p = prestamo({ fecha_desembolso: '2026-09-25', regla_mora: 1 })
  it('se calcula como antes: cobro de hoy el día de creación y vencido desde el día siguiente', () => {
    expect(cobroHoy(p, '2026-09-25')).toBe(true)
    expect(vencido(p, '2026-09-26')).toBe(true)
  })
})

describe('cuotas y cuota fija: por su próxima cuota, con cualquier regla', () => {
  for (const tipo of ['cuotas', 'cuota_fija'] as const) {
    for (const regla_mora of [1, 2]) {
      it(`${tipo}, regla ${regla_mora}: vencido solo si la próxima cuota ya pasó`, () => {
        const p = prestamo({ tipo, regla_mora, fecha_desembolso: '2026-09-25' })
        expect(vencido(p, '2026-09-26', [], [cuota('2026-10-02')])).toBe(false)
        expect(vencido(p, '2026-10-03', [], [cuota('2026-10-02')])).toBe(true)
        expect(cobroHoy(p, '2026-10-02', [], [cuota('2026-10-02')])).toBe(true)
      })
    }
  }
})
