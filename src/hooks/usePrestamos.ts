import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  aplicarPago,
  type FrecuenciaCuota,
  type ModoInteres,
  type ResultadoPago,
} from '@/lib/motor-prestamos'
import type { Prestamo } from '@/types/db'

/** Construye el préstamo del motor a partir de la fila de la BD. */
export function prestamoDelMotor(p: Prestamo) {
  return {
    capitalInicial: p.capital_inicial,
    saldoCapital: p.saldo_capital,
    tasaMensual: p.tasa_mensual,
    modoInteres: p.modo_interes as ModoInteres,
    interesPendiente: p.interes_pendiente,
  }
}

/** Tipo del movimiento según el desglose: 'interes' si no abonó capital, 'cuota' si sí. */
export function tipoMovimiento(resultado: ResultadoPago): 'interes' | 'cuota' {
  return resultado.montoCapital > 0 ? 'cuota' : 'interes'
}

/** Datos del codeudor opcional del préstamo (datos sueltos, no una entidad/cliente). */
export interface CodeudorInput {
  codeudor_nombre?: string | null
  codeudor_telefono?: string | null
  codeudor_documento?: string | null
}

/** Cobrador opcional asignado al crear el préstamo (id de `miembros`, o null). */
export interface AsignacionInput {
  cobrador_id?: string | null
}

/** Datos que captura el formulario de "Nuevo préstamo". */
export interface PrestamoInput extends CodeudorInput, AsignacionInput {
  cliente_id: string
  capital_inicial: number
  /** Tasa mensual en decimal: 0.10 = 10%. */
  tasa_mensual: number
  modo_interes: ModoInteres
  /** Fecha de desembolso en formato aaaa-mm-dd. */
  fecha_desembolso: string
}

/** Datos del formulario de "Nuevo préstamo" tipo cuotas. */
export interface PrestamoCuotasInput extends CodeudorInput, AsignacionInput {
  cliente_id: string
  capital_inicial: number
  /** Tasa mensual en decimal: 0.10 = 10%. */
  tasa_mensual: number
  frecuencia: FrecuenciaCuota
  n_cuotas: number
  fecha_desembolso: string
}

/** Datos del formulario de "Nuevo préstamo" tipo cuota fija (sin tasa). */
export interface PrestamoCuotaFijaInput extends CodeudorInput, AsignacionInput {
  cliente_id: string
  capital_inicial: number
  frecuencia: FrecuenciaCuota
  n_cuotas: number
  /** Monto fijo de cada cuota (en pesos). */
  valor_cuota: number
  fecha_desembolso: string
}

/**
 * Datos de un "préstamo existente": ya venía pagándose antes de la app. Además de
 * los datos del tipo, lo que ya pagó (no entra en la caja de hoy ni en la ganancia).
 */
export interface PrestamoExistenteInput extends CodeudorInput, AsignacionInput {
  tipo: 'abierto' | 'cuotas' | 'cuota_fija'
  cliente_id: string
  capital_inicial: number
  /** Anterior a hoy (fecha de Colombia). */
  fecha_desembolso: string
  /** Abierto y cuotas. Tasa mensual en decimal: 0.10 = 10%. */
  tasa_mensual?: number
  /** Abierto. */
  modo_interes?: ModoInteres
  /** Cuotas y cuota fija. */
  frecuencia?: FrecuenciaCuota
  n_cuotas?: number
  /** Cuota fija. */
  valor_cuota?: number
  /** Cuotas y cuota fija: cuotas completas ya pagadas (menos que el total). */
  cuotas_pagadas?: number
  /** Cuota fija: abono a la cuota siguiente (menor que el valor de la cuota). */
  abonado_siguiente?: number
  /** Abierto: saldo de capital de hoy. */
  saldo_capital?: number
  /** Abierto: fecha del último cobro de intereses pagado (null = ninguno). */
  interes_pagado_hasta?: string | null
}

export interface PrestamoMutacion {
  data: Prestamo | null
  error: string | null
}

/**
 * Acceso a la tabla `prestamos`. La RLS restringe a las filas del usuario.
 * Pasa `clienteId` para listar solo los préstamos de un cliente (ficha).
 */
export function usePrestamos(clienteId?: string) {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from('prestamos').select('*').order('created_at', { ascending: false })
    if (clienteId) query = query.eq('cliente_id', clienteId)
    const { data, error } = await query
    if (error) {
      setError('No pudimos cargar los préstamos. Intenta de nuevo.')
      setPrestamos([])
    } else {
      setPrestamos(data ?? [])
    }
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /**
   * Crea el préstamo y su movimiento de desembolso de forma atómica
   * (RPC crear_prestamo: ambos insert entran en una sola transacción).
   */
  const crear = useCallback(async (input: PrestamoInput): Promise<PrestamoMutacion> => {
    const { data, error } = await supabase.rpc('crear_prestamo', {
      p_cliente_id: input.cliente_id,
      p_capital: input.capital_inicial,
      p_tasa_mensual: input.tasa_mensual,
      p_modo_interes: input.modo_interes,
      p_fecha_desembolso: input.fecha_desembolso,
      p_codeudor_nombre: input.codeudor_nombre ?? undefined,
      p_codeudor_telefono: input.codeudor_telefono ?? undefined,
      p_codeudor_documento: input.codeudor_documento ?? undefined,
      p_cobrador_id: input.cobrador_id ?? undefined,
    })
    if (error || !data) {
      return { data: null, error: 'No pudimos crear el préstamo. Intenta de nuevo.' }
    }
    setPrestamos((prev) => [data, ...prev])
    return { data, error: null }
  }, [])

  /**
   * Crea un préstamo tipo 'cuotas' de forma atómica: la RPC genera el préstamo,
   * el desembolso y todas las filas del cronograma (mismo reparto que el motor).
   */
  const crearCuotas = useCallback(
    async (input: PrestamoCuotasInput): Promise<PrestamoMutacion> => {
      const { data, error } = await supabase.rpc('crear_prestamo_cuotas', {
        p_cliente_id: input.cliente_id,
        p_capital: input.capital_inicial,
        p_tasa_mensual: input.tasa_mensual,
        p_frecuencia: input.frecuencia,
        p_n_cuotas: input.n_cuotas,
        p_fecha_desembolso: input.fecha_desembolso,
        p_codeudor_nombre: input.codeudor_nombre ?? undefined,
        p_codeudor_telefono: input.codeudor_telefono ?? undefined,
        p_codeudor_documento: input.codeudor_documento ?? undefined,
        p_cobrador_id: input.cobrador_id ?? undefined,
      })
      if (error || !data) {
        return { data: null, error: 'No pudimos crear el préstamo. Intenta de nuevo.' }
      }
      setPrestamos((prev) => [data, ...prev])
      return { data, error: null }
    },
    [],
  )

  /**
   * Crea un préstamo tipo 'cuota_fija' de forma atómica: la RPC genera el
   * préstamo (con valor_cuota), el desembolso y las N cuotas de monto fijo
   * (valor en `capital`, abonado 0). Sin tasa ni interés aparte.
   */
  const crearCuotaFija = useCallback(
    async (input: PrestamoCuotaFijaInput): Promise<PrestamoMutacion> => {
      const { data, error } = await supabase.rpc('crear_prestamo_cuota_fija', {
        p_cliente_id: input.cliente_id,
        p_capital: input.capital_inicial,
        p_frecuencia: input.frecuencia,
        p_n_cuotas: input.n_cuotas,
        p_valor_cuota: input.valor_cuota,
        p_fecha_desembolso: input.fecha_desembolso,
        p_codeudor_nombre: input.codeudor_nombre ?? undefined,
        p_codeudor_telefono: input.codeudor_telefono ?? undefined,
        p_codeudor_documento: input.codeudor_documento ?? undefined,
        p_cobrador_id: input.cobrador_id ?? undefined,
      })
      if (error || !data) {
        return { data: null, error: 'No pudimos crear el préstamo. Intenta de nuevo.' }
      }
      setPrestamos((prev) => [data, ...prev])
      return { data, error: null }
    },
    [],
  )

  /**
   * Crea un préstamo existente de forma atómica (RPC crear_prestamo_existente): el
   * préstamo con la RPC de siempre, lo ya pagado sin movimientos de caja, y su estado
   * de hoy. Si la RPC rechaza un dato, se muestra su mensaje (ya viene en español).
   */
  const crearExistente = useCallback(
    async (input: PrestamoExistenteInput): Promise<PrestamoMutacion> => {
      const { data, error } = await supabase.rpc('crear_prestamo_existente', {
        p_tipo: input.tipo,
        p_cliente_id: input.cliente_id,
        p_capital: input.capital_inicial,
        p_fecha_desembolso: input.fecha_desembolso,
        p_tasa_mensual: input.tasa_mensual,
        p_modo_interes: input.modo_interes,
        p_frecuencia: input.frecuencia,
        p_n_cuotas: input.n_cuotas,
        p_valor_cuota: input.valor_cuota,
        p_cuotas_pagadas: input.cuotas_pagadas,
        p_abonado_siguiente: input.abonado_siguiente,
        p_saldo_capital: input.saldo_capital,
        p_interes_pagado_hasta: input.interes_pagado_hasta ?? undefined,
        p_codeudor_nombre: input.codeudor_nombre ?? undefined,
        p_codeudor_telefono: input.codeudor_telefono ?? undefined,
        p_codeudor_documento: input.codeudor_documento ?? undefined,
        p_cobrador_id: input.cobrador_id ?? undefined,
      })
      if (error || !data) {
        // P0001 = raise exception de la RPC (validación con mensaje para el usuario).
        const mensaje = error?.code === 'P0001' ? error.message : 'No pudimos crear el préstamo. Intenta de nuevo.'
        return { data: null, error: mensaje }
      }
      setPrestamos((prev) => [data, ...prev])
      return { data, error: null }
    },
    [],
  )

  /**
   * Registra un pago. El desglose lo calcula el motor (aplicarPago) a partir
   * del préstamo actual; la RPC solo persiste ese resultado, de forma atómica.
   */
  const registrarPago = useCallback(
    async (
      prestamoId: string,
      monto: number,
      metodoPago: string,
    ): Promise<{ resultado: ResultadoPago | null; error: string | null }> => {
      const p = prestamos.find((x) => x.id === prestamoId)
      if (!p) return { resultado: null, error: 'No encontramos el préstamo.' }

      const { resultado } = aplicarPago(prestamoDelMotor(p), monto)

      const { error } = await supabase.rpc('registrar_pago', {
        p_prestamo_id: prestamoId,
        p_monto: monto,
        p_metodo_pago: metodoPago,
        p_tipo: tipoMovimiento(resultado),
        p_monto_interes: resultado.montoInteres,
        p_monto_capital: resultado.montoCapital,
        p_saldo_anterior: resultado.saldoAnterior,
        p_saldo_posterior: resultado.saldoPosterior,
        p_interes_pendiente_restante: resultado.interesPendienteRestante,
      })
      if (error) {
        return { resultado: null, error: 'No pudimos registrar el pago. Intenta de nuevo.' }
      }

      setPrestamos((prev) =>
        prev.map((x) =>
          x.id === prestamoId
            ? {
                ...x,
                saldo_capital: resultado.saldoPosterior,
                interes_pendiente: resultado.interesPendienteRestante,
                estado: resultado.prestamoSaldado ? 'pagado' : x.estado,
              }
            : x,
        ),
      )
      return { resultado, error: null }
    },
    [prestamos],
  )

  /**
   * Registra un pago contra el cronograma de un préstamo de cuotas (RPC atómica
   * que replica aplicarPagoACuotas / pagarSoloInteres del motor). Refresca el
   * préstamo (saldo/estado) al terminar.
   */
  const registrarPagoCuotas = useCallback(
    async (
      prestamoId: string,
      abono: number,
      metodo: string,
      soloInteres: boolean,
    ): Promise<{ error: string | null }> => {
      const { error } = await supabase.rpc('registrar_pago_cuotas', {
        p_prestamo_id: prestamoId,
        p_abono: abono,
        p_metodo_pago: metodo,
        p_solo_interes: soloInteres,
      })
      if (error) return { error: 'No pudimos registrar el pago. Intenta de nuevo.' }
      await cargar()
      return { error: null }
    },
    [cargar],
  )

  /**
   * Registra un pago contra un préstamo de cuota fija (RPC atómica que replica
   * aplicarPagoFijo del motor: llena cuotas en orden con el abono). Refresca el
   * préstamo (saldo/estado) al terminar.
   */
  const registrarPagoCuotaFija = useCallback(
    async (
      prestamoId: string,
      monto: number,
      metodo: string,
    ): Promise<{ error: string | null }> => {
      const { error } = await supabase.rpc('registrar_pago_cuota_fija', {
        p_prestamo_id: prestamoId,
        p_monto: monto,
        p_metodo_pago: metodo,
      })
      if (error) return { error: 'No pudimos registrar el pago. Intenta de nuevo.' }
      await cargar()
      return { error: null }
    },
    [cargar],
  )

  /**
   * Asigna / reasigna / desasigna (cobradorId = null) el cobrador de un préstamo.
   * Solo el dueño (la RPC asignar_cobrador valida rol y que el cobrador sea un
   * miembro activo del mismo negocio). Refresca el préstamo en la lista.
   */
  const asignarCobrador = useCallback(
    async (prestamoId: string, cobradorId: string | null): Promise<{ error: string | null }> => {
      const { data, error } = await supabase.rpc('asignar_cobrador', {
        p_prestamo_id: prestamoId,
        // Desasignar = omitir el parámetro: la RPC usa su default null y pone
        // cobrador_id = null. (El tipo generado no acepta null explícito.)
        p_cobrador_id: cobradorId ?? undefined,
      })
      if (error || !data) {
        return { error: 'No pudimos asignar el cobrador. Intenta de nuevo.' }
      }
      setPrestamos((prev) => prev.map((x) => (x.id === prestamoId ? data : x)))
      return { error: null }
    },
    [],
  )

  return {
    prestamos,
    loading,
    error,
    crear,
    crearCuotas,
    crearCuotaFija,
    crearExistente,
    registrarPago,
    registrarPagoCuotas,
    registrarPagoCuotaFija,
    asignarCobrador,
    recargar: cargar,
  }
}
