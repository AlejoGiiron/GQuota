import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConfiguracionProvider } from '@/contexts/ConfiguracionContext'
import { router } from '@/router'
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
