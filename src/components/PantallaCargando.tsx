/** Splash mínimo mientras se resuelve la sesión inicial (evita parpadeo del login). */
export default function PantallaCargando() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '3px solid var(--line)',
          borderTopColor: 'var(--green)',
          animation: 'lg-spin 0.7s linear infinite',
        }}
        aria-label="Cargando"
        role="status"
      />
    </div>
  )
}
