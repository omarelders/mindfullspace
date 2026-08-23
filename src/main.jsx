import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Set only when we deliberately activate a waiting update — never on a
    // first visit, where 'controllerchange' also fires as the SW claims the
    // page and reloading then would be pointless.
    let pendingUpdate = false
    let refreshing = false

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // When a new service worker is waiting (a new deploy), activate it
      // immediately and reload so users are never stuck on a stale shell.
      if (registration.waiting) {
        pendingUpdate = true
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            pendingUpdate = true
            installing.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }).catch((error) => {
      console.error('Service worker registration failed:', error)
    })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!pendingUpdate || refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
