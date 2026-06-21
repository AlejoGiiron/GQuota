// Alias de conveniencia del esquema. La fuente de verdad es database.types.ts
// (regenerado con `supabase gen types`, NO editar a mano). Estos alias se
// DERIVAN de Database, así nunca se desincronizan con la BD: no escribas
// campos a mano aquí. Importa los tipos de la app desde este módulo.
import type { Database } from './database.types'

export type { Database }

export type Cliente = Database['public']['Tables']['clientes']['Row']
export type Prestamo = Database['public']['Tables']['prestamos']['Row']
export type Movimiento = Database['public']['Tables']['movimientos']['Row']
export type CuotaDB = Database['public']['Tables']['cuotas']['Row']
export type Configuracion = Database['public']['Tables']['configuracion']['Row']
