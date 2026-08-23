import { Component } from 'react'

/**
 * Last-resort error boundary. If any card or board code throws during render,
 * the user gets a recoverable fallback instead of a blank page. Workspace
 * data lives in localStorage and is untouched, so "Reload" brings everything
 * back after a transient failure.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-card">
            <h1>Something went wrong</h1>
            <p>Your workspace data is saved locally and was not lost.</p>
            <pre className="error-boundary-message">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <div className="error-boundary-actions">
              <button type="button" onClick={this.handleReset}>Try again</button>
              <button type="button" className="error-boundary-reload" onClick={this.handleReload}>Reload app</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
