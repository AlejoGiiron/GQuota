import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PantallaCargando from '@/components/PantallaCargando'

/** Ruta privada: sin sesión redirige a /login. Espera a resolver la sesión. */
export default function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) return <PantallaCargando />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
