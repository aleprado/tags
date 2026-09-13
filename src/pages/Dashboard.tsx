import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserTags, updateTag } from '../lib/firestore'
import { isNotificationSupported, isSubscribed, subscribeToAlerts, unsubscribeFromAlerts } from '../lib/notifications'
import type { TagDoc } from '../lib/types'
import AppLayout from '../layouts/AppLayout'
import Switch from '../components/Switch'

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

type TagWithId = TagDoc & { id: string }

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

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
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
  const [lostConfirm, setLostConfirm] = useState<TagWithId | null>(null)
  const [alertSub, setAlertSub] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'unsupported'>('loading')
  const [alertBusy, setAlertBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    getUserTags(user.uid).then(data => {
      setTags(data)
      setLoading(false)
    })
    if (!isNotificationSupported()) {
      setAlertSub('unsupported')
    } else {
      isSubscribed(user.uid).then(sub => setAlertSub(sub ? 'subscribed' : 'unsubscribed'))
    }
  }, [user])

  async function toggleActive(tag: TagWithId) {
    const next = !tag.active
    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, active: next } : t))
    await updateTag(tag.id, { active: next })
  }

  async function toggleLost(tag: TagWithId) {
    if (tag.lost) {
      setTags(prev => prev.map(t => t.id === tag.id ? { ...t, lost: false } : t))
      await updateTag(tag.id, { lost: false })
    } else {
      setLostConfirm(tag)
    }
  }

  async function confirmLost() {
    if (!lostConfirm) return
    const tag = lostConfirm
    setLostConfirm(null)
    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, lost: true } : t))
    await updateTag(tag.id, { lost: true })
  }

  async function handleSubscribe() {
    if (!user) return
    setAlertBusy(true)
    try {
      const loc = tags.find(t => t.homeLocation)?.homeLocation
      if (loc) {
        await subscribeToAlerts(user.uid, loc)
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        )
        await subscribeToAlerts(user.uid, { lat: pos.coords.latitude, lng: pos.coords.longitude })
      }
      setAlertSub('subscribed')
    } catch {
      setAlertSub('unsubscribed')
    } finally {
      setAlertBusy(false)
    }
  }

  async function handleUnsubscribe() {
    if (!user) return
    setAlertBusy(true)
    try {
      await unsubscribeFromAlerts(user.uid)
      setAlertSub('unsubscribed')
    } finally {
      setAlertBusy(false)
    }
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
          position: 'relative',
          borderLeft: tag.lost ? '3px solid #c0392b' : undefined,
        }}
        onClick={() => navigate(`/app/tags/${tag.id}/editar`)}
      >
        {tag.lost && (
          <span style={{
            position: 'absolute', top: 6, right: 8,
            fontSize: 10, fontWeight: 700, color: '#c0392b',
            background: '#fde8e8', padding: '2px 8px', borderRadius: 999,
            animation: 'pulse-lost 2s ease-in-out infinite',
          }}>
            PERDIDA
          </span>
        )}
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
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: isList ? 'flex-start' : 'center' }}>
            <span className={`tag ${tag.type === 'mascota' ? 'tag-accent' : 'tag-accent-2'}`}>
              {tag.type === 'mascota' ? (tag.species === 'gato' ? 'Gato' : 'Perro') : 'Objeto'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => { e.stopPropagation() }}>
          {tag.type === 'mascota' && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => toggleLost(tag)}
              title={tag.lost ? 'Marcar como encontrada' : 'Reportar perdida'}
              style={{
                padding: '4px 8px', fontSize: 11, fontWeight: 600,
                color: tag.lost ? '#c0392b' : 'var(--color-neutral-500)',
                border: tag.lost ? '1px solid #c0392b' : '1px solid var(--color-divider)',
                borderRadius: 999,
              }}
            >
              {tag.lost ? 'Encontrada' : 'En alerta'}
            </button>
          )}
          <Switch active={tag.active} onToggle={() => toggleActive(tag)} />
        </div>
      </div>
    )
  }

  const alertCard = alertSub !== 'loading' && (
    <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BellIcon />
        <div className="card-kicker" style={{ margin: 0 }}>Alertas de mascotas perdidas</div>
      </div>
      {alertSub === 'unsupported' ? (
        <p className="card-body" style={{ fontSize: 12, opacity: 0.6 }}>
          Las notificaciones push no estan disponibles en este navegador.
        </p>
      ) : alertSub === 'subscribed' ? (
        <>
          <p className="card-body" style={{ fontSize: 13, color: '#27ae60' }}>
            Alertas activas — Recibiras notificaciones de mascotas perdidas en tu zona.
          </p>
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12 }} disabled={alertBusy} onClick={handleUnsubscribe}>
            Desactivar alertas
          </button>
        </>
      ) : (
        <>
          <p className="card-body" style={{ fontSize: 13 }}>
            Recibi alertas cuando una mascota de tu barrio se pierde para poder ayudar.
          </p>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={alertBusy} onClick={handleSubscribe}>
            {alertBusy ? 'Activando...' : 'Activar alertas'}
          </button>
        </>
      )}
    </div>
  )

  return (
    <AppLayout>
      {lostConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div className="card elev-md" style={{ maxWidth: 340, gap: 'var(--space-3)', textAlign: 'center', padding: 'var(--space-5)' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              Reportar mascota perdida
            </p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
              Marcar a <strong>{lostConfirm.petName}</strong> como perdida?
              {lostConfirm.homeLocation
                ? ' Se notificara a vecinos de tu zona.'
                : ' Para enviar alertas a vecinos, agrega la ubicacion de tu hogar al editar el tag.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setLostConfirm(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: '#c0392b' }} onClick={confirmLost}>
                Reportar perdida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile */}
      <div className="mobile-only" style={{ display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Mis Tags</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-icon" aria-label="Cerrar sesion" onClick={handleLogout} style={{ color: 'var(--color-neutral-500)' }}>
              <LogoutIcon />
            </button>
            <button className="btn btn-primary btn-icon" aria-label="Nuevo tag" onClick={() => navigate('/app/tags/nuevo')}>
              <PlusIcon />
            </button>
          </div>
        </div>
        {loading ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Cargando...</p>
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
            No tenes tags todavia. Crea tu primero!
          </p>
        )}
        {alertCard}
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
          <p style={{ opacity: 0.6, fontSize: 14 }}>Cargando...</p>
        ) : tags.length === 0 ? (
          <div className="card elev-sm" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-8)', gap: 'var(--space-3)' }}>
            <div className="card-kicker">Sin tags</div>
            <p className="card-body">Todavia no tenes tags registrados.</p>
            <button className="btn btn-primary" onClick={() => navigate('/app/tags/nuevo')}>Crear mi primer tag</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
            {tags.map(t => <TagCard key={t.id} tag={t} layout="grid" />)}
          </div>
        )}
        {alertCard}
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, opacity: 0.55, marginTop: 'var(--space-4)' }}>
        Toca un tag para editarlo
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
        @keyframes pulse-lost {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </AppLayout>
  )
}
