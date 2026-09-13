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
  const data = payload.notification ?? payload.data ?? {}
  self.registration.showNotification(data.title ?? 'Huellitas', {
    body: data.body ?? '',
    icon: data.icon ?? '/paw.svg',
    data: { url: data.click_action ?? '/' },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(clients.openWindow(url))
})
