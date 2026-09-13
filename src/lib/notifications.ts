import { getToken, onMessage } from 'firebase/messaging'
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
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

export async function subscribeToAlerts(
  uid: string,
  location: { lat: number; lng: number },
): Promise<void> {
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones denegado')
  }

  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(messaging(), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg,
  })

  if (!token) throw new Error('No se pudo obtener el token de notificaciones')

  const hash = geohashForLocation([location.lat, location.lng])

  await setDoc(doc(db, 'subscribers', uid), {
    uid,
    fcmToken: token,
    location,
    geohash: hash,
    createdAt: serverTimestamp(),
  })
}

export async function unsubscribeFromAlerts(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'subscribers', uid))
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
