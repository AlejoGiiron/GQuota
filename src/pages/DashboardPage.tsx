import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Landing privada provisional (placeholder de la Fase 02).
 * El dashboard real llega en una fase posterior; aquí solo confirmamos
 * que el acceso está protegido y que se puede cerrar sesión.
 */
export default function DashboardPage() {
  const { user, signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    toast.success('Sesión cerrada.')
    // La guarda de ruta privada redirige a /login al desaparecer la sesión.
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          G<span style={{ color: 'var(--green)' }}>·</span>Quota
        </h1>
        <p style={{ color: 'var(--text-2)', marginTop: 8 }}>
          Tienes la sesión iniciada{user?.email ? ` como ${user.email}` : ''}.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            marginTop: 24,
            height: 46,
            padding: '0 20px',
            borderRadius: 12,
            background: 'var(--green)',
            color: '#fff',
            fontSize: 14.5,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}
