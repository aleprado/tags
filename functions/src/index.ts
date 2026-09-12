import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
// CORS allowed origins (browser calls only; server-to-server webhooks have no Origin).
const ALLOWED_ORIGINS = [
  'https://tags-8bcd8.web.app',
  'https://tags-8bcd8.firebaseapp.com',
]

initializeApp()

// ─── Helpers ────────────────────────────────────────────────────────────────

function newCodeId(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `HU-${ts}-${rand}`
}

async function assertAdmin(uid: string) {
  const db = getFirestore()
  const snap = await db.collection('users').doc(uid).get()
  if (snap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo admins pueden realizar esta acción')
  }
}

// ─── QR SVG builder (rounded dots + paw overlay) ────────────────────────────

function buildQRSvg(QRCode: typeof import('qrcode'), url: string): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const sz = qr.modules.size
  const margin = 2
  const total = sz + margin * 2
  const bg = '#f5ead8'
  const fg = '#201e1d'
  const f = (n: number) => n.toFixed(3)

  let dots = ''
  for (let row = 0; row < sz; row++) {
    for (let col = 0; col < sz; col++) {
      if (!qr.modules.get(row, col)) continue
      dots += `<rect x="${f(col + margin + 0.07)}" y="${f(row + margin + 0.07)}" width=".86" height=".86" rx=".35" ry=".35" fill="${fg}"/>`
    }
  }

  const c = total / 2
  const paw = [
    `<circle cx="${f(c)}" cy="${f(c)}" r="${f(total * 0.135)}" fill="${bg}"/>`,
    `<ellipse cx="${f(c)}" cy="${f(c + total * 0.025)}" rx="${f(total * 0.078)}" ry="${f(total * 0.058)}" fill="${fg}"/>`,
    `<circle cx="${f(c - total * 0.085)}" cy="${f(c - total * 0.037)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
    `<circle cx="${f(c - total * 0.027)}" cy="${f(c - total * 0.060)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
    `<circle cx="${f(c + total * 0.027)}" cy="${f(c - total * 0.060)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
    `<circle cx="${f(c + total * 0.085)}" cy="${f(c - total * 0.037)}" r="${f(total * 0.030)}" fill="${fg}"/>`,
  ].join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}">` +
    `<rect width="${total}" height="${total}" fill="${bg}" rx="1.5" ry="1.5"/>` +
    dots + paw + `</svg>`
}

// ─── generateQRBatch ────────────────────────────────────────────────────────

export const generateQRBatch = onCall({ maxInstances: 1, cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado')
  await assertAdmin(request.auth.uid)

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const QRCode = require('qrcode') as typeof import('qrcode')
  const db = getFirestore()
  const bucket = getStorage().bucket()
  const appUrl = process.env.APP_URL ?? 'https://tags-8bcd8.web.app'
  const count = Math.min(Math.max(1, (request.data as { count?: number }).count ?? 10), 500)

  const codes: string[] = []
  const batch = db.batch()
  const uploads: Promise<string>[] = []

  for (let i = 0; i < count; i++) {
    const code = newCodeId()
    codes.push(code)

    batch.set(db.collection('codes').doc(code), {
      status: 'sin_vender',
      createdAt: FieldValue.serverTimestamp(),
    })

    uploads.push(
      (async () => {
        const svgStr = buildQRSvg(QRCode, `${appUrl}/p/${code}`)
        const file = bucket.file(`qr/${code}.svg`)
        await file.save(Buffer.from(svgStr, 'utf8'), { contentType: 'image/svg+xml', public: true })
        return file.publicUrl()
      })()
    )
  }

  const results = await Promise.all([batch.commit(), ...uploads])
  const downloadUrls = results.slice(1) as string[]

  return { codes, downloadUrls }
})

// ─── createMPPreference ─────────────────────────────────────────────────────

export const createMPPreference = onCall(
  { maxInstances: 10, cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado')

    const { codeId, unitPrice = 3500 } = request.data as { codeId: string; unitPrice?: number }
    if (!codeId) throw new HttpsError('invalid-argument', 'codeId es requerido')

    const token = process.env.MP_ACCESS_TOKEN
    if (!token) throw new HttpsError('failed-precondition', 'MP_ACCESS_TOKEN no configurado')

    const appUrl = process.env.APP_URL ?? 'https://tags-8bcd8.web.app'

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: [{ id: codeId, title: 'Tag Huellitas', quantity: 1, currency_id: 'ARS', unit_price: unitPrice }],
        external_reference: codeId,
        back_urls: {
          success: `${appUrl}/activar?code=${codeId}&status=approved`,
          failure: `${appUrl}/login?error=payment_failed`,
          pending: `${appUrl}/login?status=pending`,
        },
        auto_return: 'approved',
        notification_url: 'https://us-central1-tags-8bcd8.cloudfunctions.net/mpWebhook',
        statement_descriptor: 'Huellitas',
      }),
    })

    if (!res.ok) throw new HttpsError('internal', 'Error al crear preferencia de pago')

    const pref = await res.json() as { id: string; init_point: string }
    return { initPoint: pref.init_point, preferenceId: pref.id }
  }
)

// ─── mpWebhook ──────────────────────────────────────────────────────────────

export const mpWebhook = onRequest({}, (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const corsLib = require('cors') as typeof import('cors')
  const corsHandler = corsLib({
    origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origen no permitido: ${origin}`))
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') { res.status(204).send(''); return }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }

    const { type, data } = req.body as { type: string; data?: { id?: string } }
    if (type !== 'payment' || !data?.id) { res.status(200).send('ok'); return }

    const token = process.env.MP_ACCESS_TOKEN
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!paymentRes.ok) { res.status(200).send('ok'); return }

    const payment = await paymentRes.json() as { status: string; external_reference?: string }
    if (payment.status === 'approved' && payment.external_reference) {
      await getFirestore().collection('codes').doc(payment.external_reference).update({
        status: 'vendido_sin_reclamar',
        soldChannel: 'checkout',
        soldAt: FieldValue.serverTimestamp(),
      })
    }

    res.status(200).send('ok')
  })
})

// ─── deleteTag ──────────────────────────────────────────────────────────────

export const deleteTag = onCall({ maxInstances: 10, cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado')

  const { tagId } = request.data as { tagId: string }
  if (!tagId) throw new HttpsError('invalid-argument', 'tagId es requerido')

  const db = getFirestore()
  const tagRef = db.collection('tags').doc(tagId)
  const tagSnap = await tagRef.get()

  if (!tagSnap.exists) throw new HttpsError('not-found', 'Tag no encontrado')
  if (tagSnap.data()?.ownerUid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'No tenés permiso para eliminar este tag')
  }

  const code: string | undefined = tagSnap.data()?.code
  const batch = db.batch()
  batch.delete(tagRef)

  if (code) {
    batch.update(db.collection('codes').doc(code), {
      status: 'sin_vender',
      tagId: FieldValue.delete(),
      claimedAt: FieldValue.delete(),
    })
  }

  await batch.commit()
  return { success: true }
})

// ─── claimCode ──────────────────────────────────────────────────────────────

export const claimCode = onCall({ maxInstances: 10, cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'No autenticado')

  const { code, tagData } = request.data as { code: string; tagData: Record<string, unknown> }
  if (!code) throw new HttpsError('invalid-argument', 'code es requerido')

  const db = getFirestore()
  const codeRef = db.collection('codes').doc(code)
  const codeSnap = await codeRef.get()

  if (!codeSnap.exists) throw new HttpsError('not-found', 'Código no encontrado')
  if (codeSnap.data()?.status === 'reclamado') {
    throw new HttpsError('already-exists', 'Este código ya fue activado')
  }

  const tagRef = await db.collection('tags').add({
    ...tagData, code,
    ownerUid: request.auth.uid,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await codeRef.update({
    status: 'reclamado',
    tagId: tagRef.id,
    claimedAt: FieldValue.serverTimestamp(),
  })

  return { tagId: tagRef.id }
})
