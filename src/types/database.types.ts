// TODO(fase-05): regenerar con el CLI de Supabase (supabase gen types) en vez de
// mantenerlo a mano; si una migración cambia el esquema y no se actualiza aquí,
// el tipo y la base se desincronizan en silencio.

// Tipos de la base de datos de G-Quota.
// Escritos a mano según supabase/migrations/001_schema_inicial.sql con la misma
// forma que genera `supabase gen types typescript`. Cuando haya acceso al CLI,
// regenerar este archivo para mantenerlo 100% fiel al esquema.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      configuracion: {
        Row: {
          id: string
          user_id: string
          nombre_negocio: string | null
          metodos_pago: string[]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nombre_negocio?: string | null
          metodos_pago?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nombre_negocio?: string | null
          metodos_pago?: string[]
          created_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          user_id: string
          nombre: string
          documento: string | null
          telefono: string | null
          direccion: string | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nombre: string
          documento?: string | null
          telefono?: string | null
          direccion?: string | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nombre?: string
          documento?: string | null
          telefono?: string | null
          direccion?: string | null
          notas?: string | null
          created_at?: string
        }
        Relationships: []
      }
      prestamos: {
        Row: {
          id: string
          user_id: string
          cliente_id: string
          capital_inicial: number
          saldo_capital: number
          interes_pendiente: number
          tasa_mensual: number
          modo_interes: string
          fecha_desembolso: string
          dia_cobro: number | null
          estado: string
          tipo: string
          notas: string | null
          ultimo_devengo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          cliente_id: string
          capital_inicial: number
          saldo_capital: number
          interes_pendiente?: number
          tasa_mensual: number
          modo_interes?: string
          fecha_desembolso: string
          dia_cobro?: number | null
          estado?: string
          tipo?: string
          notas?: string | null
          ultimo_devengo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          cliente_id?: string
          capital_inicial?: number
          saldo_capital?: number
          interes_pendiente?: number
          tasa_mensual?: number
          modo_interes?: string
          fecha_desembolso?: string
          dia_cobro?: number | null
          estado?: string
          tipo?: string
          notas?: string | null
          ultimo_devengo?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'prestamos_cliente_id_fkey'
            columns: ['cliente_id']
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
        ]
      }
      movimientos: {
        Row: {
          id: string
          user_id: string
          prestamo_id: string
          fecha: string
          tipo: string
          monto_total: number
          monto_interes: number
          monto_capital: number
          saldo_anterior: number
          saldo_posterior: number
          metodo_pago: string | null
          nota: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prestamo_id: string
          fecha?: string
          tipo: string
          monto_total: number
          monto_interes?: number
          monto_capital?: number
          saldo_anterior: number
          saldo_posterior: number
          metodo_pago?: string | null
          nota?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prestamo_id?: string
          fecha?: string
          tipo?: string
          monto_total?: number
          monto_interes?: number
          monto_capital?: number
          saldo_anterior?: number
          saldo_posterior?: number
          metodo_pago?: string | null
          nota?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'movimientos_prestamo_id_fkey'
            columns: ['prestamo_id']
            referencedRelation: 'prestamos'
            referencedColumns: ['id']
          },
        ]
      }
      cuotas: {
        Row: {
          id: string
          user_id: string
          prestamo_id: string
          numero: number
          fecha_vence: string
          capital: number
          interes: number
          estado: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prestamo_id: string
          numero: number
          fecha_vence: string
          capital: number
          interes: number
          estado?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prestamo_id?: string
          numero?: number
          fecha_vence?: string
          capital?: number
          interes?: number
          estado?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cuotas_prestamo_id_fkey'
            columns: ['prestamo_id']
            referencedRelation: 'prestamos'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      crear_prestamo: {
        Args: {
          p_cliente_id: string
          p_capital: number
          p_tasa_mensual: number
          p_modo_interes: string
          p_fecha_desembolso: string
        }
        Returns: {
          id: string
          user_id: string
          cliente_id: string
          capital_inicial: number
          saldo_capital: number
          interes_pendiente: number
          tasa_mensual: number
          modo_interes: string
          fecha_desembolso: string
          dia_cobro: number | null
          estado: string
          tipo: string
          notas: string | null
          ultimo_devengo: string | null
          created_at: string
        }
      }
      crear_prestamo_cuotas: {
        Args: {
          p_cliente_id: string
          p_capital: number
          p_tasa_mensual: number
          p_frecuencia: string
          p_n_cuotas: number
          p_fecha_desembolso: string
        }
        Returns: {
          id: string
          user_id: string
          cliente_id: string
          capital_inicial: number
          saldo_capital: number
          interes_pendiente: number
          tasa_mensual: number
          modo_interes: string
          fecha_desembolso: string
          dia_cobro: number | null
          estado: string
          tipo: string
          notas: string | null
          ultimo_devengo: string | null
          created_at: string
        }
      }
      registrar_pago: {
        Args: {
          p_prestamo_id: string
          p_monto: number
          p_metodo_pago: string
          p_tipo: string
          p_monto_interes: number
          p_monto_capital: number
          p_saldo_anterior: number
          p_saldo_posterior: number
          p_interes_pendiente_restante: number
        }
        Returns: {
          id: string
          user_id: string
          prestamo_id: string
          fecha: string
          tipo: string
          monto_total: number
          monto_interes: number
          monto_capital: number
          saldo_anterior: number
          saldo_posterior: number
          metodo_pago: string | null
          nota: string | null
          created_at: string
        }
      }
      registrar_pago_cuotas: {
        Args: {
          p_prestamo_id: string
          p_abono: number
          p_metodo_pago: string
          p_solo_interes: boolean
        }
        Returns: {
          id: string
          user_id: string
          prestamo_id: string
          fecha: string
          tipo: string
          monto_total: number
          monto_interes: number
          monto_capital: number
          saldo_anterior: number
          saldo_posterior: number
          metodo_pago: string | null
          nota: string | null
          created_at: string
        }
      }
      devengar_intereses: {
        Args: Record<string, never>
        Returns: number
      }
      marcar_mora: {
        Args: Record<string, never>
        Returns: number
      }
      marcar_cuotas_vencidas: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ── Alias de conveniencia ──
export type Cliente = Database['public']['Tables']['clientes']['Row']
export type ClienteInsert = Database['public']['Tables']['clientes']['Insert']
export type ClienteUpdate = Database['public']['Tables']['clientes']['Update']

export type Prestamo = Database['public']['Tables']['prestamos']['Row']
export type Movimiento = Database['public']['Tables']['movimientos']['Row']
export type Configuracion = Database['public']['Tables']['configuracion']['Row']
// Fila de la tabla cuotas (distinta del tipo Cuota del motor, que es lógica pura).
export type CuotaDB = Database['public']['Tables']['cuotas']['Row']
