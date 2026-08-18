import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTag, getCode } from '../lib/firestore'
import { useAuth } from '../context/AuthContext'
import type { TagDoc } from '../lib/types'

function MapPlaceholder() {
  return (
    <div style={{ position: 'relative', height: 130, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'linear-gradient(135deg,var(--color-accent-2-200),var(--color-neutral-200))' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(var(--color-accent-2-500) 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -100%)' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--color-accent-700)" stroke="var(--color-accent-100)" strokeWidth="1.5">
          <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22z"/>
          <circle cx="12" cy="9.5" r="2.5" fill="var(--color-accent-100)"/>
        </svg>
      </div>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465a1 1 0 0 1 1.31-.238 7.5 7.5 0 0 1 1.976 1.755 1 1 0 0 1-.072 1.268l-.8.9a1.44 1.44 0 0 1-1.291.48c-3.65-.5-6.9-3.75-7.4-7.4a1.44 1.44 0 0 1 .48-1.291l.9-.8a1 1 0 0 1 1.268-.072 7.5 7.5 0 0 1 1.755 1.976 1 1 0 0 1-.238 1.31l-.465.355a1 1 0 0 0-.303 1.213z"/>
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l1.65-4.95A9 9 0 1 1 8 19.5z"/>
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0zm5 0a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0zm-8.5 3.5c1 2 3 3.5 6.5 3.5"/>
    </svg>
  )
}

export default function PublicProfile() {
  const { tagId: param } = useParams<{ tagId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tag, setTag] = useState<(TagDoc & { id: string }) | null>(null)
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'not_activated'>('loading')
  const [codeParam, setCodeParam] = useState<string>('')

  useEffect(() => {
    if (!param) return
    // The QR URL encodes the code ID (e.g. HU-xxx). Look it up in codes first.
    getCode(param).then(async codeDoc => {
      if (codeDoc) {
        if (codeDoc.tagId) {
          const tagData = await getTag(codeDoc.tagId)
          if (tagData) { setTag(tagData); setStatus('found') }
          else setStatus('not_found')
        } else {
          setCodeParam(param)
          setStatus('not_activated')
        }
      } else {
        // Fallback: try as direct tag document ID
        const tagData = await getTag(param)
        if (tagData) { setTag(tagData); setStatus('found') }
        else setStatus('not_found')
      }
    })
  }, [param])

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent)', fontSize: 18 }}>Cargando…</span>
      </div>
    )
  }

  if (status === 'not_activated') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 24 }}>
        <span style={{ fontSize: 48 }}>🐾</span>
        <h2 style={{ textAlign: 'center' }}>Tag sin activar</h2>
        <p style={{ textAlign: 'center', opacity: 0.7 }}>Este tag todavía no está configurado. ¡Activalo para proteger a tu mascota!</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            sessionStorage.setItem('pendingCode', codeParam)
            navigate(user ? `/app/tags/nuevo?code=${codeParam}` : `/activar?code=${codeParam}`)
          }}
        >
          Activar este tag
        </button>
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 24 }}>
        <span style={{ fontSize: 48 }}>🔍</span>
        <h2 style={{ textAlign: 'center' }}>Tag no encontrado</h2>
        <p style={{ textAlign: 'center', opacity: 0.7 }}>Este código QR no existe en el sistema.</p>
      </div>
    )
  }

  const whatsappUrl = tag?.ownerPhone
    ? `https://wa.me/${tag.ownerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, encontré a ${tag.petName ?? 'tu mascota'} 🐾`)}`
    : '#'

  const isDesktop = window.innerWidth >= 768

  const avatarContent = tag?.photoUrl ? (
    <img src={tag.photoUrl} alt={tag.petName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
      {tag?.species === 'gato' ? '🐱' : '🐶'}
    </div>
  )

  const avatarSize = isDesktop ? 180 : 132

  const profileColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: isDesktop ? 240 : undefined }}>
      <div className="washed" style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', overflow: 'hidden', boxShadow: 'var(--shadow-md)', flexShrink: 0, background: 'var(--color-neutral-200)' }}>
        {avatarContent}
      </div>
      <h2 style={{ margin: '6px 0 0', fontSize: 26 }}>{tag?.petName ?? 'Sin nombre'}</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {tag?.species && (
          <span className="tag tag-accent">
            {tag.species === 'perro' ? 'Perro' : 'Gato'}{tag.breed ? ` · ${tag.breed}` : ''}
          </span>
        )}
        <span className={`tag ${tag?.active ? 'tag-accent-2' : 'tag-neutral'}`}>
          {tag?.active ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
  )

  const cards = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
      {tag?.healthNotes && (
        <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
          <div className="card-kicker">Salud</div>
          <p className="card-body" style={{ whiteSpace: 'pre-wrap' }}>{tag.healthNotes}</p>
        </div>
      )}

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div className="card-kicker">Contacto del dueño</div>
        {tag?.ownerName && <div className="card-title" style={{ fontSize: 16 }}>{tag.ownerName}</div>}
        <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: 8, marginTop: 4 }}>
          {tag?.ownerPhone && (
            <a href={whatsappUrl} className="btn btn-primary" style={{ flex: isDesktop ? undefined : undefined, textDecoration: 'none', width: isDesktop ? undefined : '100%' }} target="_blank" rel="noreferrer">
              <WhatsAppIcon /> Escribir por WhatsApp
            </a>
          )}
          {tag?.ownerPhone && (
            <a href={`tel:${tag.ownerPhone}`} className="btn btn-secondary" style={{ textDecoration: 'none', width: isDesktop ? undefined : '100%' }}>
              <PhoneIcon /> Llamar al dueño
            </a>
          )}
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div className="card-kicker">Última ubicación conocida</div>
        <MapPlaceholder />
        <p className="card-body" style={{ fontSize: 12 }}>Ubicación no disponible aún</p>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '40px 48px' }}>
        <div style={{ display: 'flex', gap: 36, maxWidth: 920, margin: '0 auto', alignItems: 'flex-start' }}>
          {profileColumn}
          {cards}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '28px 20px 40px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {profileColumn}
      {cards}
    </div>
  )
}
