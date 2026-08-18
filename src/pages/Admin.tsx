import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAllCodes, generateCodes, markCodeSold } from '../lib/firestore'
import { isConfigured } from '../lib/firebase'
import type { CodeDoc } from '../lib/types'
import AppLayout from '../layouts/AppLayout'

type CodeWithId = CodeDoc & { id: string }

const STATUS_LABELS: Record<CodeDoc['status'], string> = {
  sin_vender: 'Sin vender',
  vendido_sin_reclamar: 'Vendido',
  reclamado: 'Reclamado',
}

const STATUS_CLASS: Record<CodeDoc['status'], string> = {
  sin_vender: 'tag-neutral',
  vendido_sin_reclamar: 'tag-accent',
  reclamado: 'tag-accent-2',
}

const QR_BASE = 'https://storage.googleapis.com/tags-8bcd8.firebasestorage.app/qr'
function qrUrl(code: string) { return `${QR_BASE}/${code}.png` }

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

export default function Admin() {
  const [codes, setCodes] = useState<CodeWithId[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<CodeDoc['status'] | 'todos'>('todos')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateCount, setGenerateCount] = useState(10)
  const [generatedIds, setGeneratedIds] = useState<string[]>([])
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([])

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
    setGeneratedUrls([])
    try {
      let ids: string[]
      let urls: string[] = []
      if (isConfigured) {
        const fn = httpsCallable<{ count: number }, { codes: string[]; downloadUrls: string[] }>(
          getFunctions(),
          'generateQRBatch',
        )
        const result = await fn({ count: generateCount })
        ids = result.data.codes
        urls = result.data.downloadUrls
      } else {
        ids = await generateCodes(generateCount)
      }
      setGeneratedIds(ids)
      setGeneratedUrls(urls)
      await load()
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownloadAll() {
    for (let i = 0; i < generatedIds.length; i++) {
      const a = document.createElement('a')
      a.href = generatedUrls[i] ?? qrUrl(generatedIds[i])
      a.download = `${generatedIds[i]}.png`
      a.click()
      await new Promise(r => setTimeout(r, 150))
    }
  }

  async function handleMarkSold(code: string) {
    await markCodeSold(code, 'ml')
    setCodes(prev => prev.map(c => c.id === code ? { ...c, status: 'vendido_sin_reclamar' as const, soldChannel: 'ml' as const } : c))
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

  return (
    <AppLayout>
      <div style={{ maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24 }}>Panel Admin</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.6 }}>Gestión de códigos QR</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          {[
            { label: 'Total', value: stats.total, cls: 'tag-neutral' },
            { label: 'Sin vender', value: stats.sin_vender, cls: 'tag-neutral' },
            { label: 'Vendidos', value: stats.vendido_sin_reclamar, cls: 'tag-accent' },
            { label: 'Reclamados', value: stats.reclamado, cls: 'tag-accent-2' },
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
                  {generatedIds.length} códigos generados
                </p>
                {generatedUrls.length > 0 && (
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleDownloadAll}>
                    <DownloadIcon /> Descargar todos
                  </button>
                )}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                {generatedIds.map((id, i) => {
                  const url = generatedUrls[i] ?? qrUrl(id)
                  return (
                    <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        background: '#f5ead8',
                      }}>
                        <img src={url} alt={id} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.6, textAlign: 'center', wordBreak: 'break-all' }}>{id}</span>
                      <a
                        href={url}
                        download={`${id}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 10px', width: '100%', justifyContent: 'center' }}
                      >
                        <DownloadIcon /> Descargar
                      </a>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Search & filter */}
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
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ opacity: 0.6 }}>Cargando…</p>
        ) : (
          <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>QR</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Canal</th>
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
                  <tr key={c.id}>
                    <td style={{ width: 52 }}>
                      <a href={qrUrl(c.id)} target="_blank" rel="noreferrer" title="Ver / descargar QR">
                        <img
                          src={qrUrl(c.id)}
                          alt={c.id}
                          width={40}
                          height={40}
                          style={{ display: 'block', borderRadius: 6, border: '1px solid var(--border)' }}
                        />
                      </a>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.id}</td>
                    <td><span className={`tag ${STATUS_CLASS[c.status]}`}>{STATUS_LABELS[c.status]}</span></td>
                    <td style={{ fontSize: 13, opacity: 0.7 }}>{c.soldChannel ?? '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.6 }}>{c.tagId ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <a
                          href={qrUrl(c.id)}
                          download={`${c.id}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '3px 8px' }}
                        >
                          <DownloadIcon />
                        </a>
                        {c.status === 'sin_vender' && (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => handleMarkSold(c.id)}
                          >
                            Marcar vendido
                          </button>
                        )}
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
