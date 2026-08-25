import { ErrorBoundary as SolidErrorBoundary } from 'solid-js'

/**
 * Last-resort error boundary. If any card or board code throws during render,
 * the user gets a recoverable fallback instead of a blank page. Workspace
 * data lives in localStorage and is untouched, so "Reload" brings everything
 * back after a transient failure.
 */
export function ErrorBoundary(props) {
  return (
    <SolidErrorBoundary
      fallback={(error, reset) => {
        console.error('Unhandled UI error:', error)
        return (
          <div class="error-boundary" role="alert">
            <div class="error-boundary-card">
              <h1>Something went wrong</h1>
              <p>Your workspace data is saved locally and was not lost.</p>
              <pre class="error-boundary-message">
                {String(error?.message || error)}
              </pre>
              <div class="error-boundary-actions">
                <button type="button" onClick={reset}>Try again</button>
                <button type="button" class="error-boundary-reload" onClick={() => window.location.reload()}>Reload app</button>
              </div>
            </div>
          </div>
        )
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  )
}
