import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAllCodes, generateCodes } from '../lib/firestore'
import { isConfigured } from '../lib/firebase'
import { qrStorageUrl, qrSvgForCode } from '../lib/qr'
import { downloadBlob } from '../lib/download'
import { zipFiles, type ZipEntry } from '../lib/zip'
import type { CodeDoc } from '../lib/types'
import AppLayout from '../layouts/AppLayout'

type CodeWithId = CodeDoc & { id: string }

const STATUS_LABELS: Record<CodeDoc['status'], string> = {
  sin_vender: 'Sin activar',
  vendido_sin_reclamar: 'Vendido (sin activar)',
  reclamado: 'Activado',
}

const STATUS_CLASS: Record<CodeDoc['status'], string> = {
  sin_vender: 'tag-neutral',
  vendido_sin_reclamar: 'tag-accent',
  reclamado: 'tag-accent-2',
}

/** El QR de Storage puede tardar unos segundos tras generar el lote. */
function qrThumbMissing(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.target as HTMLImageElement
  img.style.opacity = '0.25'
  img.title = 'QR todavía no disponible en Storage'
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="M12 5v14"/>
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
    </svg>
  )
}

function CubeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [codes, setCodes] = useState<CodeWithId[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<CodeDoc['status'] | 'todos'>('todos')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateCount, setGenerateCount] = useState(10)
  const [generatedIds, setGeneratedIds] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null)

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const data = await getAllCodes()
    setCodes(data)
    setLoading(false)
  }

  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    setGeneratedIds([])
    try {
      let ids: string[]
      if (isConfigured) {
        const fn = httpsCallable<{ count: number }, { codes: string[]; downloadUrls: string[] }>(
          getFunctions(),
          'generateQRBatch',
        )
        const result = await fn({ count: generateCount })
        ids = result.data.codes
      } else {
        ids = await generateCodes(generateCount)
      }
      setGeneratedIds(ids)
      await load()
    } finally {
      setGenerating(false)
    }
  }

  /** Genera el SVG en el cliente. Descargar desde Storage no funciona: el
   *  atributo `download` se ignora en links cross-origin. */
  async function handleDownloadOne(code: string) {
    if (busyId) return
    setBusyId(code)
    try {
      const svg = await qrSvgForCode(code)
      downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${code}.svg`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDownloadZip(ids: string[]) {
    if (zipProgress) return
    setZipProgress({ done: 0, total: ids.length })
    try {
      const entries: ZipEntry[] = []
      for (const id of ids) {
        entries.push({ name: `${id}.svg`, data: await qrSvgForCode(id) })
        setZipProgress({ done: entries.length, total: ids.length })
        // Cede el event loop cada 25 para que la UI no se congele.
        if (entries.length % 25 === 0) await new Promise(r => setTimeout(r))
      }
      const blob = await zipFiles(entries)
      downloadBlob(blob, `huellitas-qr-${new Date().toISOString().slice(0, 10)}.zip`)
    } finally {
      setZipProgress(null)
    }
  }

  const filtered = codes.filter(c => {
    const matchSearch = !search || c.id.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total: codes.length,
    sin_vender: codes.filter(c => c.status === 'sin_vender').length,
    vendido_sin_reclamar: codes.filter(c => c.status === 'vendido_sin_reclamar').length,
    reclamado: codes.filter(c => c.status === 'reclamado').length,
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))

  return (
    <AppLayout>
      <div style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Panel Admin</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.6 }}>Gestión de códigos QR</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          {[
            { label: 'Total generados', value: stats.total, cls: 'tag-neutral' },
            { label: 'Sin activar', value: stats.sin_vender + stats.vendido_sin_reclamar, cls: 'tag-neutral' },
            { label: 'Activados', value: stats.reclamado, cls: 'tag-accent-2' },
          ].map(s => (
            <div key={s.label} className="card elev-sm" style={{ alignItems: 'center', gap: 4, padding: 'var(--space-3)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{s.value}</div>
              <span className={`tag ${s.cls}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Generate codes */}
        <div className="card elev-sm" style={{ marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
          <div className="card-kicker">Generar lote de códigos</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="field" style={{ width: 120 }}>
              <label htmlFor="gen-count">Cantidad</label>
              <input
                className="input"
                id="gen-count"
                type="number"
                min={1}
                max={500}
                value={generateCount}
                onChange={e => setGenerateCount(Number(e.target.value))}
              />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                <PlusIcon /> {generating ? 'Generando…' : `Generar ${generateCount} código${generateCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {generatedIds.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', gap: 8, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
                  {generatedIds.length} código{generatedIds.length !== 1 ? 's' : ''} generados
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                    onClick={() => navigate(`/admin/print?codes=${generatedIds.join(',')}`)}
                  >
                    <PrintIcon /> Imprimir lote
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                    onClick={() => navigate(`/admin/print3d?codes=${generatedIds.join(',')}`)}
                  >
                    <CubeIcon /> STL 3D
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    disabled={zipProgress !== null}
                    onClick={() => handleDownloadZip(generatedIds)}
                  >
                    <DownloadIcon />{' '}
                    {zipProgress ? `${zipProgress.done}/${zipProgress.total}…` : 'Descargar .zip'}
                  </button>
                </div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                {generatedIds.map(id => (
                  <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: '#f5ead8',
                    }}>
                      <img
                        src={qrStorageUrl(id)}
                        alt={id}
                        onError={qrThumbMissing}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.6, textAlign: 'center', wordBreak: 'break-all' }}>{id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search, filter & bulk print */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Buscar por código…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <div className="seg">
            {(['todos', 'sin_vender', 'vendido_sin_reclamar', 'reclamado'] as const).map(s => (
              <label key={s} className="seg-opt">
                <input type="radio" name="filter-status" checked={filterStatus === s} onChange={() => setFilterStatus(s)} />
                {s === 'todos' ? 'Todos' : STATUS_LABELS[s]}
              </label>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button
            className={selected.size > 0 ? 'btn btn-primary' : 'btn btn-ghost'}
            disabled={selected.size === 0}
            onClick={() => navigate(`/admin/print?codes=${[...selected].join(',')}`)}
          >
            <PrintIcon />
            {selected.size > 0
              ? `Imprimir ${selected.size} seleccionado${selected.size !== 1 ? 's' : ''}`
              : 'Imprimir seleccionados'}
          </button>
          <button
            className={selected.size > 0 ? 'btn btn-secondary' : 'btn btn-ghost'}
            disabled={selected.size === 0}
            onClick={() => navigate(`/admin/print3d?codes=${[...selected].join(',')}`)}
            title="Generar STL para impresión 3D"
          >
            <CubeIcon /> {selected.size > 0 ? `STL 3D (${selected.size})` : 'STL 3D'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={selected.size === 0 || zipProgress !== null}
            onClick={() => handleDownloadZip([...selected])}
            title="Descargar los SVG seleccionados en un ZIP"
          >
            <DownloadIcon />{' '}
            {zipProgress ? `${zipProgress.done}/${zipProgress.total}…` : `.zip${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ opacity: 0.6 }}>Cargando…</p>
        ) : (
          <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={e => {
                        if (e.target.checked) setSelected(new Set(filtered.map(c => c.id)))
                        else setSelected(new Set())
                      }}
                    />
                  </th>
                  <th>QR</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Tag ID</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: 'var(--space-6)' }}>
                      No hay códigos
                    </td>
                  </tr>
                )}
                {filtered.map(c => (
                  <tr key={c.id} style={{ background: selected.has(c.id) ? 'var(--color-accent-100)' : undefined }}>
                    <td>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                    </td>
                    <td style={{ width: 52 }}>
                      <a href={qrStorageUrl(c.id)} target="_blank" rel="noreferrer" title="Ver QR">
                        <img
                          src={qrStorageUrl(c.id)}
                          alt={c.id}
                          width={40}
                          height={40}
                          onError={qrThumbMissing}
                          style={{ display: 'block', borderRadius: 6, border: '1px solid var(--border)' }}
                        />
                      </a>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.id}</td>
                    <td><span className={`tag ${STATUS_CLASS[c.status]}`}>{STATUS_LABELS[c.status]}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.6 }}>{c.tagId ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '3px 8px' }}
                          disabled={busyId !== null}
                          onClick={() => handleDownloadOne(c.id)}
                          title="Descargar SVG"
                        >
                          <DownloadIcon />
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '3px 8px' }}
                          onClick={() => navigate(`/admin/print?codes=${c.id}`)}
                          title="Imprimir etiqueta"
                        >
                          <PrintIcon />
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '3px 8px' }}
                          onClick={() => navigate(`/admin/print3d?codes=${c.id}`)}
                          title="Generar STL 3D"
                        >
                          <CubeIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
