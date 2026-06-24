import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PantallaCargando from '@/components/PantallaCargando'

/**
 * Ruta pública (login / registro): con sesión activa redirige a la app. Un
 * usuario logueado SIN negocio (registro a medias) cae igualmente en la app, y
 * allí RequiereNegocio lo lleva a la pantalla "crea tu negocio" para recuperar.
 */
export default function PublicOnlyRoute() {
  const { session, loading } = useAuth()

  if (loading) return <PantallaCargando />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
