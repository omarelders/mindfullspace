import { RefreshCw, CloudOff, AlertCircle } from 'lucide-react'

export function SyncStatus({ status = 'idle', lastSyncedAt = null, onSyncNow = null, message = null }) {
  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...'
      case 'offline':
        return 'Offline — saved locally'
      case 'error':
        return 'Sync error — retrying'
      case 'conflict':
        return 'Sync conflict — resolved'
      case 'idle':
      default:
        return lastSyncedAt
          ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
          : 'Cloud sync active'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="auth-spinner" size={13} />
      case 'offline':
        return <CloudOff size={13} />
      case 'error':
      case 'conflict':
        return <AlertCircle size={13} style={{ color: 'var(--tone-red)' }} />
      case 'idle':
      default:
        return <div className="sync-status-dot idle" />
    }
  }

  return (
    <div className="sync-status-card">
      <div className="sync-status-header">
        <div className="sync-status-indicator">
          <span className={`sync-status-dot ${status}`} />
          <span>{getStatusText()}</span>
        </div>
        {onSyncNow && (
          <button
            type="button"
            className="sync-now-btn"
            onClick={onSyncNow}
            disabled={status === 'syncing'}
          >
            Sync Now
          </button>
        )}
      </div>
      {message && (
        <div style={{ fontSize: '11px', color: 'var(--ui-icon)', marginTop: '4px' }}>
          {message}
        </div>
      )}
      {lastSyncedAt && (
        <div style={{ fontSize: '11px', color: 'var(--ui-icon)' }}>
          Last synced {new Date(lastSyncedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
