/**
 * Chapita QR tipo gota para impresión 3D (Bambu Lab A1 mini).
 *
 * El mesh final NO es manifold (las cajas se hunden en la losa a propósito).
 * Los slicers libslic3r (Bambu Studio, Orca, PrusaSlicer) lo rebanan bien igual.
 */

import { StlWriter, type TriSink } from './stl'
import {
  dropOutline, addSlabWithHole, addGridRelief, addEllipseRelief, greedyRects,
  type Vec2, type Rect,
} from './mesh'
import { createQrGrid, codeUrl, checkQrOrientation, type Ecl, type QrGrid } from './qr'

export interface Tag3DParams {
  plateW: number
  plateH: number
  topR: number
  baseThickness: number
  holeD: number
  holeMarginTop: number
  qrEcl: Ecl
  quietModules: number
  qrReliefH: number
  pawSize: number
  chamfer: number
  sinkEps: number
  outlineStep: number
  cols: number
  rows: number
  pitchX: number
  pitchY: number
  interleave: boolean
  bedSize: number
}

export const DEFAULT_TAG3D: Tag3DParams = {
  plateW: 40,
  plateH: 55,
  topR: 5,
  baseThickness: 5,
  holeD: 3.5,
  holeMarginTop: 2.6,
  qrEcl: 'M',
  quietModules: 1,
  qrReliefH: 0.8,
  pawSize: 10,
  chamfer: 1.0,
  sinkEps: 0.3,
  outlineStep: 0.6,
  cols: 3,
  rows: 3,
  pitchX: 42,
  pitchY: 58,
  interleave: false,
  bedSize: 180,
}

export const MIN_MODULE_MM = 0.85

export interface Tag3DIssue { level: 'error' | 'warn'; msg: string }

export interface Tag3DLayout {
  qrModules: number
  qrSize: number
  moduleMm: number
  quietMm: number
  qrLeft: number
  qrBottom: number
  /** Centro Y del círculo inferior (relativo al centro de la chapa) */
  qrCenterY: number
  holeCy: number
  holeR: number
  sideMarginMm: number
  pawCy: number
  platesPerSheet: number
  sheetSpanX: number
  sheetSpanY: number
  issues: Tag3DIssue[]
}

export function computeLayout(p: Tag3DParams, qrModules: number): Tag3DLayout {
  const issues: Tag3DIssue[] = []
  const Rb = p.plateW / 2
  const by = -(p.plateH / 2 - Rb)
  const ty = p.plateH / 2 - p.topR

  const qrSize = Rb * Math.SQRT2 * qrModules / (qrModules + 2 * p.quietModules)
  const moduleMm = qrSize / qrModules
  const quietMm = p.quietModules * moduleMm

  const holeCy = p.plateH / 2 - p.holeMarginTop - p.holeD / 2
  const holeR = p.holeD / 2

  const xSpan = p.interleave && p.rows >= 2
    ? (p.cols - 1) * p.pitchX + p.pitchX / 2 + p.plateW
    : (p.cols - 1) * p.pitchX + p.plateW
  const ySpan = (p.rows - 1) * p.pitchY + p.plateH

  const d = ty - by
  if (d <= 0 || Rb <= p.topR || Rb - p.topR >= d) {
    issues.push({ level: 'error', msg: 'Dimensiones de la gota inválidas: ajustá ancho, alto o radio superior.' })
  }
  if (p.sinkEps >= p.baseThickness) {
    issues.push({ level: 'error', msg: 'El relieve atraviesa la base: bajá el hundido o subí el espesor.' })
  }
  if (p.holeMarginTop <= 0 || p.holeD <= 0) {
    issues.push({ level: 'error', msg: 'El agujero tiene dimensiones inválidas.' })
  }
  const holeDistFromTopCenter = Math.abs(holeCy - ty)
  if (holeDistFromTopCenter + holeR > p.topR - 0.5) {
    issues.push({ level: 'error', msg: 'El agujero no cabe en el capuchón superior.' })
  }
  if (p.pitchX < p.plateW || p.pitchY < p.plateH * 0.5) {
    issues.push({ level: 'error', msg: 'El paso de la grilla es demasiado chico: se superpondrían.' })
  }
  if (Math.max(xSpan, ySpan) > p.bedSize) {
    issues.push({ level: 'error', msg: `La placa (${xSpan.toFixed(0)}×${ySpan.toFixed(0)}mm) no entra en la cama de ${p.bedSize}mm.` })
  }

  const qrQuietTop = by + qrSize / 2 + quietMm
  const holeBottom = holeCy - holeR
  const pawCy = (qrQuietTop + holeBottom) / 2

  if (moduleMm < MIN_MODULE_MM) {
    issues.push({ level: 'warn', msg: `Módulo de ${moduleMm.toFixed(3)}mm (mínimo ${MIN_MODULE_MM}): riesgo de que no escanee.` })
  }
  if (p.holeMarginTop < 1.6) {
    issues.push({ level: 'warn', msg: 'Menos de 1.6mm sobre el agujero: punto de rotura típico.' })
  }
  if (p.qrReliefH < 0.4) {
    issues.push({ level: 'warn', msg: 'Relieve menor a 2 capas de 0.2mm.' })
  }
  if (p.pawSize > 0 && p.pawSize > holeBottom - qrQuietTop) {
    issues.push({ level: 'warn', msg: 'El logo de la pata es más grande que el espacio disponible.' })
  }

  return {
    qrModules, qrSize, moduleMm, quietMm,
    qrLeft: -qrSize / 2,
    qrBottom: by - qrSize / 2,
    qrCenterY: by,
    holeCy, holeR,
    sideMarginMm: Rb - qrSize / 2,
    pawCy,
    platesPerSheet: p.cols * p.rows,
    sheetSpanX: xSpan,
    sheetSpanY: ySpan,
    issues,
  }
}

// ─── Logo de la pata ─────────────────────────────────────────────────────────

export function buildPawRelief(
  s: TriSink,
  cx: number, cy: number,
  pawSize: number,
  zBase: number, z1: number,
  step: number,
  mirrorX = false,
): void {
  if (pawSize <= 0) return
  const R = pawSize / 2

  const mx = mirrorX ? -1 : 1
  const ang = mx * -12 * Math.PI / 180
  const ca = Math.cos(ang), sa = Math.sin(ang)
  const rot = (dx: number, dy: number): [number, number] =>
    [mx * (dx * ca - dy * sa), dx * sa + dy * ca]

  const [padDx, padDy] = rot(0, -0.455 * R)
  addEllipseRelief(s, cx + padDx, cy + padDy, 0.636 * R, 0.545 * R, zBase, z1, step)

  const tr = 0.307 * R
  for (const [dx, dy] of [
    [-0.625 * R, +0.375 * R],
    [         0, +0.648 * R],
    [+0.625 * R, +0.375 * R],
  ] as [number, number][]) {
    const [rdx, rdy] = rot(dx, dy)
    addEllipseRelief(s, cx + rdx, cy + rdy, tr, tr, zBase, z1, step)
  }
}

// ─── QR rotado 180° ──────────────────────────────────────────────────────────

function rotateQr180(qr: QrGrid): QrGrid {
  const n = qr.size
  const data = new Uint8Array(n * n)
  for (let i = 0; i < n * n; i++) data[i] = qr.data[n * n - 1 - i]
  return {
    size: n,
    version: qr.version,
    data,
    get: (row, col) => data[row * n + col] === 1,
  }
}

// ─── Construcción de la chapa ────────────────────────────────────────────────

export function buildPlate(
  s: TriSink,
  p: Tag3DParams,
  layout: Tag3DLayout,
  qr: QrGrid,
  dx = 0,
  dy = 0,
  flip = false,
): void {
  const outline = dropOutline(dx, dy, p.plateW, p.plateH, p.topR, p.outlineStep)

  if (flip) {
    for (const pt of outline) pt.y = 2 * dy - pt.y
    outline.reverse()
  }

  const ySign = flip ? -1 : 1
  const actualQr = flip ? rotateQr180(qr) : qr
  const qrCy = ySign * layout.qrCenterY

  addSlabWithHole(
    s, outline,
    { cx: dx, cy: dy + ySign * layout.holeCy, r: layout.holeR },
    0, p.baseThickness, 0.05, p.chamfer,
  )
  const zBase = p.baseThickness - p.sinkEps
  const zTop = p.baseThickness + p.qrReliefH
  addGridRelief(
    s, actualQr.data, actualQr.size, actualQr.size,
    dx + layout.qrLeft, dy + qrCy - layout.qrSize / 2, layout.moduleMm,
    zBase, zTop,
  )
  buildPawRelief(
    s, dx, dy + ySign * layout.pawCy, p.pawSize,
    zBase, zTop, p.outlineStep,
  )
}

// ─── Preview 2D ──────────────────────────────────────────────────────────────

export interface PlateFootprint {
  outline: Vec2[]
  hole: { cx: number; cy: number; r: number }
  qrRects: Array<{ x: number; y: number; w: number; h: number }>
  paw: { cx: number; cy: number; R: number } | null
}

function toMm(rects: Rect[], gridH: number, ox: number, oy: number, cell: number) {
  return rects.map(r => ({
    x: ox + r.x * cell,
    y: oy + (gridH - r.y - r.h) * cell,
    w: r.w * cell,
    h: r.h * cell,
  }))
}

export function plateFootprint(
  p: Tag3DParams,
  layout: Tag3DLayout,
  qr: QrGrid,
): PlateFootprint {
  return {
    outline: dropOutline(0, 0, p.plateW, p.plateH, p.topR, p.outlineStep),
    hole: { cx: 0, cy: layout.holeCy, r: layout.holeR },
    qrRects: toMm(greedyRects(qr.data, qr.size, qr.size), qr.size, layout.qrLeft, layout.qrBottom, layout.moduleMm),
    paw: p.pawSize > 0 ? { cx: 0, cy: layout.pawCy, R: p.pawSize / 2 } : null,
  }
}

// ─── Posiciones en la grilla ────────────────────────────────────────────────

export function slotOffset(i: number, p: Tag3DParams): { dx: number; dy: number; flip: boolean } {
  const col = i % p.cols
  const row = Math.floor(i / p.cols)

  if (!p.interleave) {
    return {
      dx: (col - (p.cols - 1) / 2) * p.pitchX,
      dy: ((p.rows - 1) / 2 - row) * p.pitchY,
      flip: false,
    }
  }

  const isOdd = row % 2 === 1
  const xShift = isOdd ? p.pitchX / 2 : 0
  const centerShift = p.rows >= 2 ? -p.pitchX / 4 : 0

  return {
    dx: (col - (p.cols - 1) / 2) * p.pitchX + xShift + centerShift,
    dy: ((p.rows - 1) / 2 - row) * p.pitchY,
    flip: isOdd,
  }
}

// ─── Placas ──────────────────────────────────────────────────────────────────

export function chunkSheets(codes: string[], perSheet: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < codes.length; i += perSheet) out.push(codes.slice(i, i + perSheet))
  return out
}

export interface SheetResult {
  blob: Blob
  triangles: number
  bytes: number
  layouts: Tag3DLayout[]
}

export async function buildSheet(
  codes: string[],
  p: Tag3DParams,
): Promise<SheetResult> {
  const writer = new StlWriter(`huellitas tag3d | ${codes.length} chapas`)
  const layouts: Tag3DLayout[] = []

  for (let i = 0; i < codes.length; i++) {
    const qr = await createQrGrid(codeUrl(codes[i]), p.qrEcl)
    if (!checkQrOrientation(qr)) {
      throw new Error(`Orientación inesperada del QR de ${codes[i]}: se abortó para no imprimir chapas ilegibles.`)
    }
    const layout = computeLayout(p, qr.size)
    if (layout.issues.some(x => x.level === 'error')) {
      throw new Error(layout.issues.find(x => x.level === 'error')!.msg)
    }
    layouts.push(layout)
    const { dx, dy, flip } = slotOffset(i, p)
    buildPlate(writer, p, layout, qr, dx, dy, flip)
  }

  return {
    blob: writer.toBlob(),
    triangles: writer.count,
    bytes: writer.byteLength,
    layouts,
  }
}
