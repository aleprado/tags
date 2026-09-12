import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { createQrGrid, codeUrl, type QrGrid } from '../lib/qr'
import {
  DEFAULT_TAG3D, computeLayout, plateFootprint, buildSheet,
  chunkSheets, slotOffset, MIN_MODULE_MM,
  type Tag3DParams,
} from '../lib/tag3d'
import { dropOutline } from '../lib/mesh'
import { downloadBlob } from '../lib/download'
import { zipFiles, type ZipEntry } from '../lib/zip'

const MAX_SHEETS_ZIP = 12

const C_BG = '#f5ead8'
const C_FG = '#201e1d'

function Num({ label, value, step = 0.1, min, max, onChange, suffix }: {
  label: string; value: number; step?: number; min?: number; max?: number
  onChange: (n: number) => void; suffix?: string
}) {
  return (
    <div className="field">
      <label style={{ fontSize: 11 }}>{label}{suffix ? ` (${suffix})` : ''}</label>
      <input
        className="input"
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        style={{ fontSize: 13, padding: '6px 8px' }}
      />
    </div>
  )
}

function plateOutlinePath(outline: { x: number; y: number }[], hole: { cx: number; cy: number; r: number }): string {
  const f = (n: number) => n.toFixed(3)
  const poly = outline.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)},${f(p.y)}`).join('') + 'Z'
  const { cx, cy, r } = hole
  const circle =
    `M${f(cx + r)},${f(cy)}` +
    `A${f(r)},${f(r)} 0 1 0 ${f(cx - r)},${f(cy)}` +
    `A${f(r)},${f(r)} 0 1 0 ${f(cx + r)},${f(cy)}Z`
  return `${poly}${circle}`
}

function outlinePath(pts: { x: number; y: number }[]): string {
  const f = (n: number) => n.toFixed(2)
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)},${f(p.y)}`).join('') + 'Z'
}

export default function Print3D() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const codesParam = searchParams.get('codes') ?? ''
  const codes = useMemo(() => codesParam.split(',').filter(Boolean), [codesParam])

  const [p, setP] = useState<Tag3DParams>(DEFAULT_TAG3D)
  const [qr, setQr] = useState<QrGrid | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const set = <K extends keyof Tag3DParams>(k: K, v: Tag3DParams[K]) =>
    setP(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!codes[0]) return
    let cancelled = false
    createQrGrid(codeUrl(codes[0]), p.qrEcl)
      .then(g => { if (!cancelled) setQr(g) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [codes, p.qrEcl])

  const layout = qr ? computeLayout(p, qr.size) : null
  const footprint = qr && layout ? plateFootprint(p, layout, qr) : null
  const perSheet = p.cols * p.rows
  const sheets = chunkSheets(codes, perSheet)
  const hasError = layout?.issues.some(i => i.level === 'error') ?? false

  const gridSlots = useMemo(() => {
    const slots: Array<{ dx: number; dy: number; flip: boolean }> = []
    for (let i = 0; i < p.cols * p.rows; i++) slots.push(slotOffset(i, p))
    return slots
  }, [p.cols, p.rows, p.pitchX, p.pitchY, p.interleave])

  const gridOutlines = useMemo(() => {
    return gridSlots.map(({ dx, dy, flip }) => {
      const pts = dropOutline(dx, dy, p.plateW, p.plateH, p.topR, 2)
      if (flip) for (const pt of pts) pt.y = 2 * dy - pt.y
      return pts
    })
  }, [gridSlots, p.plateW, p.plateH, p.topR])

  async function downloadSheet(index: number) {
    if (busy) return
    setBusy(`sheet-${index}`)
    setError('')
    try {
      const res = await buildSheet(sheets[index], p)
      downloadBlob(res.blob, `huellitas-placa-${index + 1}.stl`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function downloadAll() {
    if (busy || progress) return
    if (sheets.length > MAX_SHEETS_ZIP) {
      setError(`Son ${sheets.length} placas: máximo ${MAX_SHEETS_ZIP * perSheet} códigos por vez.`)
      return
    }
    setProgress({ done: 0, total: sheets.length })
    setError('')
    try {
      const entries: ZipEntry[] = []
      for (let i = 0; i < sheets.length; i++) {
        const res = await buildSheet(sheets[i], p)
        entries.push({
          name: `huellitas-placa-${i + 1}.stl`,
          data: new Uint8Array(await res.blob.arrayBuffer()),
        })
        setProgress({ done: i + 1, total: sheets.length })
        await new Promise(r => setTimeout(r))
      }
      downloadBlob(
        await zipFiles(entries),
        `huellitas-stl-${new Date().toISOString().slice(0, 10)}.zip`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Volver</button>
          <h2 style={{ margin: 0, fontSize: 19 }}>Chapitas 3D</h2>
          <div style={{ flex: 1 }} />
          {layout && (
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {codes.length} código{codes.length !== 1 ? 's' : ''} · {sheets.length} placa{sheets.length !== 1 ? 's' : ''} ·{' '}
              {perSheet}/placa · módulo{' '}
              <strong style={{ color: layout.moduleMm < MIN_MODULE_MM ? 'var(--color-accent-700)' : undefined }}>
                {layout.moduleMm.toFixed(3)} mm
              </strong>
            </span>
          )}
        </div>

        {codes.length === 0 && (
          <div className="card elev-sm" style={{ alignItems: 'center', padding: 'var(--space-6)' }}>
            <p style={{ margin: 0, opacity: 0.6 }}>No hay códigos seleccionados.</p>
          </div>
        )}

        {codes.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Parámetros */}
              <div className="card elev-sm" style={{ flex: '1 1 380px', gap: 'var(--space-3)' }}>
                <div className="card-kicker">Parámetros</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <Num label="Ancho" suffix="mm" value={p.plateW} min={10} onChange={v => set('plateW', v)} />
                  <Num label="Alto" suffix="mm" value={p.plateH} min={10} onChange={v => set('plateH', v)} />
                  <Num label="Radio sup." suffix="mm" value={p.topR} min={1} onChange={v => set('topR', v)} />
                  <Num label="Espesor base" suffix="mm" value={p.baseThickness} min={0.4} onChange={v => set('baseThickness', v)} />
                  {!p.inlay && <Num label="Relieve QR" suffix="mm" value={p.qrReliefH} min={0.2} onChange={v => set('qrReliefH', v)} />}
                  {p.inlay && <Num label="Capa inlay" suffix="mm" value={p.inlayH} min={0.2} max={1} step={0.2} onChange={v => set('inlayH', v)} />}
                  <Num label="Fillet" suffix="mm" value={p.chamfer} min={0} max={2} onChange={v => set('chamfer', v)} />
                  <Num label="Módulos quiet" value={p.quietModules} step={1} min={0} max={4} onChange={v => set('quietModules', v)} />
                  <Num label="Ø agujero" suffix="mm" value={p.holeD} min={1} onChange={v => set('holeD', v)} />
                  <Num label="Margen agujero" suffix="mm" value={p.holeMarginTop} min={0.5} onChange={v => set('holeMarginTop', v)} />
                  <Num label="Logo pata Ø" suffix="mm" value={p.pawSize} min={0} onChange={v => set('pawSize', v)} />
                  <div className="field">
                    <label style={{ fontSize: 11 }}>Corrección QR</label>
                    <select
                      className="input"
                      value={p.qrEcl}
                      onChange={e => set('qrEcl', e.target.value as Tag3DParams['qrEcl'])}
                      style={{ fontSize: 13, padding: '6px 8px' }}
                    >
                      <option value="L">L — 7%</option>
                      <option value="M">M — 15%</option>
                      <option value="Q">Q — 25%</option>
                      <option value="H">H — 30%</option>
                    </select>
                  </div>
                  <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={p.inlay}
                      onChange={e => set('inlay', e.target.checked)}
                      id="inlay"
                    />
                    <label htmlFor="inlay" style={{ fontSize: 11 }}>Inlay 2 colores</label>
                  </div>
                  <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={p.interleave}
                      onChange={e => set('interleave', e.target.checked)}
                      id="interleave"
                    />
                    <label htmlFor="interleave" style={{ fontSize: 11 }}>Intercalar</label>
                  </div>
                  <Num label="Columnas" value={p.cols} step={1} min={1} onChange={v => set('cols', v)} />
                  <Num label="Filas" value={p.rows} step={1} min={1} onChange={v => set('rows', v)} />
                  <Num label="Paso X" suffix="mm" value={p.pitchX} min={1} onChange={v => set('pitchX', v)} />
                  <Num label="Paso Y" suffix="mm" value={p.pitchY} min={1} onChange={v => set('pitchY', v)} />
                </div>

                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, alignSelf: 'flex-start' }}
                  onClick={() => setP(DEFAULT_TAG3D)}
                >
                  Restaurar valores por defecto
                </button>
              </div>

              {/* Previews */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', flex: '0 0 280px' }}>
                {/* Tag preview */}
                <div className="card elev-sm" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                  <div className="card-kicker" style={{ alignSelf: 'flex-start' }}>Vista previa</div>
                  {footprint && layout ? (
                    <svg
                      viewBox={`${-p.plateW / 2} ${-p.plateH / 2} ${p.plateW} ${p.plateH}`}
                      style={{ width: '100%', maxWidth: 180, display: 'block', borderRadius: 8 }}
                    >
                      <g transform="scale(1,-1)">
                        <path d={plateOutlinePath(footprint.outline, footprint.hole)} fill={C_BG} fillRule="evenodd" />
                        {footprint.qrRects.map((r, i) => (
                          <rect key={`q${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={C_FG} />
                        ))}
                        {footprint.paw && (() => {
                          const { cx, cy, R } = footprint.paw!
                          const tr = 0.307 * R
                          return (
                            <g transform={`rotate(-12, ${cx}, ${cy})`}>
                              <circle cx={cx} cy={cy} r={R} fill={C_FG} opacity={0.18} />
                              <ellipse cx={cx} cy={cy - 0.455 * R} rx={0.636 * R} ry={0.545 * R} fill={C_FG} />
                              {([[-0.625, 0.375], [0, 0.648], [0.625, 0.375]] as [number, number][]).map(([dx, dy], i) => (
                                <circle key={i} cx={cx + dx * R} cy={cy + dy * R} r={tr} fill={C_FG} />
                              ))}
                            </g>
                          )
                        })()}
                      </g>
                    </svg>
                  ) : (
                    <div style={{ padding: 30, opacity: 0.5, fontSize: 13 }}>Generando…</div>
                  )}
                  {layout && (
                    <div style={{ fontSize: 11, opacity: 0.55, textAlign: 'center', lineHeight: 1.6 }}>
                      QR {layout.qrModules}×{layout.qrModules} · {layout.qrSize.toFixed(1)}mm ·
                      módulo {layout.moduleMm.toFixed(3)}mm
                    </div>
                  )}
                </div>

                {/* Grid preview */}
                <div className="card elev-sm" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                  <div className="card-kicker" style={{ alignSelf: 'flex-start' }}>
                    Layout en placa · {layout?.sheetSpanX.toFixed(0)}×{layout?.sheetSpanY.toFixed(0)}mm
                  </div>
                  {(() => {
                    const halfBed = p.bedSize / 2
                    const margin = 5
                    return (
                      <svg
                        viewBox={`${-halfBed - margin} ${-halfBed - margin} ${p.bedSize + margin * 2} ${p.bedSize + margin * 2}`}
                        style={{ width: '100%', maxWidth: 220, display: 'block', borderRadius: 8, background: 'var(--color-neutral-100)' }}
                      >
                        <g transform="scale(1,-1)">
                          <rect
                            x={-halfBed} y={-halfBed}
                            width={p.bedSize} height={p.bedSize}
                            fill="none" stroke="var(--color-neutral-400)" strokeWidth={0.5} strokeDasharray="3,3"
                          />
                          {gridOutlines.map((outline, i) => {
                            const slot = gridSlots[i]
                            return (
                              <path
                                key={i}
                                d={outlinePath(outline)}
                                fill={slot.flip ? '#c4b5a0' : C_BG}
                                stroke={C_FG}
                                strokeWidth={0.5}
                              />
                            )
                          })}
                        </g>
                      </svg>
                    )
                  })()}
                  <p style={{ margin: 0, fontSize: 10, opacity: 0.5, textAlign: 'center', lineHeight: 1.5 }}>
                    {p.interleave ? 'Filas impares intercaladas (más oscuras)' : 'Grilla regular'}
                    {' · '}{perSheet} chapas/placa
                  </p>
                </div>
              </div>
            </div>

            {/* Avisos */}
            {(layout?.issues.length ?? 0) > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--space-3)' }}>
                {layout!.issues.map((iss, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 12,
                      padding: '8px 14px',
                      borderRadius: 10,
                      background: iss.level === 'error' ? 'var(--color-accent-100)' : 'var(--color-neutral-200)',
                      color: iss.level === 'error' ? 'var(--color-accent-800)' : undefined,
                    }}
                  >
                    {iss.level === 'error' ? '⛔ ' : '⚠️ '}{iss.msg}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10, marginTop: 'var(--space-3)', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)' }}>
                {error}
              </div>
            )}

            {/* Placas */}
            <div className="card elev-sm" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="card-kicker">Placas</div>
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                  disabled={hasError || !qr || busy !== null || progress !== null || sheets.length === 0}
                  onClick={downloadAll}
                >
                  {progress
                    ? `Generando placa ${progress.done}/${progress.total}…`
                    : sheets.length === 1 ? 'Descargar .stl' : `Descargar las ${sheets.length} (.zip)`}
                </button>
              </div>

              {sheets.map((sheet, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    padding: '8px 0', borderTop: i > 0 ? '1px solid var(--color-divider)' : undefined,
                  }}
                >
                  <span className="tag tag-neutral">Placa {i + 1}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.55, flex: 1, wordBreak: 'break-all' }}>
                    {sheet.join('  ')}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                    disabled={hasError || !qr || busy !== null || progress !== null}
                    onClick={() => downloadSheet(i)}
                  >
                    {busy === `sheet-${i}` ? 'Generando…' : `.stl (${sheet.length})`}
                  </button>
                </div>
              ))}

              <p style={{ margin: 0, fontSize: 11, opacity: 0.55, lineHeight: 1.6 }}>
                {p.inlay ? (
                  <>
                    <strong>Modo inlay (2 colores):</strong> El QR se imprime como primera capa ({p.inlayH}mm)
                    en color oscuro. En Bambu Studio, agregar un cambio de filamento en la capa{' '}
                    {Math.round(p.inlayH / 0.2)} (Z={p.inlayH}mm). Después de la pausa, cargar el filamento
                    claro para el cuerpo del tag. Al retirar de la cama, el QR queda incrustado en la cara
                    inferior con acabado liso del PEI.
                  </>
                ) : (
                  <>
                    Cada archivo trae las {perSheet} chapas ya posicionadas en la grilla. El STL binario no
                    agrupa sólidos. Bambu Studio puede ofrecer repararlo — el relieve se hunde en la base
                    a propósito, rebana bien igual. El QR sale en relieve para pintarlo con rodillo.
                  </>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
