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
      setError(err instanceof Error ? err.message : 'Could not start the chat.')
      setBusy(false)
    }
  }

  return (
    <Modal title="New chat" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="new-chat-phone">Recipient's phone number</label>
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
              Russian (+7) or Belarusian (+375) number registered in MAX.
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> Checking…
              </>
            ) : (
              'Start chat'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
