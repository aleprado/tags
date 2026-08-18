import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Html5Qrcode } from 'html5-qrcode'
import { storage } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { getTag, updateTag, deleteTag } from '../lib/firestore'
import AppLayout from '../layouts/AppLayout'

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
        // Extract code from URL like ".../p/HU-xxx" or use text directly
        let code = text
        try {
          const parts = new URL(text).pathname.split('/')
          const idx = parts.indexOf('p')
          if (idx >= 0 && parts[idx + 1]) code = parts[idx + 1]
        } catch { /* not a URL, use raw text */ }
        scanner.stop().catch(() => {}).then(() => onScan(code))
      },
      undefined,
    ).catch(err => setErrMsg(err?.message ?? 'No se pudo acceder a la cámara'))

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
        Apuntá la cámara al código QR del tag
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

  // Code: prefer URL param, then sessionStorage, then scanned via camera
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
  const [ownerPhone, setOwnerPhone] = useState('')
  const [active, setActive] = useState(true)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      setLoading(false)
    })
  }, [id, navigate])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!isEdit && !effectiveCode) {
      setError('Ingresá el código del tag para activarlo.')
      return
    }
    setSaving(true)
    setError('')
    try {
      let finalPhotoUrl = photoUrl
      if (photoFile) {
        const storageRef = ref(storage, `pets/${user.uid}/${Date.now()}_${photoFile.name}`)
        await uploadBytes(storageRef, photoFile)
        finalPhotoUrl = await getDownloadURL(storageRef)
      }

      const tagData = {
        type: tagType,
        active,
        petName: tagType === 'mascota' ? petName : undefined,
        species: tagType === 'mascota' ? species : undefined,
        age: tagType === 'mascota' ? age : undefined,
        healthNotes: tagType === 'mascota' ? healthNotes : undefined,
        ownerName: tagType === 'mascota' ? ownerName : undefined,
        ownerPhone: tagType === 'mascota' ? ownerPhone : undefined,
        photoUrl: finalPhotoUrl || undefined,
      }

      if (isEdit && id) {
        await updateTag(id, tagData)
      } else {
        const fn = httpsCallable<{ code: string; tagData: Record<string, unknown> }, { tagId: string }>(
          getFunctions(), 'claimCode'
        )
        await fn({ code: effectiveCode, tagData })
        sessionStorage.removeItem('pendingCode')
      }
      navigate('/app/tags')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id || !confirm('¿Eliminar este tag? Esta acción no se puede deshacer.')) return
    await deleteTag(id)
    navigate('/app/tags')
  }

  if (loading) {
    return (
      <AppLayout>
        <p style={{ opacity: 0.6 }}>Cargando…</p>
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
        <label htmlFor="pf-health">Condiciones de salud / alergias</label>
        <textarea className="input" id="pf-health" rows={3} value={healthNotes} onChange={e => setHealthNotes(e.target.value)} placeholder="Ej: Alergia al polen, vacunas al día…" />
      </div>

      {twoCol ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div className="field">
            <label htmlFor="pf-owner">Nombre del dueño</label>
            <input className="input" id="pf-owner" value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-phone">Teléfono de contacto</label>
            <input className="input" id="pf-phone" type="tel" placeholder="+54 9 11 …" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="pf-owner">Nombre del dueño</label>
            <input className="input" id="pf-owner" value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-phone">Teléfono de contacto</label>
            <input className="input" id="pf-phone" type="tel" placeholder="+54 9 11 …" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
          </div>
        </>
      )}
    </>
  )

  return (
    <AppLayout>
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
              Para activar tu tag necesitás escanear el QR del llavero físico.
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
            <div className="card elev-sm" style={{ alignItems: 'center', textAlign: 'center', gap: 6, padding: 'var(--space-6) var(--space-3)' }}>
              <div className="card-kicker">Próximamente</div>
              <p className="card-body">Los campos para objetos se habilitan sin rediseñar la app.</p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
            <span style={{ fontSize: 13 }}>Tag activo</span>
            <Switch active={active} onToggle={() => setActive(a => !a)} />
          </div>

          {tagType === 'mascota' && (
            <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}
        </div>

        {/* Desktop layout */}
        <div className="desktop-only" style={{ display: 'flex', gap: 36, maxWidth: 920, alignItems: 'flex-start' }}>
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>{photoSlot(120)}</div>
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

          {tagType === 'mascota' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {mascotaFields(true)}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
                <span style={{ fontSize: 13 }}>Tag activo</span>
                <Switch active={active} onToggle={() => setActive(a => !a)} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {isEdit && (
                  <button type="button" className="btn btn-ghost" onClick={handleDelete} style={{ color: 'var(--color-accent-700)' }}>
                    Eliminar tag
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card elev-sm" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 6, padding: 'var(--space-6)' }}>
              <div className="card-kicker">Próximamente</div>
              <p className="card-body">Los campos para objetos (contacto, recompensa, descripción) usan la misma estructura modular — se habilitan sin rediseñar la app.</p>
            </div>
          )}
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
  )
}
