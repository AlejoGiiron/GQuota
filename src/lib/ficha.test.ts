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
  modosPermitidos,
  pasosFormulario,
  validarCampo,
  validarEnvio,
  type FichaConfig,
} from './ficha'

const conCambios = (cambios: Partial<FichaConfig['campos']>, lectura = true): FichaConfig => ({
  ...FICHA_POR_DEFECTO,
  lectura_automatica: lectura,
  campos: { ...FICHA_POR_DEFECTO.campos, ...cambios },
})

describe('FICHA_POR_DEFECTO', () => {
  it('coincide con el valor por defecto de la migración 037 (doble fuente vigilada)', () => {
    const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/037_formulario_ficha.sql', import.meta.url)), 'utf8')
    const m = sql.match(/alter column ficha_config set default '([\s\S]*?)'::jsonb/)
    expect(m).not.toBeNull()
    expect(JSON.parse(m![1])).toEqual(FICHA_POR_DEFECTO)
  })

  it('22 campos: 13 obligatorios, 7 opcionales, 2 apagados; respaldo opcional y selfie apagada', () => {
    expect(Object.keys(FICHA_POR_DEFECTO.campos)).toHaveLength(22)
    expect(contarModos(FICHA_POR_DEFECTO)).toEqual({ obligatorio: 13, opcional: 7, apagado: 2 })
    expect(FICHA_POR_DEFECTO.campos.cedula_reverso).toBe('opcional')
    expect(FICHA_POR_DEFECTO.campos.selfie_cedula).toBe('apagado')
  })
})

describe('reglas (las mismas del CHECK de la base)', () => {
  it('fijos, frente obligatorio y selfie apagada, sin importar lo que llegue', () => {
    const r = aplicarReglas(conCambios({ nombres: 'apagado', cedula: 'opcional', cedula_frente: 'opcional', selfie_cedula: 'obligatorio' }))
    expect([r.campos.nombres, r.campos.cedula, r.campos.cedula_frente, r.campos.selfie_cedula]).toEqual(['obligatorio', 'obligatorio', 'obligatorio', 'apagado'])
    expect(bloqueo(r, 'cedula_frente')).toBe('Siempre obligatoria')
    expect(bloqueo(r, 'selfie_cedula')).toBe('Llega más adelante')
  })

  it('el respaldo nunca es obligatorio (tiene la huella): solo apagado u opcional', () => {
    expect(aplicarReglas(conCambios({ cedula_reverso: 'obligatorio' })).campos.cedula_reverso).toBe('opcional')
    expect(modosPermitidos('cedula_reverso')).toEqual(['apagado', 'opcional'])
    expect(bloqueo(FICHA_POR_DEFECTO, 'cedula_reverso')).toBeNull()
  })

  it('sin respaldo no hay lectura automática', () => {
    expect(aplicarReglas(conCambios({ cedula_reverso: 'apagado' }, true)).lectura_automatica).toBe(false)
    expect(aplicarReglas(conCambios({ cedula_reverso: 'opcional' }, true)).lectura_automatica).toBe(true)
  })

  it('leerFicha tolera datos raros y aplica las reglas', () => {
    const leida = leerFicha({ lectura_automatica: 'sí', campos: { correo: 'opcional', barrio: 'tal vez', cedula_reverso: 'obligatorio' } })
    expect(leida.lectura_automatica).toBe(true)
    expect(leida.campos.correo).toBe('opcional')
    expect(leida.campos.barrio).toBe('obligatorio')
    expect(leida.campos.cedula_reverso).toBe('opcional')
    expect(leerFicha(null)).toEqual(FICHA_POR_DEFECTO)
  })

  it('mismaFicha detecta cambios', () => {
    expect(mismaFicha(FICHA_POR_DEFECTO, leerFicha(FICHA_POR_DEFECTO))).toBe(true)
    expect(mismaFicha(FICHA_POR_DEFECTO, conCambios({ correo: 'opcional' }))).toBe(false)
  })
})

describe('pasosFormulario', () => {
  it('autorización primero, luego las secciones, y "revisar y enviar" al final', () => {
    const pasos = pasosFormulario(FICHA_POR_DEFECTO)
    expect(pasos[0].titulo).toBe('Autorización')
    expect(pasos.at(-1)?.titulo).toBe('Revisar y enviar')
    expect(pasos.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('una sección con todo apagado no se muestra y no consume número', () => {
    const sinTrabajo = conCambios({ ocupacion: 'apagado', negocio_empresa: 'apagado', direccion_trabajo: 'apagado', ingresos: 'apagado', foto_fachada: 'apagado' })
    const trabajo = pasosFormulario(sinTrabajo).find((p) => p.titulo === 'Trabajo')
    expect(trabajo).toEqual({ titulo: 'Trabajo', detalle: 'Apagado: no se muestra', numero: null })
  })
})

describe('validarCampo', () => {
  it.each([
    ['cedula', '1.000.000.089', '1000000089'],
    ['telefono_alterno', '+57 300 000 0010', '3000000010'],
    ['correo', ' Ana@Ejemplo.COM ', 'ana@ejemplo.com'],
    ['ingresos', '1.800.000', '1800000'],
    ['nombres', '  ana   maría ', 'ana maría'],
  ] as const)('%s: "%s" → "%s"', (campo, entrada, esperado) => {
    expect(validarCampo(campo, entrada)).toEqual([esperado, null])
  })

  it.each([
    ['cedula', '12'],
    ['nombres', 'Ana2'],
    ['fecha_nacimiento', '2099-01-01'],
    ['fecha_nacimiento', '1990-02-31'],
    ['correo', 'ana@'],
    ['tipo_vivienda', 'hotel'],
  ] as const)('%s rechaza "%s"', (campo, entrada) => {
    expect(validarCampo(campo, entrada)[1]).not.toBeNull()
  })
})

describe('validarEnvio (servidor y navegador)', () => {
  const datos = {
    cedula: '1000000089', nombres: 'Ana', apellidos: 'Prueba', direccion_casa: 'Cl. 1 # 2-3', barrio: 'Centro', ciudad: 'Cali',
    tipo_vivienda: 'propia', ocupacion: 'Independiente', negocio_empresa: 'Tienda', direccion_trabajo: 'Cl. 4 # 5-6',
    referencia_1: { nombre: 'Luz Prueba', telefono: '3000000088', parentesco: 'Hermana' },
  }

  it('acepta un envío completo y normaliza', () => {
    const r = validarEnvio(FICHA_POR_DEFECTO, { ...datos, cedula: '1.000.000.089' }, {}, false)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos.cedula).toBe('1000000089')
  })

  it('exige los obligatorios y descarta los apagados', () => {
    const r = validarEnvio(FICHA_POR_DEFECTO, { ...datos, barrio: '', correo: 'no@pedido.com' }, {}, false)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores).toEqual({ barrio: 'Este dato es obligatorio.' })
    const ok = validarEnvio(FICHA_POR_DEFECTO, { ...datos, correo: 'no@pedido.com' }, {}, false)
    expect(ok.ok && 'correo' in ok.datos).toBe(false)
  })

  it('valida las referencias: la 1 obligatoria, la 2 opcional pero completa si se llena', () => {
    const sinRef = validarEnvio(FICHA_POR_DEFECTO, { ...datos, referencia_1: undefined }, {}, false)
    expect(!sinRef.ok && sinRef.errores['referencia_1.nombre']).toBeTruthy()
    const refIncompleta = validarEnvio(FICHA_POR_DEFECTO, { ...datos, referencia_2: { nombre: 'Pedro' } }, {}, false)
    expect(!refIncompleta.ok && refIncompleta.errores['referencia_2.telefono']).toBeTruthy()
  })

  it('origen: con respaldo respeta lo leído; sin respaldo todo es manual y no hay sexo/RH', () => {
    const origen = { cedula: 'cedula', nombres: 'cedula', apellidos: 'manual', sexo: 'cedula', rh: 'cedula' }
    const conRespaldo = validarEnvio(FICHA_POR_DEFECTO, { ...datos, sexo: 'F', rh: 'O+' }, origen, true)
    expect(conRespaldo.ok && conRespaldo.origen).toEqual({ cedula: 'cedula', nombres: 'cedula', apellidos: 'manual', sexo: 'cedula', rh: 'cedula' })
    const sinRespaldo = validarEnvio(FICHA_POR_DEFECTO, { ...datos, sexo: 'F', rh: 'O+' }, origen, false)
    expect(sinRespaldo.ok && sinRespaldo.origen).toEqual({ cedula: 'manual', nombres: 'manual', apellidos: 'manual' })
    expect(sinRespaldo.ok && ('sexo' in sinRespaldo.datos || 'rh' in sinRespaldo.datos)).toBe(false)
  })

  it('no acepta sexo ni RH escritos a mano', () => {
    const r = validarEnvio(FICHA_POR_DEFECTO, { ...datos, sexo: 'M', rh: 'A+' }, { sexo: 'manual', rh: 'manual' }, true)
    expect(r.ok && ('sexo' in r.datos || 'rh' in r.datos)).toBe(false)
  })
})
