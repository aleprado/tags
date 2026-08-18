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
      (QRCode.toBuffer as (text: string, opts: object) => Promise<Buffer>)(`${appUrl}/p/${code}`, {
        type: 'png', width: 512, margin: 2,
        color: { dark: '#201e1d', light: '#f5ead8' },
      }).then(buf => {
        const file = bucket.file(`qr/${code}.png`)
        return file.save(buf, { contentType: 'image/png', public: true })
          .then(() => file.publicUrl())
      })
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
