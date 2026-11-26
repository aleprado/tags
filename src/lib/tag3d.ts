/**
 * Chapita QR tipo gota, hueso o pasador de collar para impresión 3D (Bambu Lab A1 mini).
 *
 * El mesh final NO es manifold (las cajas se hunden en la losa a propósito).
 * Los slicers libslic3r (Bambu Studio, Orca, PrusaSlicer) lo rebanan bien igual.
 */

import { StlWriter, type TriSink } from './stl'
import {
  dropOutline, boneOutline, boneBodyOutline, roundedRectOutline,
  addSlabWithHole, addCollarSlideSlab, addBorderRidge, addDashedRoundedRectFrame,
  addGridRelief, addEllipseRelief, addEllipseRingRelief, addDebossedText, greedyRects,
  type Vec2, type Rect,
} from './mesh'
import { createQrGrid, codeUrl, checkQrOrientation, type Ecl, type QrGrid } from './qr'

export type Tag3DShape = 'drop' | 'bone' | 'collar_slide' | 'tulle'
export type CollarPreset = 'small' | 'medium' | 'large'

export interface Tag3DParams {
  shape: Tag3DShape
  collarPreset?: CollarPreset
  plateW: number
  plateH: number
  topR: number
  boneLobeR?: number
  slotW?: number
  slotH?: number
  slotMargin?: number
  channelDepth?: number
  cornerR?: number
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
  debossBackText: boolean
  backText: string
  debossDepth: number
}

export const COLLAR_SLIDE_PRESETS: Record<CollarPreset, {
  name: string
  collarDesc: string
  plateW: number
  plateH: number
  slotW: number
  slotH: number
  slotMargin: number
  channelDepth: number
  cornerR: number
  pitchX: number
  pitchY: number
}> = {
  small: {
    name: '🐱 Pequeño (Gatos)',
    collarDesc: 'Collar de 10 mm (cinta fina 1.2–2 mm)',
    plateW: 24,
    plateH: 40,
    slotW: 12,
    slotH: 2.8,
    slotMargin: 2.8,
    channelDepth: 1.2,
    cornerR: 2.5,
    pitchX: 27,
    pitchY: 44,
  },
  medium: {
    name: '🐶 Mediano (Perros chicos / medianos)',
    collarDesc: 'Collar de 15 mm (cinta estándar 2–3 mm)',
    plateW: 32,
    plateH: 42,
    slotW: 17,
    slotH: 3.8,
    slotMargin: 3.0,
    channelDepth: 1.6,
    cornerR: 3.0,
    pitchX: 35,
    pitchY: 46,
  },
  large: {
    name: '🐕 Grande (Perros grandes)',
    collarDesc: 'Collar de 25 mm (cinta gruesa / reforzada 3.5–5 mm)',
    plateW: 38,
    plateH: 48,
    slotW: 27,
    slotH: 5.5,
    slotMargin: 3.2,
    channelDepth: 2.0,
    cornerR: 3.5,
    pitchX: 42,
    pitchY: 52,
  },
}

export const DEFAULT_TAG3D: Tag3DParams = {
  shape: 'drop',
  plateW: 40,
  plateH: 55,
  topR: 5,
  boneLobeR: 8,
  slotW: 12,
  slotH: 2.8,
  slotMargin: 2.8,
  channelDepth: 1.4,
  cornerR: 2.5,
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
  debossBackText: true,
  backText: 'huellis.art',
  debossDepth: 0.6,
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
  qrCenterY: number
  holeCx?: number
  holeCy: number
  holeR: number
  sideMarginMm: number
  pawCy: number
  qrBackSize?: number
  slotTopY?: number
  slotBotY?: number
  slotW?: number
  slotH?: number
  platesPerSheet: number
  sheetSpanX: number
  sheetSpanY: number
  issues: Tag3DIssue[]
}

export function computeLayout(p: Tag3DParams, qrModules: number): Tag3DLayout {
  const issues: Tag3DIssue[] = []

  // 0. Etiqueta para prenda sobre tul (solo se imprime logo + módulos del QR, la base es el tul)
  if (p.shape === 'tulle') {
    const qrSize = Math.max(14, (p.plateW * qrModules) / (qrModules + 2 * p.quietModules))
    const moduleMm = qrSize / qrModules
    const quietMm = p.quietModules * moduleMm
    const sideMarginMm = (p.plateW - qrSize) / 2

    const qrCenterY = -p.plateH / 2 + sideMarginMm + qrSize / 2
    const qrTop = qrCenterY + qrSize / 2
    const plateTop = p.plateH / 2

    // Distancia fija desde el margen superior hasta el borde superior del logo
    const pawTopOffset = 0.4704 * p.pawSize
    const pawCy = plateTop - p.holeMarginTop - pawTopOffset

    const [padDx, padDy] = pawPadCenter(p.pawSize)
    const holeCx = padDx
    const holeCy = pawCy + padDy
    const holeR = p.holeD / 2
    const pawBot = holeCy - 0.545 * (p.pawSize / 2)

    const xSpan = p.interleave && p.rows >= 2
      ? (p.cols - 1) * p.pitchX + p.pitchX / 2 + p.plateW
      : (p.cols - 1) * p.pitchX + p.plateW
    const ySpan = (p.rows - 1) * p.pitchY + p.plateH

    if (p.plateW < 20 || p.plateH < 36) {
      issues.push({ level: 'error', msg: 'Dimensiones de etiqueta demasiado chicas para logo + QR.' })
    }
    if (p.holeD <= 0) {
      issues.push({ level: 'error', msg: 'El diámetro del agujero debe ser mayor a 0.' })
    }
    if (p.holeMarginTop < 0) {
      issues.push({ level: 'error', msg: 'El margen superior del logo no puede ser negativo.' })
    }
    if (p.pitchX < p.plateW || p.pitchY < p.plateH) {
      issues.push({ level: 'error', msg: 'El paso de la grilla es chico: las etiquetas se superpondrían.' })
    }
    if (Math.max(xSpan, ySpan) > p.bedSize) {
      issues.push({ level: 'error', msg: `La placa (${xSpan.toFixed(0)}×${ySpan.toFixed(0)}mm) no entra en la cama de ${p.bedSize}mm.` })
    }

    const padMinorR = 0.545 * (p.pawSize / 2)
    if (p.pawSize <= 0) {
      issues.push({ level: 'error', msg: 'En modo Tul el logo de la pata debe ser mayor a 0mm.' })
    } else if (holeR >= padMinorR - 0.6) {
      issues.push({ level: 'warn', msg: 'El agujero es grande para la almohadilla de la pata: subí el tamaño del logo o achicá Ø agujero.' })
    }
    if (pawBot - qrTop < 2) {
      issues.push({ level: 'warn', msg: 'El logo y el QR quedan muy juntos o superpuestos: aumentá el alto o achicá el logo.' })
    }
    if (moduleMm < MIN_MODULE_MM) {
      issues.push({ level: 'warn', msg: `Módulo de ${moduleMm.toFixed(3)}mm (mínimo ${MIN_MODULE_MM}): aumentá el ancho de la etiqueta.` })
    }

    return {
      qrModules, qrSize, moduleMm, quietMm,
      qrLeft: -qrSize / 2,
      qrBottom: qrCenterY - qrSize / 2,
      qrCenterY,
      holeCx,
      holeCy,
      holeR,
      sideMarginMm,
      pawCy,
      platesPerSheet: p.cols * p.rows,
      sheetSpanX: xSpan,
      sheetSpanY: ySpan,
      issues,
    }
  }

  // 1. Silueta Pasador de Collar
  if (p.shape === 'collar_slide') {
    const sw = p.slotW ?? 12
    const sh = p.slotH ?? 2.8
    const sm = p.slotMargin ?? 2.8

    const topSlotCy = p.plateH / 2 - sm - sh / 2
    const botSlotCy = -(p.plateH / 2 - sm - sh / 2)

    // Espacio vertical entre los bordes interiores de las ranuras
    const availH = topSlotCy - sh / 2 - (botSlotCy + sh / 2) - 1.5
    const availW = p.plateW - 3
    const availSquare = Math.min(availW, availH)

    const qrSize = Math.max(14, (availSquare * qrModules) / (qrModules + 2 * p.quietModules))
    const moduleMm = qrSize / qrModules
    const quietMm = p.quietModules * moduleMm

    const xSpan = (p.cols - 1) * p.pitchX + p.plateW
    const ySpan = (p.rows - 1) * p.pitchY + p.plateH

    if (p.plateW < 18 || p.plateH < 28) {
      issues.push({ level: 'error', msg: 'Dimensiones del pasador demasiado chicas.' })
    }
    if (sw >= p.plateW - 3) {
      issues.push({ level: 'error', msg: 'La ranura es demasiado ancha para el ancho de la chapa.' })
    }
    if (p.sinkEps >= p.baseThickness) {
      issues.push({ level: 'error', msg: 'El relieve atraviesa la base: bajá el hundido o subí el espesor.' })
    }
    if (p.pitchX < p.plateW || p.pitchY < p.plateH * 0.9) {
      issues.push({ level: 'error', msg: 'El paso de la grilla es chico: las chapitas se superpondrían.' })
    }
    if (Math.max(xSpan, ySpan) > p.bedSize) {
      issues.push({ level: 'error', msg: `La placa (${xSpan.toFixed(0)}×${ySpan.toFixed(0)}mm) no entra en la cama de ${p.bedSize}mm.` })
    }
    if (moduleMm < MIN_MODULE_MM) {
      issues.push({ level: 'warn', msg: `Módulo de ${moduleMm.toFixed(3)}mm (mínimo ${MIN_MODULE_MM}): aumentá el ancho o alto del pasador.` })
    }

    return {
      qrModules, qrSize, moduleMm, quietMm,
      qrLeft: -qrSize / 2,
      qrBottom: -qrSize / 2,
      qrCenterY: 0,
      holeCy: 0, holeR: 0,
      sideMarginMm: (p.plateW - qrSize) / 2,
      pawCy: 0,
      slotTopY: topSlotCy,
      slotBotY: botSlotCy,
      slotW: sw,
      slotH: sh,
      platesPerSheet: p.cols * p.rows,
      sheetSpanX: xSpan,
      sheetSpanY: ySpan,
      issues,
    }
  }

  // 2. Silueta Hueso de Collar
  if (p.shape === 'bone') {
    const R = Math.max(4, Math.min(p.plateW / 4.5, Math.max(p.boneLobeR ?? 10.3, p.plateH / 3.85), p.plateH / 2.4))
    const dy = Math.max(1.5, p.plateH / 2 - R)
    const barHalfH = Math.min(p.plateH * 0.345, dy + R * 0.55)
    const availW = p.plateW - 2 * R + 4
    const availH = Math.max(10, 2 * barHalfH - 3.6)
    const availSquare = Math.min(availW, availH)

    const qrSize = Math.max(14, (availSquare * qrModules) / (qrModules + 2 * p.quietModules))
    const moduleMm = qrSize / qrModules
    const quietMm = p.quietModules * moduleMm

    const holeR = p.holeD / 2
    const holeCy = barHalfH + holeR + 0.6

    const xSpan = (p.cols - 1) * p.pitchX + p.plateW
    const ySpan = (p.rows - 1) * p.pitchY + Math.max(p.plateH, 2 * (holeCy + holeR + 2.0))

    if (p.plateW < 40 || p.plateH < 30) {
      issues.push({ level: 'error', msg: 'Dimensiones del hueso demasiado chicas para alojar el QR.' })
    }
    if (p.sinkEps >= p.baseThickness) {
      issues.push({ level: 'error', msg: 'El relieve atraviesa la base: bajá el hundido o subí el espesor.' })
    }
    if (p.pitchX < p.plateW || p.pitchY < p.plateH) {
      issues.push({ level: 'error', msg: `El paso de la grilla es chico: las chapitas se superpondrían.` })
    }
    if (Math.max(xSpan, ySpan) > p.bedSize) {
      issues.push({ level: 'error', msg: `La placa (${xSpan.toFixed(0)}×${ySpan.toFixed(0)}mm) no entra en la cama de ${p.bedSize}mm.` })
    }
    if (moduleMm < MIN_MODULE_MM) {
      issues.push({ level: 'warn', msg: `Módulo de ${moduleMm.toFixed(3)}mm (mínimo ${MIN_MODULE_MM}): agrandá el alto/ancho del hueso para mejor escaneo.` })
    }

    return {
      qrModules, qrSize, moduleMm, quietMm,
      qrLeft: -qrSize / 2,
      qrBottom: -qrSize / 2,
      qrCenterY: 0,
      holeCx: 0,
      holeCy,
      holeR,
      sideMarginMm: (p.plateW - qrSize) / 2,
      pawCy: 0,
      platesPerSheet: p.cols * p.rows,
      sheetSpanX: xSpan,
      sheetSpanY: ySpan,
      issues,
    }
  }

  // 3. Silueta Gota clásica
  const Rb = p.plateW / 2
  const by = -(p.plateH / 2 - Rb)
  const ty = p.plateH / 2 - p.topR

  const qrSize = (Rb * Math.SQRT2 * qrModules) / (qrModules + 2 * p.quietModules)
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

export function pawPadCenter(pawSize: number, mirrorX = false, flipY = false): [number, number] {
  if (pawSize <= 0) return [0, 0]
  const R = pawSize / 2
  const mx = mirrorX ? -1 : 1
  const my = flipY ? -1 : 1
  const ang = mx * -12 * Math.PI / 180
  const ca = Math.cos(ang), sa = Math.sin(ang)
  const dy = -0.455 * R
  return [mx * (-dy * sa), my * (dy * ca)]
}

export function buildPawRelief(
  s: TriSink,
  cx: number, cy: number,
  pawSize: number,
  zBase: number, z1: number,
  step: number,
  mirrorX = false,
  padHoleR = 0,
  flipY = false,
): void {
  if (pawSize <= 0) return
  const R = pawSize / 2

  const mx = mirrorX ? -1 : 1
  const my = flipY ? -1 : 1
  const ang = mx * -12 * Math.PI / 180
  const ca = Math.cos(ang), sa = Math.sin(ang)
  const rot = (dx: number, dy: number): [number, number] =>
    [mx * (dx * ca - dy * sa), my * (dx * sa + dy * ca)]

  const [padDx, padDy] = rot(0, -0.455 * R)
  if (padHoleR > 0) {
    addEllipseRingRelief(s, cx + padDx, cy + padDy, 0.636 * R, 0.545 * R, padHoleR, zBase, z1, step)
  } else {
    addEllipseRelief(s, cx + padDx, cy + padDy, 0.636 * R, 0.545 * R, zBase, z1, step)
  }

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
  const isBone = p.shape === 'bone'
  const isSlide = p.shape === 'collar_slide'
  const isTulle = p.shape === 'tulle'

  let outline: Vec2[]
  if (isSlide || isTulle) {
    outline = roundedRectOutline(dx, dy, p.plateW, p.plateH, p.cornerR ?? 2.5, p.outlineStep)
  } else if (isBone) {
    outline = boneOutline(dx, dy, p.plateW, p.plateH, p.boneLobeR ?? 8, p.outlineStep)
  } else {
    outline = dropOutline(dx, dy, p.plateW, p.plateH, p.topR, p.outlineStep)
  }

  if (flip) {
    for (const pt of outline) pt.y = 2 * dy - pt.y
    outline.reverse()
  }

  const ySign = flip ? -1 : 1
  const actualQr = flip ? rotateQr180(qr) : qr
  const qrCy = ySign * layout.qrCenterY
  const holeActualCx = dx + (isBone ? ySign * (layout.holeCx ?? 0) : (isTulle ? (layout.holeCx ?? 0) : 0))
  const holeActualCy = dy + ySign * layout.holeCy

  const debossD = p.debossBackText ? (p.debossDepth ?? 0.6) : 0
  const zSlabBot = 0

  // 1. Construir la losa sólida (en modo tul NO hay losa, la base es el tul)
  if (isSlide) {
    addCollarSlideSlab(
      s, dx, dy,
      p.plateW, p.plateH,
      p.cornerR ?? 2.5,
      p.slotW ?? 12,
      p.slotH ?? 2.8,
      p.slotMargin ?? 2.8,
      zSlabBot,
      p.baseThickness,
      p.outlineStep,
      p.channelDepth ?? 1.4,
    )
  } else if (!isTulle) {
    addSlabWithHole(
      s, outline,
      { cx: holeActualCx, cy: holeActualCy, r: layout.holeR },
      zSlabBot, p.baseThickness, 0.05, p.chamfer,
    )
  }

  // 2. Grabado trasero "huellis.art" (Bajo relieve en la cara inferior; no aplica en tul)
  if (!isTulle && debossD > 0 && p.backText) {
    const textTargetCy = dy + (isBone || isSlide ? 0 : qrCy)
    addDebossedText(
      s,
      p.backText,
      dx, textTargetCy,
      0,
      debossD,
      isSlide ? 2.8 : 3.2,
      0.35,
    )
  }

  // 3. QR en relieve (en tul nace desde z=0 para encapsular la tela)
  const zBase = isTulle ? zSlabBot : (p.baseThickness - p.sinkEps)
  const zTop = p.baseThickness + p.qrReliefH
  addGridRelief(
    s, actualQr.data, actualQr.size, actualQr.size,
    dx + layout.qrLeft, dy + qrCy - layout.qrSize / 2, layout.moduleMm,
    zBase, zTop,
  )

  // 4. Borde del hueso
  if (isBone) {
    const bodyOut = boneBodyOutline(dx, dy, p.plateW, p.plateH, p.boneLobeR ?? 8, p.outlineStep)
    if (flip) {
      for (const pt of bodyOut) pt.y = 2 * dy - pt.y
      bodyOut.reverse()
    }
    addBorderRidge(s, bodyOut, 1.6, zBase, zTop)
  }

  // 5. Logo de la pata (en tul nace desde z=0 para encapsular la tela) + marco discontinuo
  if (isTulle) {
    addDashedRoundedRectFrame(
      s, dx, dy, p.plateW, p.plateH, p.cornerR ?? 3,
      0.9, 4.5, 3.5, zSlabBot, zTop, p.outlineStep,
    )
    buildPawRelief(
      s, dx, dy + ySign * layout.pawCy, p.pawSize,
      zSlabBot, zTop, p.outlineStep, false, layout.holeR, flip,
    )
  } else if (!isBone && !isSlide) {
    buildPawRelief(
      s, dx, dy + ySign * layout.pawCy, p.pawSize,
      zBase, zTop, p.outlineStep, false, 0, flip,
    )
  }
}

// ─── Preview 2D ──────────────────────────────────────────────────────────────

export interface PlateFootprint {
  outline: Vec2[]
  bodyOutline?: Vec2[]
  qrBackOutline?: Vec2[]
  hole: { cx: number; cy: number; r: number } | null
  slots?: Array<{ cx: number; cy: number; w: number; h: number }>
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
  const isBone = p.shape === 'bone'
  const isSlide = p.shape === 'collar_slide'
  const isTulle = p.shape === 'tulle'

  let outline: Vec2[]
  if (isSlide || isTulle) {
    outline = roundedRectOutline(0, 0, p.plateW, p.plateH, p.cornerR ?? 2.5, p.outlineStep)
  } else if (isBone) {
    outline = boneOutline(0, 0, p.plateW, p.plateH, p.boneLobeR ?? 8, p.outlineStep, { holeD: p.holeD })
  } else {
    outline = dropOutline(0, 0, p.plateW, p.plateH, p.topR, p.outlineStep)
  }

  if (isSlide) {
    const sw = p.slotW ?? 12
    const sh = p.slotH ?? 2.8
    const sm = p.slotMargin ?? 2.8
    const slots = [
      { cx: 0, cy: layout.slotTopY ?? (p.plateH / 2 - sm - sh / 2), w: sw, h: sh },
      { cx: 0, cy: layout.slotBotY ?? -(p.plateH / 2 - sm - sh / 2), w: sw, h: sh },
    ]
    return {
      outline,
      hole: null,
      slots,
      qrRects: toMm(greedyRects(qr.data, qr.size, qr.size), qr.size, layout.qrLeft, layout.qrBottom, layout.moduleMm),
      paw: null,
    }
  }

  if (isBone) {
    const bodyOutline = boneBodyOutline(0, 0, p.plateW, p.plateH, p.boneLobeR ?? 8, p.outlineStep)
    return {
      outline,
      bodyOutline,
      hole: { cx: layout.holeCx ?? 0, cy: layout.holeCy, r: layout.holeR },
      qrRects: toMm(greedyRects(qr.data, qr.size, qr.size), qr.size, layout.qrLeft, layout.qrBottom, layout.moduleMm),
      paw: null,
    }
  }

  if (isTulle) {
    return {
      outline,
      hole: { cx: layout.holeCx ?? 0, cy: layout.holeCy, r: layout.holeR },
      qrRects: toMm(greedyRects(qr.data, qr.size, qr.size), qr.size, layout.qrLeft, layout.qrBottom, layout.moduleMm),
      paw: p.pawSize > 0 ? { cx: 0, cy: layout.pawCy, R: p.pawSize / 2 } : null,
    }
  }

  return {
    outline,
    hole: { cx: layout.holeCx ?? 0, cy: layout.holeCy, r: layout.holeR },
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
