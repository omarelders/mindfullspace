import { createSignal, createEffect, onCleanup, Show } from 'solid-js'
import { Download, X } from 'lucide-solid'
import { createPWAInstall } from '../hooks/usePWAInstall'

export function InstallPrompt() {
  const { isAvailable, handleInstall } = createPWAInstall()
  const [isVisible, setIsVisible] = createSignal(false)
  const [isDismissed, setIsDismissed] = createSignal(
    (() => {
      try {
        return localStorage.getItem('pwa_prompt_dismissed') === 'true'
      } catch {
        // Storage can throw in private-browsing modes — treat as not dismissed.
        return false
      }
    })()
  )

  createEffect(() => {
    if (isAvailable && !isDismissed()) {
      // Show prompt after a short delay
      const timer = setTimeout(() => setIsVisible(true), 2000)
      onCleanup(() => clearTimeout(timer))
    }
  })

  function handleDismiss() {
    setIsVisible(false)
    setIsDismissed(true)
    try {
      localStorage.setItem('pwa_prompt_dismissed', 'true')
    } catch {
      // Non-fatal: the prompt may reappear next session.
    }
  }

  function onInstallClick() {
    handleInstall()
    setIsVisible(false)
  }

  return (
    <Show when={isVisible()}>
      <div class="install-prompt-container">
        <div class="install-prompt-card">
          <div class="install-prompt-content">
            <div class="install-prompt-icon">
              <Download size={20} />
            </div>
            <div class="install-prompt-text">
              <h3>Install Mindful Space</h3>
              <p>Get the full experience with our desktop app.</p>
            </div>
          </div>
          <div class="install-prompt-actions">
            <button type="button" class="install-button" onClick={onInstallClick}>
              Install
            </button>
            <button type="button" class="dismiss-button" onClick={handleDismiss} title="Dismiss">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
