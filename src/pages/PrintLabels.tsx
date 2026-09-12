import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { qrSvgForCode } from '../lib/qr'

export default function PrintLabels() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const codesParam = searchParams.get('codes') ?? ''
  const codes = useMemo(() => codesParam.split(',').filter(Boolean), [codesParam])

  // Los QR se generan localmente en vez de cargarse desde Storage: así no hay
  // carrera entre la carga de las imágenes y window.print() (antes, imprimir
  // antes de que cargaran dejaba recuadros vacíos) y sale vector.
  const [svgs, setSvgs] = useState<Record<string, string>>({})
  const ready = codes.length > 0 && codes.every(c => svgs[c])

  useEffect(() => {
    let cancelled = false
    setSvgs({})
    ;(async () => {
      const out: Record<string, string> = {}
      for (const code of codes) {
        out[code] = await qrSvgForCode(code)
        if (cancelled) return
        if (Object.keys(out).length % 25 === 0) await new Promise(r => setTimeout(r))
      }
      if (!cancelled) setSvgs(out)
    })()
    return () => { cancelled = true }
  }, [codes])

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .print-grid { padding: 0 !important; }
        }
        @page { size: A4 portrait; margin: 8mm; }
        .qr-slot > svg { width: 100%; height: 100%; display: block; }
      `}</style>

      <div className="no-print" style={{ padding: '20px 24px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--color-bg)' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Volver</button>
        <span style={{ opacity: 0.6, fontSize: 13 }}>{codes.length} etiqueta{codes.length !== 1 ? 's' : ''} · tamaño llavero (38 × 43 mm)</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" disabled={!ready} onClick={() => window.print()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
          {ready ? 'Imprimir' : 'Generando…'}
        </button>
      </div>

      {codes.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', opacity: 0.5 }}>
          No hay códigos seleccionados
        </div>
      ) : (
        <div className="print-grid" style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4mm',
          padding: '8mm',
          justifyContent: 'flex-start',
          background: 'white',
          minHeight: '100vh',
        }}>
          {codes.map(code => (
            <div
              key={code}
              style={{
                width: '38mm',
                height: '43mm',
                border: '0.5px dashed #bbb',
                borderRadius: '3mm',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1mm',
                padding: '2mm',
                background: '#f5ead8',
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
              }}
            >
              {/* El SVG lo genera nuestro builder y `code` no entra en él
                  (va en el <span> de abajo), así que no hay inyección posible. */}
              <div
                className="qr-slot"
                style={{ width: '32mm', height: '32mm' }}
                dangerouslySetInnerHTML={{ __html: svgs[code] ?? '' }}
              />
              <span style={{
                fontFamily: 'Georgia, serif',
                fontSize: '5.5pt',
                color: '#5a3e28',
                letterSpacing: '0.05em',
                fontStyle: 'italic',
              }}>
                Huellitas
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '3.5pt',
                color: '#8c7060',
                textAlign: 'center',
                wordBreak: 'break-all',
                lineHeight: 1.3,
              }}>
                {code}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
