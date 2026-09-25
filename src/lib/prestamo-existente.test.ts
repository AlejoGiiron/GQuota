import { describe, expect, it } from 'vitest'
import {
  avisoAbierto,
  avisoCuotas,
  cobrosPasados,
  esExistente,
  hoyColombia,
  interesPendienteAbierto,
  mesesEntre,
  proximoCobro,
  resumenAbierto,
  resumenCuotas,
  sumarDias,
  sumarMeses,
  textoHistorial,
  type CuotaPrevista,
  type DatosAbierto,
} from './prestamo-existente'

describe('fechas', () => {
  it('hoy en Colombia: a las 8 p. m. de Colombia la fecha UTC ya es mañana, la de Colombia no', () => {
    expect(hoyColombia(new Date('2026-09-26T01:00:00Z'))).toBe('2026-09-25')
    expect(hoyColombia(new Date('2026-09-26T08:10:00Z'))).toBe('2026-09-26')
  })
  it('sumar meses con tope a fin de mes, como Postgres', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2026-01-31', 2)).toBe('2026-03-31')
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(sumarMeses('2026-11-15', 3)).toBe('2027-02-15')
  })
  it('sumar días y meses entre fechas', () => {
    expect(sumarDias('2026-09-28', 5)).toBe('2026-10-03')
    expect(mesesEntre('2026-06-20', '2026-09-25')).toBe(3)
    expect(mesesEntre('2026-09-01', '2026-09-30')).toBe(0)
    expect(mesesEntre('2025-12-31', '2026-01-01')).toBe(1)
  })
})

describe('abierto: cobros', () => {
  it('cobros pasados, del más reciente al más antiguo, incluido el de hoy', () => {
    expect(cobrosPasados('2026-06-20', '2026-09-25')).toEqual(['2026-09-20', '2026-08-20', '2026-07-20'])
    expect(cobrosPasados('2026-06-20', '2026-09-20')).toEqual(['2026-09-20', '2026-08-20', '2026-07-20'])
    expect(cobrosPasados('2026-06-20', '2026-09-19')).toEqual(['2026-08-20', '2026-07-20'])
  })
  it('sin cobros todavía si el primero es el mes siguiente', () => {
    expect(cobrosPasados('2026-09-10', '2026-09-25')).toEqual([])
    expect(proximoCobro('2026-09-10', '2026-09-25')).toBe('2026-10-10')
  })
  it('fin de mes: el cobro del 31 cae el último día de los meses cortos', () => {
    expect(cobrosPasados('2026-01-31', '2026-04-30')).toEqual(['2026-04-30', '2026-03-31', '2026-02-28'])
  })
  it('próximo cobro después de hoy', () => {
    expect(proximoCobro('2026-06-20', '2026-09-25')).toBe('2026-10-20')
    expect(proximoCobro('2026-06-20', '2026-09-20')).toBe('2026-10-20')
  })
})

// Los mismos casos del ensayo SQL de la migración 041 (casos F, G, H, I).
const base: DatosAbierto = {
  capital: 1_000_000, saldo: 800_000, tasa: 0.1, modo: 'sobre_saldo',
  fechaDesembolso: '2026-06-20', pagadoHasta: '2026-09-20', hoy: '2026-09-25',
}

describe('abierto: interés pendiente (misma cuenta que crear_prestamo_existente)', () => {
  it('al día: solo el periodo del próximo cobro', () => {
    expect(interesPendienteAbierto(base)).toBe(80_000)
  })
  it('debe el cobro de este mes: dos periodos', () => {
    expect(interesPendienteAbierto({ ...base, pagadoHasta: '2026-08-20' })).toBe(160_000)
  })
  it('sin cobros pagados: el primero sobre el capital y los demás sobre el saldo', () => {
    expect(interesPendienteAbierto({ ...base, pagadoHasta: null })).toBe(340_000)
  })
  it('fijo sobre el monto: sobre el capital prestado', () => {
    expect(interesPendienteAbierto({ ...base, modo: 'sobre_capital_inicial' })).toBe(100_000)
  })
  it('desembolso este mes: el periodo que carga la creación', () => {
    expect(interesPendienteAbierto({ ...base, fechaDesembolso: '2026-09-10', pagadoHasta: null })).toBe(100_000)
  })
  it('un préstamo normal al día desde el 1.º hasta su cobro lleva dos periodos (el del mes ya devengado)', () => {
    expect(interesPendienteAbierto({ ...base, hoy: '2026-10-05' })).toBe(160_000)
  })
})

describe('abierto: resumen y mora (regla 2)', () => {
  it('al día: sin mora ni cobros sin pagar', () => {
    const r = resumenAbierto(base)
    expect(r).toMatchObject({ enMora: false, cobrosSinPagar: [], abonadoCapital: 200_000, proximoCobro: '2026-10-20' })
  })
  it('debe el cobro de este mes, que ya pasó: en mora', () => {
    const r = resumenAbierto({ ...base, pagadoHasta: '2026-08-20' })
    expect(r.enMora).toBe(true)
    expect(r.cobrosSinPagar).toEqual(['2026-09-20'])
  })
  it('el cobro de hoy sin pagar todavía no es mora', () => {
    const r = resumenAbierto({ ...base, pagadoHasta: '2026-08-20', hoy: '2026-09-20' })
    expect(r.enMora).toBe(false)
    expect(r.cobrosSinPagar).toEqual([])
  })
  it('debe un cobro del mes pasado y el de este mes aún no llega: no es mora (regla mensual), pero se avisa', () => {
    const r = resumenAbierto({ ...base, pagadoHasta: '2026-07-20', hoy: '2026-09-10' })
    expect(r.enMora).toBe(false)
    expect(r.cobrosSinPagar).toEqual(['2026-08-20'])
  })
  it('sin cobros pagados: todos quedan sin pagar', () => {
    expect(resumenAbierto({ ...base, pagadoHasta: null }).cobrosSinPagar).toEqual(['2026-07-20', '2026-08-20', '2026-09-20'])
  })
})

describe('cuotas y cuota fija: resumen', () => {
  // Cuota fija semanal de 30.000 desde el 26/08 (caso C del ensayo): vencen 02/09, 09/09, 16/09, 23/09, 30/09…
  const fija: CuotaPrevista[] = Array.from({ length: 10 }, (_, i) => ({ numero: i + 1, fecha: sumarDias('2026-08-26', 7 * (i + 1)), valor: 30_000 }))
  const hoy = '2026-09-25'

  it('4 pagadas y abono a la 5.ª: al día', () => {
    expect(resumenCuotas(fija, 4, 10_000, hoy)).toEqual({
      pagadoAntes: 130_000, cuotasRestantes: 6, saldo: 170_000,
      proxima: { numero: 5, fecha: '2026-09-30', falta: 20_000 },
      atraso: 'al_dia', diasAtraso: 0, cuotasAtrasadas: 0,
    })
  })
  it('2 pagadas: la del 16/09 tiene 9 días de atraso → mora', () => {
    const r = resumenCuotas(fija, 2, 0, hoy)
    expect(r).toMatchObject({ pagadoAntes: 60_000, saldo: 240_000, atraso: 'mora', diasAtraso: 9, cuotasAtrasadas: 2 })
    expect(r.proxima).toEqual({ numero: 3, fecha: '2026-09-16', falta: 30_000 })
  })
  it('3 pagadas: la del 23/09 tiene 2 días → vencida, todavía no mora', () => {
    expect(resumenCuotas(fija, 3, 0, hoy)).toMatchObject({ atraso: 'vencida', diasAtraso: 2, cuotasAtrasadas: 1 })
  })
  it('5 días de atraso todavía no es mora; 6 sí', () => {
    expect(resumenCuotas(fija, 3, 0, '2026-09-28').atraso).toBe('vencida')
    expect(resumenCuotas(fija, 3, 0, '2026-09-29').atraso).toBe('mora')
  })
  it('cuotas pactadas: lo pagado es la suma de las primeras N', () => {
    const cuotas: CuotaPrevista[] = [
      { numero: 1, fecha: '2026-07-22', valor: 260_000 },
      { numero: 2, fecha: '2026-08-22', valor: 260_000 },
      { numero: 3, fecha: '2026-09-22', valor: 270_000 },
    ]
    expect(resumenCuotas(cuotas, 2, 0, hoy)).toMatchObject({ pagadoAntes: 520_000, saldo: 270_000, cuotasRestantes: 1, atraso: 'vencida' })
  })
})

describe('aviso antes de guardar', () => {
  const fija: CuotaPrevista[] = Array.from({ length: 10 }, (_, i) => ({ numero: i + 1, fecha: sumarDias('2026-08-26', 7 * (i + 1)), valor: 30_000 }))
  const hoy = '2026-09-25'

  it('cuotas al día', () => {
    expect(avisoCuotas(resumenCuotas(fija, 4, 10_000, hoy), 10_000)).toEqual({ tono: 'ok', texto: 'Queda al día.' })
  })
  it('cuota vencida sin llegar a mora', () => {
    expect(avisoCuotas(resumenCuotas(fija, 3, 0, hoy), 0)).toEqual({
      tono: 'atraso',
      texto: 'La cuota N.º 4 del 23/09/2026 queda sin pagar: sale en Cobros como vencida y el préstamo entra en mora si pasan más de 5 días.',
    })
  })
  it('mora, con abono y varias atrasadas', () => {
    expect(avisoCuotas(resumenCuotas(fija, 2, 5_000, hoy), 5_000)).toEqual({
      tono: 'mora',
      texto: 'La cuota N.º 3 del 16/09/2026 queda sin completar y tiene 9 días de atraso: el préstamo entra en mora. En total quedan 2 cuotas atrasadas.',
    })
  })
  it('abierto al día', () => {
    expect(avisoAbierto(resumenAbierto(base))).toEqual({ tono: 'ok', texto: 'Queda al día.' })
  })
  it('abierto en mora', () => {
    expect(avisoAbierto(resumenAbierto({ ...base, pagadoHasta: '2026-08-20' }))).toEqual({
      tono: 'mora',
      texto: 'El cobro del 20/09/2026 queda sin pagar: el préstamo entra en mora.',
    })
    expect(avisoAbierto(resumenAbierto({ ...base, pagadoHasta: null })).texto).toBe(
      'El cobro del 20/09/2026 queda sin pagar: el préstamo entra en mora. En total quedan 3 cobros de interés sin pagar; el interés pendiente los incluye.',
    )
  })
  it('abierto con un cobro del mes pasado sin pagar, sin mora todavía', () => {
    expect(avisoAbierto(resumenAbierto({ ...base, pagadoHasta: '2026-07-20', hoy: '2026-09-10' }))).toEqual({
      tono: 'atraso',
      texto: 'Queda 1 cobro de interés sin pagar (desde el 20/08/2026); el interés pendiente lo incluye.',
    })
  })
})

describe('ficha: línea de historial', () => {
  const p = { tipo: 'cuotas', cuotas_pagadas_antes: 3, pagado_antes: 780_000, interes_pagado_hasta: null, valor_cuota: null }

  it('préstamos normales: sin línea', () => {
    expect(textoHistorial({ ...p, cuotas_pagadas_antes: null, pagado_antes: null })).toBeNull()
    expect(esExistente({ cuotas_pagadas_antes: null })).toBe(false)
    expect(esExistente({ cuotas_pagadas_antes: 0 })).toBe(true)
  })
  it('cuotas pactadas', () => {
    expect(textoHistorial(p)).toBe('Cargado con historial: pagó 3 cuotas ($780.000) antes de registrarlo en la app.')
    expect(textoHistorial({ ...p, cuotas_pagadas_antes: 1, pagado_antes: 260_000 })).toBe(
      'Cargado con historial: pagó 1 cuota ($260.000) antes de registrarlo en la app.',
    )
    expect(textoHistorial({ ...p, cuotas_pagadas_antes: 0, pagado_antes: 0 })).toBe(
      'Cargado con historial: sin cuotas pagadas antes de registrarlo en la app.',
    )
  })
  it('cuota fija con y sin abono', () => {
    const f = { ...p, tipo: 'cuota_fija', valor_cuota: 30_000 }
    expect(textoHistorial({ ...f, cuotas_pagadas_antes: 4, pagado_antes: 130_000 })).toBe(
      'Cargado con historial: pagó 4 cuotas y abonó $10.000 a la siguiente ($130.000 en total) antes de registrarlo en la app.',
    )
    expect(textoHistorial({ ...f, cuotas_pagadas_antes: 0, pagado_antes: 5_000 })).toBe(
      'Cargado con historial: abonó $5.000 a la primera cuota ($5.000 en total) antes de registrarlo en la app.',
    )
    expect(textoHistorial({ ...f, cuotas_pagadas_antes: 2, pagado_antes: 60_000 })).toBe(
      'Cargado con historial: pagó 2 cuotas ($60.000) antes de registrarlo en la app.',
    )
  })
  it('abierto', () => {
    const a = { ...p, tipo: 'abierto', cuotas_pagadas_antes: 3, pagado_antes: 200_000, interes_pagado_hasta: '2026-09-20' }
    expect(textoHistorial(a)).toBe(
      'Cargado con historial: intereses pagados hasta el 20/09/2026 y $200.000 abonados a capital antes de registrarlo en la app.',
    )
    expect(textoHistorial({ ...a, pagado_antes: 0 })).toBe(
      'Cargado con historial: intereses pagados hasta el 20/09/2026 antes de registrarlo en la app.',
    )
    expect(textoHistorial({ ...a, cuotas_pagadas_antes: 0, interes_pagado_hasta: null, pagado_antes: 0 })).toBe(
      'Cargado con historial: sin cobros de interés pagados antes de registrarlo en la app.',
    )
  })
})
