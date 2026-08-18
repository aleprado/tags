import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

const PawIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c491a" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>
    <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
  </svg>
)

const TagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/>
  </svg>
)

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 12px',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: 13.5,
    color: isActive ? 'var(--color-accent-800)' : 'var(--color-text)',
    background: isActive ? 'var(--color-accent-100)' : 'transparent',
    fontFamily: 'var(--font-body)',
    transition: 'background 0.15s',
  } as React.CSSProperties)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar — desktop only */}
      <aside className="app-sidebar" style={{
        width: 210,
        flexShrink: 0,
        background: 'var(--color-surface)',
        padding: '22px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        borderRight: '1px solid var(--color-divider)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 18px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PawIcon />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>Huellitas</span>
        </div>

        <NavLink to="/app/tags" style={navLinkStyle} end>
          <TagIcon /> Mis Tags
        </NavLink>

        {role === 'admin' && (
          <NavLink to="/admin" style={navLinkStyle}>
            <ShieldIcon /> Admin
          </NavLink>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-neutral-600)', borderTop: '1px solid var(--color-divider)', paddingTop: 14, marginTop: 8 }}>
          <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--color-text)' }}>
            {user?.displayName ?? user?.email?.split('@')[0]}
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'var(--font-body)' }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', padding: '36px 44px', maxWidth: '100%' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 767px) {
          .app-sidebar { display: none !important; }
          .app-main { padding: 24px 18px 32px !important; }
        }
      `}</style>
    </div>
  )
}
