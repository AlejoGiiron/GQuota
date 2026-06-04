/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GQUOTA_SUPABASE_URL: string
  readonly VITE_GQUOTA_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
