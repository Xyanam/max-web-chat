import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { SendIcon } from './Icons'

/** SendMessage limit for the message field. */
export const MAX_MESSAGE_LENGTH = 4000

interface ComposerProps {
  /** Resolves when the request is finished (successfully or not). */
  onSend: (text: string) => Promise<void>
  disabled?: boolean
  autoFocusKey?: string
}

export function Composer({ onSend, disabled, autoFocusKey }: ComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [autoFocusKey])

  // Auto-grow the textarea up to the CSS max-height.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    // Show a scrollbar only once the CSS max-height is reached.
    el.style.overflowY = el.scrollHeight > el.clientHeight ? 'auto' : 'hidden'
  }, [text])

  const trimmed = text.trim()
  const tooLong = text.length > MAX_MESSAGE_LENGTH
  const canSend = !disabled && !sending && trimmed.length > 0 && !tooLong

  const submit = async () => {
    // The ref guards against double submits that happen before React re-renders.
    if (!canSend || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setText('')
    try {
      await onSend(trimmed)
    } finally {
      sendingRef.current = false
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-field">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          placeholder="Message"
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        {text.length > MAX_MESSAGE_LENGTH - 200 && (
          <span className={`composer-counter${tooLong ? ' is-over' : ''}`} aria-live="polite">
            {text.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>
      <button type="submit" className="send-button" disabled={!canSend} aria-label={sending ? 'Sending' : 'Send'}>
        {sending ? <span className="spinner spinner-light" aria-hidden="true" /> : <SendIcon width={20} height={20} />}
      </button>
    </form>
  )
}
