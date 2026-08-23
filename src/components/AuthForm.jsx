import { useState } from 'react'
import { LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function AuthForm({ onSuccess }) {
  const { signIn, signUp, signInWithOAuth, authError, clearError, isConfigured } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)
  const [localError, setLocalError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setNotice(null)
    clearError()

    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.')
      return
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await signUp(email.trim(), password, displayName.trim())
        if (error) {
          setLocalError(error.message)
        } else if (data?.session) {
          setNotice('Account created and signed in!')
          onSuccess?.()
        } else {
          setNotice('Check your email for a confirmation link.')
        }
      } else {
        const { data, error } = await signIn(email.trim(), password)
        if (error) {
          setLocalError(error.message)
        } else if (data?.session) {
          onSuccess?.()
        }
      }
    } catch (err) {
      setLocalError(err.message || 'Authentication request failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOAuth = async (provider) => {
    setLocalError(null)
    clearError()
    setIsSubmitting(true)
    try {
      const { error } = await signInWithOAuth(provider)
      if (error) {
        setLocalError(error.message)
        setIsSubmitting(false)
      }
    } catch (err) {
      setLocalError(err.message || `Failed to sign in with ${provider}.`)
      setIsSubmitting(false)
    }
  }

  const displayedError = localError || authError

  if (!isConfigured) {
    return (
      <div className="auth-unconfigured-box">
        <AlertCircle className="auth-alert-icon" />
        <div className="auth-unconfigured-text">
          <strong>Cloud Sync Optional</strong>
          <p>
            To enable cloud backup and cross-device sync, add your Supabase credentials to <code>.env.local</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-form-container">
      <div className="auth-header">
        <h4 className="auth-title">
          {mode === 'signin' ? 'Sign in to your space' : 'Create an account'}
        </h4>
        <p className="auth-subtitle">
          {mode === 'signin'
            ? 'Sync workspaces and images across all your devices'
            : 'Get started with free cross-device cloud synchronization'}
        </p>
      </div>

      <div className="auth-mode-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={`auth-mode-btn ${mode === 'signin' ? 'is-active' : ''}`}
          onClick={() => {
            setMode('signin')
            setLocalError(null)
            clearError()
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={`auth-mode-btn ${mode === 'signup' ? 'is-active' : ''}`}
          onClick={() => {
            setMode('signup')
            setLocalError(null)
            clearError()
          }}
        >
          Sign Up
        </button>
      </div>

      {displayedError && (
        <div className="auth-error-banner" role="alert">
          <AlertCircle size={14} />
          <span>{displayedError}</span>
        </div>
      )}

      {notice && (
        <div className="auth-notice-banner" role="status">
          <span>{notice}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="auth-field">
            <label htmlFor="auth-display-name">Display Name</label>
            <input
              id="auth-display-name"
              type="text"
              placeholder="e.g. Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isSubmitting}
              autoComplete="name"
            />
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="auth-spinner" />
          ) : mode === 'signin' ? (
            <>
              <LogIn size={15} />
              <span>Sign In</span>
            </>
          ) : (
            <>
              <UserPlus size={15} />
              <span>Create Account</span>
            </>
          )}
        </button>
      </form>

      <div className="auth-divider">
        <span>or continue with</span>
      </div>

      <div className="auth-oauth-row">
        <button
          type="button"
          className="auth-oauth-btn"
          onClick={() => handleOAuth('google')}
          disabled={isSubmitting}
          aria-label="Sign in with Google"
        >
          <svg className="auth-oauth-icon" viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Google</span>
        </button>

        <button
          type="button"
          className="auth-oauth-btn"
          onClick={() => handleOAuth('github')}
          disabled={isSubmitting}
          aria-label="Sign in with GitHub"
        >
          <svg className="auth-oauth-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>GitHub</span>
        </button>
      </div>
    </div>
  )
}
