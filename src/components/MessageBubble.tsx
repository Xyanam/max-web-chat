import type { ChatMessage } from '../types'
import { formatTime } from '../lib/format'
import { AlertIcon, CheckIcon, ClockIcon, DoubleCheckIcon } from './Icons'

const UNSUPPORTED_LABELS: Record<string, string> = {
  imageMessage: 'Фото',
  videoMessage: 'Видео',
  audioMessage: 'Голосовое или аудиосообщение',
  documentMessage: 'Файл',
  stickerMessage: 'Стикер',
  locationMessage: 'Геопозиция',
  contactMessage: 'Контакт',
  pollMessage: 'Опрос',
}

function StatusIcon({ message }: { message: ChatMessage }) {
  switch (message.status) {
    case 'sending':
      return <ClockIcon className="msg-status" width={14} height={14} aria-label="Отправляется" role="img" />
    case 'sent':
      return <CheckIcon className="msg-status" width={14} height={14} aria-label="Отправлено" role="img" />
    case 'delivered':
      return <DoubleCheckIcon className="msg-status" width={16} height={14} aria-label="Доставлено" role="img" />
    case 'read':
      return <DoubleCheckIcon className="msg-status is-read" width={16} height={14} aria-label="Прочитано" role="img" />
    case 'failed':
      return <AlertIcon className="msg-status is-failed" width={14} height={14} aria-label="Не отправлено" role="img" />
    default:
      return null
  }
}

interface MessageBubbleProps {
  message: ChatMessage
  onRetry?: (message: ChatMessage) => void
  animate?: boolean
}

export function MessageBubble({ message, onRetry, animate }: MessageBubbleProps) {
  const outgoing = message.direction === 'outgoing'
  const failed = message.status === 'failed'

  return (
    <div className={`msg-row ${outgoing ? 'is-outgoing' : 'is-incoming'}${animate ? ' is-new' : ''}`}>
      <div className={`msg-bubble${failed ? ' is-failed' : ''}${message.kind === 'unsupported' ? ' is-unsupported' : ''}`}>
        {message.kind === 'unsupported' ? (
          <p className="msg-text msg-unsupported">
            {UNSUPPORTED_LABELS[message.messageType ?? ''] ?? 'Сообщение'} — не поддерживается в веб-чате
          </p>
        ) : (
          <p className="msg-text">{message.text}</p>
        )}
        <span className="msg-meta">
          <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
          {outgoing && <StatusIcon message={message} />}
        </span>
      </div>
      {failed && (
        <div className="msg-failed">
          <span>{message.error ?? 'Сообщение не отправлено.'}</span>
          {onRetry && message.kind === 'text' && (
            <button type="button" className="link-button" onClick={() => onRetry(message)}>
              Повторить
            </button>
          )}
        </div>
      )}
    </div>
  )
}
