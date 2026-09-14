import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
// CORS allowed origins (browser calls only; server-to-server webhooks have no Origin).
const ALLOWED_ORIGINS = [
  'https://huellis.art',
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
  const appUrl = process.env.APP_URL ?? 'https://huellis.art'
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

    const appUrl = process.env.APP_URL ?? 'https://huellis.art'

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

// ─── onPetLost ─────────────────────────────────────────────────────────────

export const onPetLost = onDocumentUpdated(
  { document: 'tags/{tagId}', maxInstances: 5 },
  async (event) => {
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()
    if (!before || !after) return

    // Only trigger when lost transitions from falsy to true
    if (before.lost || !after.lost) return

    const location = after.homeLocation as { lat: number; lng: number } | undefined
    if (!location) {
      console.warn(`[onPetLost] Tag ${event.params.tagId} has no homeLocation, skipping`)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geofire = require('geofire-common') as typeof import('geofire-common')
    const { getMessaging } = require('firebase-admin/messaging') as typeof import('firebase-admin/messaging')

    const center: [number, number] = [location.lat, location.lng]
    const radiusM = 1000
    const bounds = geofire.geohashQueryBounds(center, radiusM)
    const db = getFirestore()

    const tokenOwnerMap: { token: string; subId: string }[] = []
    const staleEntries: string[] = []

    console.log(`[onPetLost] Tag ${event.params.tagId} lost=true, center=[${center}], bounds=${bounds.length} ranges`)

    for (const [start, end] of bounds) {
      const snap = await db.collection('subscribers')
        .orderBy('geohash')
        .startAt(start)
        .endAt(end)
        .get()

      console.log(`[onPetLost] Geohash range [${start}, ${end}]: ${snap.docs.length} subscribers`)

      for (const doc of snap.docs) {
        const data = doc.data()
        const loc = data.location as { lat: number; lng: number }
        const dist = geofire.distanceBetween([loc.lat, loc.lng], center)
        const distM = dist * 1000
        const isOwner = doc.id === after.ownerUid
        const tokens: string[] = data.tokens ?? (data.fcmToken ? [data.fcmToken] : [])
        console.log(`[onPetLost]   sub=${doc.id} dist=${distM.toFixed(0)}m owner=${isOwner} tokens=${tokens.length}`)
        if (isOwner) continue
        if (distM <= radiusM) {
          for (const t of tokens) {
            tokenOwnerMap.push({ token: t, subId: doc.id })
          }
        }
      }
    }

    if (tokenOwnerMap.length === 0) {
      console.log('[onPetLost] No matching tokens within radius, skipping send')
      return
    }

    const matchingTokens = tokenOwnerMap.map(t => t.token)

    const petName = (after.petName as string) ?? 'una mascota'
    const species = (after.species as string) ?? ''
    const breed = (after.breed as string) ?? ''
    const detail = breed || (species === 'perro' ? 'Perro' : species === 'gato' ? 'Gato' : '')
    const appUrl = process.env.APP_URL ?? 'https://tags-8bcd8.web.app'

    const batches: string[][] = []
    for (let i = 0; i < matchingTokens.length; i += 500) {
      batches.push(matchingTokens.slice(i, i + 500))
    }

    for (const tokenBatch of batches) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: tokenBatch,
        notification: {
          title: `Se perdio ${petName}${detail ? ` (${detail})` : ''}`,
          body: 'cerca de tu zona - Toca para ver info',
          imageUrl: (after.photoUrl as string) || undefined,
        },
        webpush: {
          fcmOptions: {
            link: `${appUrl}/p/${after.code ?? event.params.tagId}`,
          },
        },
      })

      const successes = result.responses.filter(r => r.success).length
      const failures = result.responses.filter(r => !r.success)
      console.log(`[onPetLost] Batch: ${successes} ok, ${failures.length} failed`)
      failures.forEach((resp, i) => {
        console.warn(`[onPetLost] FCM error: ${resp.error?.code} — ${resp.error?.message}`)
      })

      result.responses.forEach((resp, idx) => {
        if (resp.error?.code === 'messaging/registration-token-not-registered' ||
            resp.error?.code === 'messaging/invalid-registration-token') {
          staleEntries.push(tokenBatch[idx])
        }
      })
    }

    if (staleEntries.length > 0) {
      const { FieldValue: FV } = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore')
      const byOwner = new Map<string, string[]>()
      for (const token of staleEntries) {
        const entry = tokenOwnerMap.find(t => t.token === token)
        if (!entry) continue
        const list = byOwner.get(entry.subId) ?? []
        list.push(token)
        byOwner.set(entry.subId, list)
      }
      for (const [subId, tokens] of byOwner) {
        await db.collection('subscribers').doc(subId).update({
          tokens: FV.arrayRemove(...tokens),
        })
      }
      console.log(`[onPetLost] Removed ${staleEntries.length} stale tokens from ${byOwner.size} subscribers`)
    }

    console.log(`[onPetLost] Sent ${matchingTokens.length} notifications for tag ${event.params.tagId}`)
  }
)
