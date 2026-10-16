import { useState, type FormEvent } from 'react'
import { normalizePhone } from '../lib/phone'
import { Modal } from './Modal'

interface NewChatDialogProps {
  onClose: () => void
  /** Receives the normalized phone digits. Rejects with a user-facing Error. */
  onCreate: (phoneDigits: string) => Promise<void>
}

export function NewChatDialog({ onClose, onCreate }: NewChatDialogProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const result = normalizePhone(phone)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onCreate(result.digits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось начать чат.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Новый чат" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="new-chat-phone">Номер телефона получателя</label>
          <input
            id="new-chat-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 999 123-45-67"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (error) setError(null)
            }}
            aria-invalid={Boolean(error)}
            aria-describedby="new-chat-hint"
            disabled={busy}
          />
          {error ? (
            <p className="field-error" id="new-chat-hint" role="alert">
              {error}
            </p>
          ) : (
            <p className="field-hint" id="new-chat-hint">
              Российский (+7) или белорусский (+375) номер, зарегистрированный в MAX.
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> Проверка…
              </>
            ) : (
              'Начать чат'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
