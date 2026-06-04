import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PantallaCargando from '@/components/PantallaCargando'

/** Ruta pública (login): con sesión activa redirige a la app. */
export default function PublicOnlyRoute() {
  const { session, loading } = useAuth()

  if (loading) return <PantallaCargando />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
