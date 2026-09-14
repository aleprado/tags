import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Html5Qrcode } from 'html5-qrcode'
import { storage } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { getTag, updateTag } from '../lib/firestore'
import AppLayout from '../layouts/AppLayout'
import ActivationScene from '../components/ActivationScene'
import AlertOnboarding from '../components/AlertOnboarding'
import Switch from '../components/Switch'
import LostConfirmModal from '../components/LostConfirmModal'
import { isNotificationSupported, subscribeToAlerts } from '../lib/notifications'

const OBJECT_CATEGORIES = [
  { value: 'mochila', label: 'Mochila' },
  { value: 'cartera', label: 'Cartera' },
  { value: 'llaves', label: 'Llaves' },
  { value: 'indumentaria', label: 'Indumentaria' },
  { value: 'otro', label: 'Otro' },
] as const

function QRScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const [errMsg, setErrMsg] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode('hu-qr-scanner')
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => {
        if (stoppedRef.current) return
        stoppedRef.current = true
        let code = text
        try {
          const parts = new URL(text).pathname.split('/')
          const idx = parts.indexOf('p')
          if (idx >= 0 && parts[idx + 1]) code = parts[idx + 1]
        } catch { /* not a URL, use raw text */ }
        scanner.stop().catch(() => {}).then(() => onScan(code))
      },
      undefined,
    ).catch(err => setErrMsg(err?.message ?? 'No se pudo acceder a la camara'))

    return () => {
      if (!stoppedRef.current) {
        scanner.stop().catch(() => {})
      }
    }
  }, [onScan])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.93)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      padding: 24,
    }}>
      <p style={{ color: '#fff', fontSize: 15, margin: 0, textAlign: 'center', fontFamily: 'var(--font-body)' }}>
        Apunta la camara al codigo QR del tag
      </p>
      <div
        id="hu-qr-scanner"
        style={{ width: 280, height: 280, borderRadius: 16, overflow: 'hidden', background: '#111', flexShrink: 0 }}
      />
      {errMsg && (
        <p style={{ color: '#fca5a5', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 280 }}>
          {errMsg}
        </p>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => { stoppedRef.current = true; scannerRef.current?.stop().catch(() => {}); onClose() }}
        style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
      >
        Cancelar
      </button>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
    </svg>
  )
}

export default function TagForm() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code') ?? ''
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const codeFromSession = !isEdit ? (sessionStorage.getItem('pendingCode') ?? '') : ''
  const [scannedCode, setScannedCode] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const effectiveCode = codeFromUrl || codeFromSession || scannedCode

  const [tagType, setTagType] = useState<'mascota' | 'objeto'>('mascota')
  const [species, setSpecies] = useState<'perro' | 'gato'>('perro')
  const [petName, setPetName] = useState('')
  const [age, setAge] = useState('')
  const [healthNotes, setHealthNotes] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState(isEdit ? '' : '+54 ')
  const [active, setActive] = useState(true)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [showActivation, setShowActivation] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const savePromiseRef = useRef<Promise<void> | null>(null)

  // Object fields
  const [objectCategory, setObjectCategory] = useState<'mochila' | 'cartera' | 'llaves' | 'indumentaria' | 'otro'>('mochila')
  const [objectDescription, setObjectDescription] = useState('')
  const [lost, setLost] = useState(false)
  const [lostConfirm, setLostConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    getTag(id).then(tag => {
      if (!tag) { navigate('/app/tags'); return }
      setTagType(tag.type)
      if (tag.species) setSpecies(tag.species)
      setPetName(tag.petName ?? '')
      setAge(tag.age ?? '')
      setHealthNotes(tag.healthNotes ?? '')
      setOwnerName(tag.ownerName ?? '')
      setOwnerPhone(tag.ownerPhone ?? '')
      setActive(tag.active)
      setPhotoUrl(tag.photoUrl ?? '')
      if (tag.homeLocation) setHomeLocation(tag.homeLocation)
      if (tag.objectCategory) setObjectCategory(tag.objectCategory)
      setObjectDescription(tag.objectDescription ?? '')
      setLost(tag.lost ?? false)
      setLoading(false)
    })
  }, [id, navigate])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setHomeLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 },
    )
  }

  function buildTagData(finalPhotoUrl: string) {
    if (tagType === 'mascota') {
      return {
        type: tagType, active,
        petName, species, age,
        healthNotes,
        ownerName, ownerPhone,
        photoUrl: finalPhotoUrl || undefined,
        homeLocation: homeLocation ?? undefined,
      }
    }
    return {
      type: tagType, active,
      objectCategory,
      objectDescription,
      ownerName, ownerPhone,
      homeLocation: homeLocation ?? undefined,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!isEdit && !effectiveCode) {
      setError('Ingresa el codigo del tag para activarlo.')
      return
    }
    setError('')

    if (!isEdit) {
      setShowActivation(true)
      savePromiseRef.current = (async () => {
        let finalPhotoUrl = photoUrl
        if (photoFile && tagType === 'mascota') {
          const storageRef = ref(storage, `pets/${user.uid}/${Date.now()}_${photoFile.name}`)
          await uploadBytes(storageRef, photoFile)
          finalPhotoUrl = await getDownloadURL(storageRef)
        }
        const tagData = buildTagData(finalPhotoUrl)
        const fn = httpsCallable<{ code: string; tagData: Record<string, unknown> }, { tagId: string }>(
          getFunctions(), 'claimCode'
        )
        await fn({ code: effectiveCode, tagData })
        sessionStorage.removeItem('pendingCode')
      })()
      savePromiseRef.current.catch(err => {
        setShowActivation(false)
        setError(err instanceof Error ? err.message : 'Error al guardar')
      })
      return
    }

    setSaving(true)
    try {
      let finalPhotoUrl = photoUrl
      if (photoFile && tagType === 'mascota') {
        const storageRef = ref(storage, `pets/${user.uid}/${Date.now()}_${photoFile.name}`)
        await uploadBytes(storageRef, photoFile)
        finalPhotoUrl = await getDownloadURL(storageRef)
      }
      const tagData = buildTagData(finalPhotoUrl)
      await updateTag(id!, tagData)
      navigate('/app/tags')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleLost() {
    if (!id) return
    const next = !lost
    setLost(next)
    setLostConfirm(false)
    await updateTag(id, { lost: next })
  }

  async function handleDelete() {
    if (!id || !confirm('Eliminar este tag? El codigo QR quedara libre para ser activado por cualquier cuenta.')) return
    setDeleting(true)
    try {
      const fn = httpsCallable<{ tagId: string }, { success: boolean }>(getFunctions(), 'deleteTag')
      await fn({ tagId: id })
      setToast('Tag eliminado. El llavero fisico puede volver a activarse con cualquier cuenta.')
      setTimeout(() => navigate('/app/tags'), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <p style={{ opacity: 0.6 }}>Cargando...</p>
      </AppLayout>
    )
  }

  const preview = photoPreview || photoUrl

  const photoSlot = (size: number) => (
    <div
      onClick={() => fileRef.current?.click()}
      style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        background: 'var(--color-neutral-200)', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        border: '2px dashed var(--color-divider)', position: 'relative',
      }}
    >
      {preview
        ? <img src={preview} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--color-neutral-600)', fontSize: 11 }}>
            <UploadIcon />
            Subir foto
          </div>
      }
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
    </div>
  )

  const mascotaFields = (twoCol: boolean) => (
    <>
      {twoCol ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="pf-name">Nombre de la mascota</label>
            <input className="input" id="pf-name" value={petName} onChange={e => setPetName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-age">Edad</label>
            <input className="input" id="pf-age" placeholder="Ej: 3 años" value={age} onChange={e => setAge(e.target.value)} />
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="pf-name">Nombre de la mascota</label>
            <input className="input" id="pf-name" value={petName} onChange={e => setPetName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-age">Edad</label>
            <input className="input" id="pf-age" placeholder="Ej: 3 años" value={age} onChange={e => setAge(e.target.value)} />
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="pf-desc">Descripcion</label>
        <textarea className="input" id="pf-desc" rows={3} value={healthNotes} onChange={e => setHealthNotes(e.target.value)} placeholder="Ej: Alergia al polen, es asustadizo, muerde si se lo acorrala..." />
        <span style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
          Condiciones de salud, temperamento, o cualquier dato util para quien lo encuentre.
        </span>
      </div>

      {twoCol ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="pf-owner">Nombre del dueño</label>
            <input className="input" id="pf-owner" value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-phone">Telefono de contacto</label>
            <input className="input" id="pf-phone" type="tel" placeholder="+54 9 11 ..." value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="pf-owner">Nombre del dueño</label>
            <input className="input" id="pf-owner" value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-phone">Telefono de contacto</label>
            <input className="input" id="pf-phone" type="tel" placeholder="+54 9 11 ..." value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
          </div>
        </>
      )}
    </>
  )

  const objetoFields = (twoCol: boolean) => (
    <>
      <div className="field">
        <label htmlFor="pf-obj-cat">Categoria</label>
        <div className="seg" style={{ width: '100%', flexWrap: 'wrap' }}>
          {OBJECT_CATEGORIES.map(cat => (
            <label className="seg-opt" key={cat.value}>
              <input type="radio" name="objcat" checked={objectCategory === cat.value} onChange={() => setObjectCategory(cat.value)} />
              {cat.label}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="pf-obj-desc">Descripcion</label>
        <textarea className="input" id="pf-obj-desc" rows={3} value={objectDescription} onChange={e => setObjectDescription(e.target.value)} placeholder="Ej: Mochila negra North Face, tiene un llavero rojo..." />
        <span style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
          Color, marca, contenido importante, o cualquier dato que ayude a identificarlo.
        </span>
      </div>

      {twoCol ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="pf-obj-owner">Tu nombre</label>
            <input className="input" id="pf-obj-owner" value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-obj-phone">Telefono de contacto</label>
            <input className="input" id="pf-obj-phone" type="tel" placeholder="+54 9 11 ..." value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="pf-obj-owner">Tu nombre</label>
            <input className="input" id="pf-obj-owner" value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-obj-phone">Telefono de contacto</label>
            <input className="input" id="pf-obj-phone" type="tel" placeholder="+54 9 11 ..." value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
          </div>
        </>
      )}
    </>
  )

  const actionButtons = (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={locating}
        onClick={handleUseMyLocation}
        style={{ alignSelf: 'flex-start' }}
      >
        {locating ? 'Obteniendo ubicacion...' : homeLocation ? 'Ubicacion guardada' : 'Usar mi ubicacion (home)'}
      </button>
      {homeLocation && (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>
          {homeLocation.lat.toFixed(5)}, {homeLocation.lng.toFixed(5)}
        </p>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <button type="submit" className="btn btn-primary" disabled={saving || deleting}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {isEdit && (
          <button type="button" className="btn btn-ghost" onClick={handleDelete} disabled={deleting} style={{ color: 'var(--color-accent-700)' }}>
            {deleting ? 'Eliminando...' : 'Eliminar tag'}
          </button>
        )}
      </div>
      {isEdit && (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.5, lineHeight: 1.5 }}>
          Al eliminar, el llavero fisico queda libre y puede ser activado nuevamente por cualquier cuenta.
        </p>
      )}
    </>
  )

  return (
    <>
    <AppLayout>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a18', color: '#fff',
          padding: '12px 22px', borderRadius: 999, zIndex: 600,
          fontSize: 13, lineHeight: 1.5, textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          maxWidth: 360, width: 'calc(100% - 48px)',
        }}>
          {toast}
        </div>
      )}
      {lostConfirm && (
        <LostConfirmModal
          petName={petName || 'tu mascota'}
          hasLocation={!!homeLocation}
          onConfirm={handleToggleLost}
          onCancel={() => setLostConfirm(false)}
        />
      )}

      <form onSubmit={handleSave}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)' }}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate('/app/tags')} style={{ padding: 4 }}>
            <BackIcon />
          </button>
          <h2 style={{ margin: 0, fontSize: 19 }}>{isEdit ? 'Editar tag' : 'Nuevo tag'}</h2>
        </div>

        {!isEdit && effectiveCode && (
          <div style={{ fontSize: 13, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', padding: '8px 14px', borderRadius: 999, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>Activando tag: <strong style={{ fontFamily: 'monospace' }}>{effectiveCode}</strong></span>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setShowScanner(true)}>
              Cambiar
            </button>
          </div>
        )}
        {!isEdit && !effectiveCode && (
          <div className="card elev-sm" style={{ marginBottom: 'var(--space-3)', alignItems: 'center', textAlign: 'center', gap: 'var(--space-3)', padding: 'var(--space-5) var(--space-4)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M14 14h3v3h-3zM17.5 17.5H21V21h-3.5z"/>
            </svg>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
              Para activar tu tag necesitas escanear el QR del llavero fisico.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setShowScanner(true)}>
              Escanear QR
            </button>
          </div>
        )}
        {showScanner && (
          <QRScanner
            onScan={code => { setScannedCode(code); setShowScanner(false) }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {error && (
          <div style={{ fontSize: 13, color: 'var(--color-accent-700)', background: 'var(--color-accent-100)', padding: '8px 14px', borderRadius: 999, marginBottom: 'var(--space-3)' }}>
            {error}
          </div>
        )}

        {/* Mobile layout */}
        <div className="mobile-only" style={{ display: 'none', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="field">
            <label>Tipo de tag</label>
            <div className="seg" style={{ width: '100%' }}>
              <label className="seg-opt"><input type="radio" name="tagtype" checked={tagType === 'mascota'} onChange={() => setTagType('mascota')} />Mascota</label>
              <label className="seg-opt"><input type="radio" name="tagtype" checked={tagType === 'objeto'} onChange={() => setTagType('objeto')} />Objeto</label>
            </div>
          </div>

          {tagType === 'mascota' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>{photoSlot(96)}</div>
              <div className="field">
                <label>Especie</label>
                <div className="seg" style={{ width: '100%' }}>
                  <label className="seg-opt"><input type="radio" name="species" checked={species === 'perro'} onChange={() => setSpecies('perro')} />Perro</label>
                  <label className="seg-opt"><input type="radio" name="species" checked={species === 'gato'} onChange={() => setSpecies('gato')} />Gato</label>
                </div>
              </div>
              {mascotaFields(false)}
            </>
          ) : (
            <>
              {objetoFields(false)}
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
            <span style={{ fontSize: 13 }}>Tag activo</span>
            <Switch active={active} onToggle={() => setActive(a => !a)} />
          </div>

          {isEdit && tagType === 'mascota' && (
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              border: lost ? '1px solid #c0392b' : '1px solid var(--color-divider)',
              background: lost ? '#fde8e8' : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: lost ? '#c0392b' : undefined }}>
                  {lost ? 'Mascota marcada como perdida' : 'Reportar mascota perdida'}
                </span>
                {!homeLocation && !lost && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
                    Agrega tu ubicacion para que las alertas lleguen a tus vecinos.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => lost ? handleToggleLost() : setLostConfirm(true)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, flexShrink: 0,
                  color: lost ? '#c0392b' : '#fff',
                  background: lost ? 'transparent' : '#c0392b',
                  border: lost ? '1px solid #c0392b' : 'none',
                  borderRadius: 999,
                }}
              >
                {lost ? 'Encontrada' : 'En alerta'}
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={locating}
            onClick={handleUseMyLocation}
          >
            {locating ? 'Obteniendo ubicacion...' : homeLocation ? `Ubicacion guardada (${homeLocation.lat.toFixed(4)}, ${homeLocation.lng.toFixed(4)})` : 'Usar mi ubicacion (home)'}
          </button>
          <button type="submit" className="btn btn-primary btn-block" disabled={saving || deleting}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {isEdit && (
            <>
              <button type="button" className="btn btn-ghost btn-block" onClick={handleDelete} disabled={deleting} style={{ color: 'var(--color-accent-700)' }}>
                {deleting ? 'Eliminando...' : 'Eliminar tag'}
              </button>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.5, lineHeight: 1.5, textAlign: 'center' }}>
                Al eliminar, el llavero fisico queda libre y puede ser activado por cualquier cuenta.
              </p>
            </>
          )}
        </div>

        {/* Desktop layout */}
        <div className="desktop-only" style={{ display: 'flex', gap: 36, maxWidth: 920, alignItems: 'flex-start' }}>
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {tagType === 'mascota' && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>{photoSlot(120)}</div>
            )}
            <div className="field">
              <label>Tipo de tag</label>
              <div className="seg" style={{ width: '100%' }}>
                <label className="seg-opt"><input type="radio" name="tagtype-d" checked={tagType === 'mascota'} onChange={() => setTagType('mascota')} />Mascota</label>
                <label className="seg-opt"><input type="radio" name="tagtype-d" checked={tagType === 'objeto'} onChange={() => setTagType('objeto')} />Objeto</label>
              </div>
            </div>
            {tagType === 'mascota' && (
              <div className="field">
                <label>Especie</label>
                <div className="seg" style={{ width: '100%' }}>
                  <label className="seg-opt"><input type="radio" name="species-d" checked={species === 'perro'} onChange={() => setSpecies('perro')} />Perro</label>
                  <label className="seg-opt"><input type="radio" name="species-d" checked={species === 'gato'} onChange={() => setSpecies('gato')} />Gato</label>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {tagType === 'mascota' ? mascotaFields(true) : objetoFields(true)}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
              <span style={{ fontSize: 13 }}>Tag activo</span>
              <Switch active={active} onToggle={() => setActive(a => !a)} />
            </div>
            {isEdit && tagType === 'mascota' && (
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                border: lost ? '1px solid #c0392b' : '1px solid var(--color-divider)',
                background: lost ? '#fde8e8' : undefined,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: lost ? '#c0392b' : undefined }}>
                    {lost ? 'Mascota marcada como perdida' : 'Reportar mascota perdida'}
                  </span>
                  {!homeLocation && !lost && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
                      Agrega tu ubicacion para que las alertas lleguen a tus vecinos.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => lost ? handleToggleLost() : setLostConfirm(true)}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, flexShrink: 0,
                    color: lost ? '#c0392b' : '#fff',
                    background: lost ? 'transparent' : '#c0392b',
                    border: lost ? '1px solid #c0392b' : 'none',
                    borderRadius: 999,
                  }}
                >
                  {lost ? 'Encontrada' : 'En alerta'}
                </button>
              </div>
            )}
            {actionButtons}
          </div>
        </div>
      </form>

      <style>{`
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
        @media (min-width: 768px) {
          .mobile-only { display: none !important; }
          .desktop-only { display: flex !important; }
        }
      `}</style>
    </AppLayout>
    {showActivation && (
      <ActivationScene
        petName={tagType === 'mascota' ? petName : (OBJECT_CATEGORIES.find(c => c.value === objectCategory)?.label ?? 'Objeto')}
        onDone={async () => {
          try { if (savePromiseRef.current) await savePromiseRef.current } catch { return }
          setShowActivation(false)
          const onboardingDone = localStorage.getItem('huellitas_alert_onboarding_done')
          if (tagType === 'mascota' && !onboardingDone && isNotificationSupported()) {
            setShowOnboarding(true)
          } else {
            navigate('/app/tags')
          }
        }}
      />
    )}
    {showOnboarding && (
      <AlertOnboarding
        onSubscribe={async () => {
          if (!user) throw new Error('No autenticado')
          const loc = homeLocation ?? await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              reject,
              { timeout: 8000 },
            )
          })
          await subscribeToAlerts(user.uid, loc)
        }}
        onDone={() => {
          localStorage.setItem('huellitas_alert_onboarding_done', '1')
          setShowOnboarding(false)
          navigate('/app/tags')
        }}
      />
    )}
  </>
  )
}
