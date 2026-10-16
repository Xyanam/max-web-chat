import { useState, type FormEvent } from 'react'
import { validatePhone, type PhoneCountry } from '../lib/phone'
import { Modal } from './Modal'
import { PhoneInput } from './PhoneInput'

interface NewChatDialogProps {
  onClose: () => void
  /** Receives the normalized phone digits. Rejects with a user-facing Error. */
  onCreate: (phoneDigits: string) => Promise<void>
}

export function NewChatDialog({ onClose, onCreate }: NewChatDialogProps) {
  const [country, setCountry] = useState<PhoneCountry>('RU')
  const [national, setNational] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const result = validatePhone(country, national)
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
          <PhoneInput
            id="new-chat-phone"
            country={country}
            national={national}
            onChange={(nextCountry, nextNational) => {
              setCountry(nextCountry)
              setNational(nextNational)
              if (error) setError(null)
            }}
            invalid={Boolean(error)}
            describedBy="new-chat-hint"
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
