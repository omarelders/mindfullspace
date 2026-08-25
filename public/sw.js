// Bump whenever precached app shell assets change in a way that matters
// offline (runtime assets are content-hashed and cached on the fly).
const CACHE_VERSION = 'v3'
const STATIC_CACHE = `mindful-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `mindful-runtime-${CACHE_VERSION}`
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key === STATIC_CACHE || key === RUNTIME_CACHE ? null : caches.delete(key)))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

async function navigationCacheFirst(request) {
  const staticMatch = await caches.match(request)
  if (staticMatch) {
    // Serve cached HTML instantly, revalidate in background
    fetch(request)
      .then(async (networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const runtimeCache = await caches.open(RUNTIME_CACHE)
          runtimeCache.put(request, networkResponse)
        }
      })
      .catch(() => {})
    return staticMatch
  }

  // Also check runtime cache
  const runtimeCache = await caches.open(RUNTIME_CACHE)
  const runtimeMatch = await runtimeCache.match(request)
  if (runtimeMatch) {
    fetch(request)
      .then(async (networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          runtimeCache.put(request, networkResponse)
        }
      })
      .catch(() => {})
    return runtimeMatch
  }

  // No cache — must go to network
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.ok) {
      runtimeCache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    return (await caches.match('/offline.html')) || new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE)
  const cachedResponse = await runtimeCache.match(request)

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
        runtimeCache.put(request, networkResponse.clone())
      }
      return networkResponse
    })
    .catch(() => null)

  if (cachedResponse) {
    return cachedResponse
  }

  const networkResponse = await networkFetch
  if (networkResponse) {
    return networkResponse
  }

  return caches.match('/offline.html')
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationCacheFirst(event.request))
    return
  }

  event.respondWith(staleWhileRevalidate(event.request))
})
