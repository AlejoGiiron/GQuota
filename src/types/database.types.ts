export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          created_at: string
          direccion: string | null
          documento: string | null
          id: string
          negocio_id: string
          nombre: string
          notas: string | null
          telefono: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          documento?: string | null
          id?: string
          negocio_id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          direccion?: string | null
          documento?: string | null
          id?: string
          negocio_id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          created_at: string
          id: string
          metodos_pago: string[]
          nombre_negocio: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metodos_pago?: string[]
          nombre_negocio?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metodos_pago?: string[]
          nombre_negocio?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cuotas: {
        Row: {
          abonado: number
          capital: number
          created_at: string
          estado: string
          fecha_vence: string
          id: string
          interes: number
          negocio_id: string
          numero: number
          prestamo_id: string
          user_id: string
        }
        Insert: {
          abonado?: number
          capital: number
          created_at?: string
          estado?: string
          fecha_vence: string
          id?: string
          interes: number
          negocio_id?: string
          numero: number
          prestamo_id: string
          user_id: string
        }
        Update: {
          abonado?: number
          capital?: number
          created_at?: string
          estado?: string
          fecha_vence?: string
          id?: string
          interes?: number
          negocio_id?: string
          numero?: number
          prestamo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuotas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuotas_prestamo_id_fkey"
            columns: ["prestamo_id"]
            isOneToOne: false
            referencedRelation: "prestamos"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros: {
        Row: {
          created_at: string
          id: string
          negocio_id: string
          rol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          negocio_id: string
          rol?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          negocio_id?: string
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          created_at: string
          fecha: string
          id: string
          metodo_pago: string | null
          monto_capital: number
          monto_interes: number
          monto_total: number
          negocio_id: string
          nota: string | null
          prestamo_id: string
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string | null
          monto_capital?: number
          monto_interes?: number
          monto_total: number
          negocio_id?: string
          nota?: string | null
          prestamo_id: string
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          metodo_pago?: string | null
          monto_capital?: number
          monto_interes?: number
          monto_total?: number
          negocio_id?: string
          nota?: string | null
          prestamo_id?: string
          saldo_anterior?: number
          saldo_posterior?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_prestamo_id_fkey"
            columns: ["prestamo_id"]
            isOneToOne: false
            referencedRelation: "prestamos"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          created_at: string
          id: string
          metodos_pago: string[]
          nombre: string
        }
        Insert: {
          created_at?: string
          id?: string
          metodos_pago?: string[]
          nombre: string
        }
        Update: {
          created_at?: string
          id?: string
          metodos_pago?: string[]
          nombre?: string
        }
        Relationships: []
      }
      prestamos: {
        Row: {
          capital_inicial: number
          cliente_id: string
          codeudor_documento: string | null
          codeudor_nombre: string | null
          codeudor_telefono: string | null
          created_at: string
          dia_cobro: number | null
          estado: string
          fecha_desembolso: string
          id: string
          interes_pendiente: number
          modo_interes: string
          negocio_id: string
          notas: string | null
          saldo_capital: number
          tasa_mensual: number
          tipo: string
          ultimo_devengo: string | null
          user_id: string
          valor_cuota: number | null
        }
        Insert: {
          capital_inicial: number
          cliente_id: string
          codeudor_documento?: string | null
          codeudor_nombre?: string | null
          codeudor_telefono?: string | null
          created_at?: string
          dia_cobro?: number | null
          estado?: string
          fecha_desembolso: string
          id?: string
          interes_pendiente?: number
          modo_interes?: string
          negocio_id?: string
          notas?: string | null
          saldo_capital: number
          tasa_mensual: number
          tipo?: string
          ultimo_devengo?: string | null
          user_id: string
          valor_cuota?: number | null
        }
        Update: {
          capital_inicial?: number
          cliente_id?: string
          codeudor_documento?: string | null
          codeudor_nombre?: string | null
          codeudor_telefono?: string | null
          created_at?: string
          dia_cobro?: number | null
          estado?: string
          fecha_desembolso?: string
          id?: string
          interes_pendiente?: number
          modo_interes?: string
          negocio_id?: string
          notas?: string | null
          saldo_capital?: number
          tasa_mensual?: number
          tipo?: string
          ultimo_devengo?: string | null
          user_id?: string
          valor_cuota?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prestamos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestamos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crear_prestamo: {
        Args: {
          p_capital: number
          p_cliente_id: string
          p_codeudor_documento?: string
          p_codeudor_nombre?: string
          p_codeudor_telefono?: string
          p_fecha_desembolso: string
          p_modo_interes: string
          p_tasa_mensual: number
        }
        Returns: {
          capital_inicial: number
          cliente_id: string
          codeudor_documento: string | null
          codeudor_nombre: string | null
          codeudor_telefono: string | null
          created_at: string
          dia_cobro: number | null
          estado: string
          fecha_desembolso: string
          id: string
          interes_pendiente: number
          modo_interes: string
          negocio_id: string
          notas: string | null
          saldo_capital: number
          tasa_mensual: number
          tipo: string
          ultimo_devengo: string | null
          user_id: string
          valor_cuota: number | null
        }
        SetofOptions: {
          from: "*"
          to: "prestamos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_prestamo_cuota_fija: {
        Args: {
          p_capital: number
          p_cliente_id: string
          p_codeudor_documento?: string
          p_codeudor_nombre?: string
          p_codeudor_telefono?: string
          p_fecha_desembolso: string
          p_frecuencia: string
          p_n_cuotas: number
          p_valor_cuota: number
        }
        Returns: {
          capital_inicial: number
          cliente_id: string
          codeudor_documento: string | null
          codeudor_nombre: string | null
          codeudor_telefono: string | null
          created_at: string
          dia_cobro: number | null
          estado: string
          fecha_desembolso: string
          id: string
          interes_pendiente: number
          modo_interes: string
          negocio_id: string
          notas: string | null
          saldo_capital: number
          tasa_mensual: number
          tipo: string
          ultimo_devengo: string | null
          user_id: string
          valor_cuota: number | null
        }
        SetofOptions: {
          from: "*"
          to: "prestamos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_prestamo_cuotas: {
        Args: {
          p_capital: number
          p_cliente_id: string
          p_codeudor_documento?: string
          p_codeudor_nombre?: string
          p_codeudor_telefono?: string
          p_fecha_desembolso: string
          p_frecuencia: string
          p_n_cuotas: number
          p_tasa_mensual: number
        }
        Returns: {
          capital_inicial: number
          cliente_id: string
          codeudor_documento: string | null
          codeudor_nombre: string | null
          codeudor_telefono: string | null
          created_at: string
          dia_cobro: number | null
          estado: string
          fecha_desembolso: string
          id: string
          interes_pendiente: number
          modo_interes: string
          negocio_id: string
          notas: string | null
          saldo_capital: number
          tasa_mensual: number
          tipo: string
          ultimo_devengo: string | null
          user_id: string
          valor_cuota: number | null
        }
        SetofOptions: {
          from: "*"
          to: "prestamos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      devengar_intereses: { Args: never; Returns: number }
      marcar_cuotas_vencidas: { Args: never; Returns: number }
      marcar_mora: { Args: never; Returns: number }
      mi_negocio: { Args: never; Returns: string }
      registrar_pago: {
        Args: {
          p_interes_pendiente_restante: number
          p_metodo_pago: string
          p_monto: number
          p_monto_capital: number
          p_monto_interes: number
          p_prestamo_id: string
          p_saldo_anterior: number
          p_saldo_posterior: number
          p_tipo: string
        }
        Returns: {
          created_at: string
          fecha: string
          id: string
          metodo_pago: string | null
          monto_capital: number
          monto_interes: number
          monto_total: number
          negocio_id: string
          nota: string | null
          prestamo_id: string
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "movimientos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_pago_cuota_fija: {
        Args: { p_metodo_pago: string; p_monto: number; p_prestamo_id: string }
        Returns: {
          created_at: string
          fecha: string
          id: string
          metodo_pago: string | null
          monto_capital: number
          monto_interes: number
          monto_total: number
          negocio_id: string
          nota: string | null
          prestamo_id: string
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "movimientos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_pago_cuotas: {
        Args: {
          p_abono: number
          p_metodo_pago: string
          p_prestamo_id: string
          p_solo_interes: boolean
        }
        Returns: {
          created_at: string
          fecha: string
          id: string
          metodo_pago: string | null
          monto_capital: number
          monto_interes: number
          monto_total: number
          negocio_id: string
          nota: string | null
          prestamo_id: string
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "movimientos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
