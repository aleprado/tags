import { getToken, onMessage } from 'firebase/messaging'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore'
import { geohashForLocation } from 'geofire-common'
import { db, messaging } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  return Notification.requestPermission()
}

async function getFcmToken(): Promise<string> {
  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(messaging(), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg,
  })
  if (!token) throw new Error('No se pudo obtener el token de notificaciones')
  return token
}

export async function subscribeToAlerts(
  uid: string,
  location: { lat: number; lng: number },
): Promise<void> {
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones denegado')
  }

  const token = await getFcmToken()
  const hash = geohashForLocation([location.lat, location.lng])
  const ref = doc(db, 'subscribers', uid)

  await setDoc(ref, {
    uid,
    tokens: arrayUnion(token),
    location,
    geohash: hash,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function ensureDeviceToken(uid: string): Promise<boolean> {
  if (!isNotificationSupported()) return false
  if (Notification.permission !== 'granted') return false

  try {
    const token = await getFcmToken()
    const ref = doc(db, 'subscribers', uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) return false

    const tokens: string[] = snap.data().tokens ?? []
    if (tokens.includes(token)) return true

    await updateDoc(ref, { tokens: arrayUnion(token), updatedAt: serverTimestamp() })
    return true
  } catch {
    return false
  }
}

export async function unsubscribeFromAlerts(uid: string): Promise<void> {
  try {
    const token = await getFcmToken()
    const ref = doc(db, 'subscribers', uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) return

    const tokens: string[] = snap.data().tokens ?? []
    if (tokens.length <= 1) {
      await deleteDoc(ref)
    } else {
      await updateDoc(ref, { tokens: arrayRemove(token), updatedAt: serverTimestamp() })
    }
  } catch {
    await deleteDoc(doc(db, 'subscribers', uid))
  }
}

export async function isSubscribed(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'subscribers', uid))
  return snap.exists()
}

export function onForegroundMessage(callback: (payload: { title?: string; body?: string }) => void) {
  return onMessage(messaging(), (payload) => {
    const data = payload.notification ?? payload.data ?? {}
    callback({ title: data.title, body: data.body })
  })
}
