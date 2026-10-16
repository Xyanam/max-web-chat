import { useState } from 'react'
import type { RequiredNotification } from '../lib/notificationSettings'
import { Modal } from './Modal'

interface NotificationSettingsBannerProps {
  missing: RequiredNotification[]
  /** Rejects with a user-facing Error. */
  onEnable: () => Promise<void>
}

export function NotificationSettingsBanner({ missing, onEnable }: NotificationSettingsBannerProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEnable = async () => {
    setBusy(true)
    setError(null)
    try {
      await onEnable()
      setConfirming(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="banner" role="status">
        <span className="banner-text">
          В настройках инстанса выключены уведомления: {missing.map((n) => n.label).join(', ')}. Эти события не
          появятся в веб-чате.
        </span>
        <button type="button" className="button button-small" onClick={() => setConfirming(true)}>
          Включить
        </button>
      </div>

      {confirming && (
        <Modal title="Включить уведомления" onClose={() => !busy && setConfirming(false)}>
          <p className="modal-text">
            Будут включены уведомления: {missing.map((n) => n.label).join(', ')}. Инстанс перезапустится, настройки
            применятся в течение 5 минут. Сообщения, отправленные до этого, в веб-чат не попадут.
          </p>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="button" onClick={() => setConfirming(false)} disabled={busy}>
              Отмена
            </button>
            <button type="button" className="button button-primary" onClick={handleEnable} disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Сохранение…
                </>
              ) : (
                'Включить'
              )}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
