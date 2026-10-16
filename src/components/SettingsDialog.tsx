import type { Credentials, InstanceState } from '../types'
import { ConnectForm } from './ConnectForm'
import { Modal } from './Modal'

interface SettingsDialogProps {
  credentials: Credentials
  remember: boolean
  instanceState: InstanceState | null
  onClose: () => void
  onSave: (credentials: Credentials, remember: boolean) => Promise<void>
  onDisconnect: () => void
}

export function SettingsDialog({
  credentials,
  remember,
  instanceState,
  onClose,
  onSave,
  onDisconnect,
}: SettingsDialogProps) {
  return (
    <Modal title="Connection settings" onClose={onClose}>
      <dl className="settings-summary">
        <div>
          <dt>Instance</dt>
          <dd>{credentials.idInstance}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{instanceState ?? 'unknown'}</dd>
        </div>
      </dl>
      <ConnectForm initial={credentials} initialRemember={remember} submitLabel="Save and reconnect" onSubmit={onSave} />
      <hr className="divider" />
      <button type="button" className="button button-danger button-block" onClick={onDisconnect}>
        Disconnect and forget credentials
      </button>
    </Modal>
  )
}
