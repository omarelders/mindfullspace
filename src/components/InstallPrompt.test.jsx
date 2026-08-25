import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { InstallPrompt } from './InstallPrompt'
import { createPWAInstall } from '../hooks/usePWAInstall'

vi.mock('../hooks/usePWAInstall', () => ({
  createPWAInstall: vi.fn()
}))

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders prompt if available and not dismissed', () => {
    vi.mocked(createPWAInstall).mockReturnValue({
      isAvailable: true,
      handleInstall: vi.fn()
    })

    render(() => <InstallPrompt />)

    // The prompt is shown after a 2-second timeout
    expect(screen.queryByText('Install Mindful Space')).not.toBeInTheDocument()

    vi.advanceTimersByTime(2000)

    expect(screen.getByText('Install Mindful Space')).toBeInTheDocument()
  })

  it('does not render if dismissed previously', () => {
    vi.mocked(createPWAInstall).mockReturnValue({
      isAvailable: true,
      handleInstall: vi.fn()
    })
    
    localStorage.setItem('pwa_prompt_dismissed', 'true')

    render(() => <InstallPrompt />)
    
    vi.advanceTimersByTime(2000)
    expect(screen.queryByText('Install Mindful Space')).not.toBeInTheDocument()
  })

  it('dismisses when close button is clicked', () => {
    vi.mocked(createPWAInstall).mockReturnValue({
      isAvailable: true,
      handleInstall: vi.fn()
    })

    render(() => <InstallPrompt />)
    vi.advanceTimersByTime(2000)

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' })
    fireEvent.click(dismissBtn)

    expect(screen.queryByText('Install Mindful Space')).not.toBeInTheDocument()
    expect(localStorage.getItem('pwa_prompt_dismissed')).toBe('true')
  })
})
