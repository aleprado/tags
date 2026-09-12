import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserTags, updateTag } from '../lib/firestore'
import type { TagDoc } from '../lib/types'
import AppLayout from '../layouts/AppLayout'

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

type TagWithId = TagDoc & { id: string }

function Switch({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={active ? 'Desactivar' : 'Activar'}
      style={{
        width: 44, height: 26, borderRadius: 999, border: 'none', padding: 2,
        cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0,
        background: active ? 'var(--color-accent)' : 'var(--color-neutral-300)',
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        display: 'block', boxShadow: 'var(--shadow-sm)',
        transform: `translateX(${active ? '18px' : '0px'})`,
        transition: 'transform 0.15s',
      }} />
    </button>
  )
}

const OBJECT_CATEGORY_ICONS: Record<string, string> = {
  mochila: '🎒', cartera: '👜', llaves: '🔑', indumentaria: '👕', otro: '📦',
}

function PetIcon({ species }: { species?: 'perro' | 'gato' }) {
  if (species === 'gato') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-700)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.42-7 1.47-.58 4.64.26 6.42 2.26A9.8 9.8 0 0 1 12 5Z"/>
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-700)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/>
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }
  const [tags, setTags] = useState<TagWithId[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getUserTags(user.uid).then(data => {
      setTags(data)
      setLoading(false)
    })
  }, [user])

  async function toggleActive(tag: TagWithId) {
    const next = !tag.active
    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, active: next } : t))
    await updateTag(tag.id, { active: next })
  }

  function TagCard({ tag, layout }: { tag: TagWithId; layout: 'list' | 'grid' }) {
    const isList = layout === 'list'
    return (
      <div
        className="card elev-sm"
        style={{
          flexDirection: isList ? 'row' : 'column',
          alignItems: 'center',
          gap: isList ? 12 : 10,
          textAlign: isList ? 'left' : 'center',
          cursor: 'pointer',
        }}
        onClick={() => navigate(`/app/tags/${tag.id}/editar`)}
      >
        <div style={{
          width: isList ? 48 : 56,
          height: isList ? 48 : 56,
          borderRadius: '50%',
          background: 'var(--color-neutral-200)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {tag.photoUrl
            ? <img src={tag.photoUrl} alt={tag.petName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : tag.type === 'objeto'
              ? <span style={{ fontSize: 22 }}>{OBJECT_CATEGORY_ICONS[tag.objectCategory ?? ''] ?? '📦'}</span>
              : <PetIcon species={tag.species} />
          }
        </div>
        <div style={{ flex: isList ? 1 : undefined, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: isList ? 'flex-start' : 'center' }}>
          <div className="card-title" style={{ fontSize: 15 }}>{tag.petName ?? tag.objectDescription ?? 'Sin nombre'}</div>
          <span className={`tag ${tag.type === 'mascota' ? 'tag-accent' : 'tag-accent-2'}`}>
            {tag.type === 'mascota' ? (tag.species === 'gato' ? 'Gato' : 'Perro') : 'Objeto'}
          </span>
        </div>
        <div onClick={e => { e.stopPropagation() }}>
          <Switch active={tag.active} onToggle={() => toggleActive(tag)} />
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      {/* Mobile */}
      <div className="mobile-only" style={{ display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Mis Tags</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-icon" aria-label="Cerrar sesión" onClick={handleLogout} style={{ color: 'var(--color-neutral-500)' }}>
              <LogoutIcon />
            </button>
            <button className="btn btn-primary btn-icon" aria-label="Nuevo tag" onClick={() => navigate('/app/tags/nuevo')}>
              <PlusIcon />
            </button>
          </div>
        </div>
        {loading ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Cargando…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {tags.map(t => <TagCard key={t.id} tag={t} layout="list" />)}
          </div>
        )}
        <button className="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/app/tags/nuevo')}>
          + Nuevo tag
        </button>
        {!loading && tags.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, opacity: 0.55, marginTop: 8 }}>
            No tenés tags todavía. ¡Creá tu primero!
          </p>
        )}
      </div>

      {/* Desktop */}
      <div className="desktop-only">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Mis Tags</h2>
          <button className="btn btn-primary" onClick={() => navigate('/app/tags/nuevo')}>
            <PlusIcon /> Nuevo tag
          </button>
        </div>
        {loading ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Cargando…</p>
        ) : tags.length === 0 ? (
          <div className="card elev-sm" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-8)', gap: 'var(--space-3)' }}>
            <div className="card-kicker">Sin tags</div>
            <p className="card-body">Todavía no tenés tags registrados.</p>
            <button className="btn btn-primary" onClick={() => navigate('/app/tags/nuevo')}>Crear mi primer tag</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
            {tags.map(t => <TagCard key={t.id} tag={t} layout="grid" />)}
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, opacity: 0.55, marginTop: 'var(--space-4)' }}>
        Tocá un tag para editarlo
      </p>

      <style>{`
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
        }
        @media (min-width: 768px) {
          .mobile-only { display: none !important; }
          .desktop-only { display: block !important; }
        }
      `}</style>
    </AppLayout>
  )
}
