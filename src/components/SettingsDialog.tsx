import type { Credentials, InstanceState } from '../types'
import { ConnectForm } from './ConnectForm'
import { Modal } from './Modal'
import { instanceStateLabel } from '../lib/instanceState'

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
    <Modal title="Настройки подключения" onClose={onClose}>
      <dl className="settings-summary">
        <div>
          <dt>Инстанс</dt>
          <dd>{credentials.idInstance}</dd>
        </div>
        <div>
          <dt>Состояние</dt>
          <dd>{instanceStateLabel(instanceState)}</dd>
        </div>
      </dl>
      <ConnectForm initial={credentials} initialRemember={remember} submitLabel="Сохранить и переподключиться" onSubmit={onSave} />
      <hr className="divider" />
      <button type="button" className="button button-danger button-block" onClick={onDisconnect}>
        Отключиться и забыть данные
      </button>
    </Modal>
  )
}
