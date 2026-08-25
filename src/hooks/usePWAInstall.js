import { createSignal, onMount, onCleanup } from 'solid-js'

export function createPWAInstall() {
  const [isAvailable, setIsAvailable] = createSignal(false)
  let deferredPrompt = null

  onMount(() => {
    const handleBeforeInstall = (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later.
      deferredPrompt = e
      setIsAvailable(true)
    }

    const handleInstalled = () => {
      deferredPrompt = null
      setIsAvailable(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)

    onCleanup(() => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    })
  })

  async function handleInstall() {
    if (!deferredPrompt) return

    // Show the prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    await deferredPrompt.userChoice

    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null
    setIsAvailable(false)
  }

  return { get isAvailable() { return isAvailable() }, handleInstall }
}
