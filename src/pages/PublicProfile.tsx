import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTag, getCode, saveScan } from '../lib/firestore'
import { useAuth } from '../context/AuthContext'
import type { TagDoc } from '../lib/types'
import LoadingPaw from '../components/LoadingPaw'

const OBJECT_CATEGORIES: Record<string, { label: string; icon: string }> = {
  mochila: { label: 'Mochila', icon: '🎒' },
  cartera: { label: 'Cartera', icon: '👜' },
  llaves: { label: 'Llaves', icon: '🔑' },
  indumentaria: { label: 'Indumentaria', icon: '👕' },
  otro: { label: 'Objeto', icon: '📦' },
}

function categoryInfo(cat?: string) {
  return OBJECT_CATEGORIES[cat ?? ''] ?? OBJECT_CATEGORIES.otro
}

function MapView({ lat, lng }: { lat: number; lng: number }) {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=16&hl=es&output=embed`
  return (
    <div style={{ position: 'relative', height: 160, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 0 }}
        title="Mapa"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02L6.6 10.8z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

function HuellitasHeader() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px', background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-divider)',
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--color-text)' }}>
        <img src="/paw.svg" alt="" style={{ width: 28, height: 28 }} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, letterSpacing: '-0.01em' }}>
          Huellitas
        </span>
      </a>
      <a
        href="/activar"
        className="btn btn-primary"
        style={{ fontSize: 12, padding: '6px 14px', textDecoration: 'none' }}
      >
        Consegui el tuyo
      </a>
    </header>
  )
}

function HuellitasFooter() {
  return (
    <footer style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '24px 20px 20px', opacity: 0.45, fontSize: 11,
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: 'var(--color-text)' }}>
        <img src="/paw.svg" alt="" style={{ width: 14, height: 14 }} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>Huellitas</span>
      </a>
      <span>hecho con amor por Delfi</span>
    </footer>
  )
}

export default function PublicProfile() {
  const { tagId: param } = useParams<{ tagId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tag, setTag] = useState<(TagDoc & { id: string }) | null>(null)
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'not_activated'>('loading')
  const [codeParam, setCodeParam] = useState<string>('')
  const [foundAt, setFoundAt] = useState<{ lat: number; lng: number } | null>(null)
  const [locationBusy, setLocationBusy] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)

  function handleWhatsApp() {
    const phone = tag?.type === 'objeto' ? (tag?.contactPhone ?? tag?.ownerPhone) : tag?.ownerPhone
    if (!phone || locationBusy) return
    if (navigator.geolocation) {
      setShowLocationModal(true)
    } else {
      sendWhatsApp(false)
    }
  }

  function sendWhatsApp(withLocation: boolean) {
    setShowLocationModal(false)
    const phone = tag?.type === 'objeto' ? (tag?.contactPhone ?? tag?.ownerPhone) : tag?.ownerPhone
    if (!phone) return

    const base = tag?.type === 'objeto'
      ? `Hola, encontre tu ${categoryInfo(tag?.objectCategory).label.toLowerCase()}`
      : tag?.lost
        ? `Hola, vi a ${tag?.petName ?? 'tu mascota'} que esta marcada como perdida en Huellitas`
        : `Hola, encontre a ${tag?.petName ?? 'tu mascota'}`

    const wa = (extra = '') => {
      const msg = extra ? `${base}\n\n${extra}` : base
      window.location.href = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
    }

    if (!withLocation) { wa(); return }

    setLocationBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setFoundAt({ lat, lng })
        saveScan(tag!.id, lat, lng).catch(() => {})
        setLocationBusy(false)
        wa(`Ubicacion donde lo encontre: https://maps.google.com/?q=${lat},${lng}`)
      },
      () => { setLocationBusy(false); wa() },
      { timeout: 8000 },
    )
  }

  useEffect(() => {
    if (!param) return
    const timeout = setTimeout(() => setStatus('not_found'), 10_000)
    getCode(param)
      .then(async codeDoc => {
        clearTimeout(timeout)
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
          const tagData = await getTag(param)
          if (tagData) { setTag(tagData); setStatus('found') }
          else setStatus('not_found')
        }
      })
      .catch((err) => {
        clearTimeout(timeout)
        console.error('[PublicProfile] Error cargando tag:', err)
        setStatus('not_found')
      })
    return () => clearTimeout(timeout)
  }, [param])

  if (status === 'loading') return <LoadingPaw />

  if (status === 'not_activated') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <HuellitasHeader />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: 24 }}>
          <span style={{ fontSize: 48 }}>🏷️</span>
          <h2 style={{ textAlign: 'center' }}>Tag sin activar</h2>
          <p style={{ textAlign: 'center', opacity: 0.7 }}>Este tag todavia no esta configurado. ¡Activalo ahora!</p>
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
        <HuellitasFooter />
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <HuellitasHeader />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: 24 }}>
          <span style={{ fontSize: 48 }}>🔍</span>
          <h2 style={{ textAlign: 'center' }}>Tag no encontrado</h2>
          <p style={{ textAlign: 'center', opacity: 0.7 }}>Este codigo QR no existe en el sistema.</p>
        </div>
        <HuellitasFooter />
      </div>
    )
  }

  const isDesktop = window.innerWidth >= 768
  const isObject = tag?.type === 'objeto'
  const isLost = !isObject && tag?.lost
  const phone = isObject ? (tag?.contactPhone ?? tag?.ownerPhone) : tag?.ownerPhone
  const phoneNum = phone?.replace(/\s/g, '') ?? ''
  const avatarSize = isDesktop ? 180 : 132
  const mapLoc = foundAt ?? tag?.homeLocation ?? null

  const avatarContent = isObject ? (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
      {categoryInfo(tag?.objectCategory).icon}
    </div>
  ) : tag?.photoUrl ? (
    <img src={tag.photoUrl} alt={tag.petName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
      {tag?.species === 'gato' ? '🐱' : '🐶'}
    </div>
  )

  const displayName = isObject
    ? categoryInfo(tag?.objectCategory).label
    : (tag?.petName ?? 'Sin nombre')

  const typeBadge = isObject
    ? categoryInfo(tag?.objectCategory).label
    : `${tag?.species === 'perro' ? 'Perro' : 'Gato'}${tag?.breed ? ` · ${tag.breed}` : ''}`

  const profileColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: isDesktop ? 240 : undefined }}>
      <div className="washed" style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', overflow: 'hidden', boxShadow: 'var(--shadow-md)', flexShrink: 0, background: 'var(--color-neutral-200)' }}>
        {avatarContent}
      </div>
      <h2 style={{ margin: '6px 0 0', fontSize: 26 }}>{displayName}</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="tag tag-accent">{typeBadge}</span>
        <span className={`tag ${tag?.active ? 'tag-accent-2' : 'tag-neutral'}`}>
          {tag?.active ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
  )

  const descriptionText = isObject ? tag?.objectDescription : tag?.healthNotes

  const cards = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
      {descriptionText && (
        <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
          <div className="card-kicker">Descripcion</div>
          <p className="card-body" style={{ whiteSpace: 'pre-wrap' }}>{descriptionText}</p>
        </div>
      )}

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div className="card-kicker">{isObject ? 'Contacto' : 'Contacto del dueño'}</div>
        {tag?.ownerName && <div className="card-title" style={{ fontSize: 16 }}>{tag.ownerName}</div>}
        <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: 8, marginTop: 4 }}>
          {phone && (
            <button
              className="btn btn-primary"
              style={{ width: isDesktop ? undefined : '100%' }}
              disabled={locationBusy}
              onClick={handleWhatsApp}
            >
              <WhatsAppIcon />{' '}
              {locationBusy ? 'Obteniendo ubicacion...' : 'Escribir por WhatsApp'}
            </button>
          )}
          {phoneNum && (
            <a
              href={`tel:${phoneNum}`}
              className="btn btn-secondary"
              style={{
                textDecoration: 'none',
                width: isDesktop ? undefined : '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <PhoneIcon /> Llamar
            </a>
          )}
        </div>
      </div>

      {mapLoc && (
        <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
          <div className="card-kicker">Ubicacion</div>
          <MapView lat={mapLoc.lat} lng={mapLoc.lng} />
          <p className="card-body" style={{ fontSize: 12 }}>
            {foundAt ? 'Ubicacion compartida con el dueño' : 'Zona aproximada del hogar'}
          </p>
        </div>
      )}
    </div>
  )

  const lostBanner = isLost && (
    <div style={{
      background: '#c0392b', color: '#fff',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
      animation: 'pulse-lost-banner 2s ease-in-out infinite',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      MASCOTA PERDIDA
    </div>
  )

  const locationModal = showLocationModal && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div className="card elev-md" style={{ maxWidth: 340, gap: 'var(--space-3)', textAlign: 'center', padding: 'var(--space-5)' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Compartir ubicacion
        </p>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
          {isObject
            ? 'Para ayudar al dueño a recuperar su objeto, podes enviar la ubicacion donde lo encontraste junto con el mensaje de WhatsApp.'
            : 'Para ayudar al dueño a encontrar a su mascota, podes enviar la ubicacion donde la encontraste junto con el mensaje de WhatsApp.'
          }
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <button className="btn btn-primary btn-block" onClick={() => sendWhatsApp(true)}>
            Enviar con ubicacion
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => sendWhatsApp(false)}>
            Enviar sin ubicacion
          </button>
        </div>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
        <HuellitasHeader />
        {lostBanner}
        <div style={{ flex: 1, padding: '40px 48px' }}>
          <div style={{ display: 'flex', gap: 36, maxWidth: 920, margin: '0 auto', alignItems: 'flex-start' }}>
            {profileColumn}
            {cards}
          </div>
        </div>
        <HuellitasFooter />
        {locationModal}
        <style>{`@keyframes pulse-lost-banner { 0%,100%{opacity:1} 50%{opacity:0.85} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <HuellitasHeader />
      {lostBanner}
      <div style={{ flex: 1, padding: '28px 20px 40px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {profileColumn}
        {cards}
      </div>
      <HuellitasFooter />
      {locationModal}
      <style>{`@keyframes pulse-lost-banner { 0%,100%{opacity:1} 50%{opacity:0.85} }`}</style>
    </div>
  )
}
