import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

const supabaseUrl = import.meta.env.VITE_GQUOTA_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_GQUOTA_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase. Define VITE_GQUOTA_SUPABASE_URL y VITE_GQUOTA_SUPABASE_ANON_KEY (ver .env.example).',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
