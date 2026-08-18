import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { TagDoc, CodeDoc } from './types'

// Tags
export async function getTag(tagId: string) {
  const snap = await getDoc(doc(db, 'tags', tagId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as TagDoc & { id: string }
}

export async function getUserTags(ownerUid: string) {
  const q = query(
    collection(db, 'tags'),
    where('ownerUid', '==', ownerUid),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as TagDoc & { id: string })
}

export async function createTag(ownerUid: string, data: Omit<TagDoc, 'ownerUid' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(collection(db, 'tags'), {
    ...data,
    ownerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTag(tagId: string, data: Partial<TagDoc>) {
  await updateDoc(doc(db, 'tags', tagId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTag(tagId: string) {
  await deleteDoc(doc(db, 'tags', tagId))
}

// Codes
export async function getCode(code: string) {
  const snap = await getDoc(doc(db, 'codes', code))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as CodeDoc & { id: string }
}

export async function getAllCodes() {
  const snap = await getDocs(query(collection(db, 'codes'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CodeDoc & { id: string })
}

export async function generateCodes(count: number) {
  const batch = writeBatch(db)
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const id = `HU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    ids.push(id)
    batch.set(doc(db, 'codes', id), {
      status: 'sin_vender',
      createdAt: serverTimestamp(),
    } satisfies Omit<CodeDoc, 'status' | 'createdAt'> & { status: 'sin_vender'; createdAt: ReturnType<typeof serverTimestamp> })
  }
  await batch.commit()
  return ids
}

export async function markCodeSold(code: string, channel: 'checkout' | 'ml') {
  await updateDoc(doc(db, 'codes', code), {
    status: 'vendido_sin_reclamar',
    soldChannel: channel,
    soldAt: serverTimestamp(),
  })
}

export async function claimCode(code: string, tagId: string) {
  await updateDoc(doc(db, 'codes', code), {
    status: 'reclamado',
    tagId,
    claimedAt: serverTimestamp(),
  })
}

// Users
export async function getUserRole(uid: string): Promise<'user' | 'admin'> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return 'user'
  return (snap.data().role as 'user' | 'admin') ?? 'user'
}

export async function ensureUserDoc(uid: string, name: string, email: string) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { name, email, createdAt: serverTimestamp() })
  }
}
