import { Show, mergeProps, Switch, Match } from 'solid-js'
import { RefreshCw, CloudOff, AlertCircle } from 'lucide-solid'

export function SyncStatus(props) {
  const merged = mergeProps({ status: 'idle' }, props)

  return (
    <div class="sync-status-card">
      <div class="sync-status-header">
        <div class="sync-status-indicator">
          <span class={`sync-status-dot ${merged.status}`} />
          <span>
            <Switch fallback={merged.lastSyncedAt ? `Synced ${new Date(merged.lastSyncedAt).toLocaleTimeString()}` : 'Cloud sync active'}>
              <Match when={merged.status === 'syncing'}>Syncing...</Match>
              <Match when={merged.status === 'offline'}>Offline — saved locally</Match>
              <Match when={merged.status === 'error'}>Sync error — retrying</Match>
              <Match when={merged.status === 'conflict'}>Sync conflict — resolved</Match>
            </Switch>
          </span>
        </div>
        <Show when={merged.onSyncNow}>
          <button
            type="button"
            class="sync-now-btn"
            onClick={() => merged.onSyncNow?.()}
            disabled={merged.status === 'syncing'}
          >
            Sync Now
          </button>
        </Show>
      </div>
      <Show when={merged.message}>
        <div style={{ "font-size": '11px', color: 'var(--ui-icon)', "margin-top": '4px' }}>
          {merged.message}
        </div>
      </Show>
      <Show when={merged.lastSyncedAt}>
        <div style={{ "font-size": '11px', color: 'var(--ui-icon)' }}>
          Last synced {new Date(merged.lastSyncedAt).toLocaleTimeString()}
        </div>
      </Show>
    </div>
  )
}
