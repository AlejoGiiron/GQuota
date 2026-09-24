import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConfiguracionProvider } from '@/contexts/ConfiguracionContext'
import { router } from '@/router'
// IBM Plex Sans servida desde el propio proyecto (sin CDN de fuentes); subconjunto latino.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ConfiguracionProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </ConfiguracionProvider>
    </AuthProvider>
  </StrictMode>,
)
