importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyADRznJ0muW6yx7YpIOfLjLWo5b2ORfMuc',
  authDomain: 'tags-8bcd8.firebaseapp.com',
  projectId: 'tags-8bcd8',
  storageBucket: 'tags-8bcd8.firebasestorage.app',
  messagingSenderId: '981207556491',
  appId: '1:981207556491:web:5c34bc563a681f50398f8e',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification ?? {}
  const d = payload.data ?? {}
  const title = n.title || d.title || 'Huellitas'
  const body = n.body || d.body || ''
  const icon = n.icon || d.icon || '/paw.svg'
  const image = n.image || d.image || undefined
  const link = payload.fcmOptions?.link || d.link || '/'

  return self.registration.showNotification(title, {
    body,
    icon,
    image,
    data: { url: link },
    badge: '/paw.svg',
    requireInteraction: true,
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
