import { Fragment, useLayoutEffect, useRef } from 'react'
import type { Chat, ChatMessage } from '../types'
import { formatDaySeparator, isSameDay } from '../lib/format'
import { formatPhone } from '../lib/phone'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import { BackIcon } from './Icons'
import { MessageBubble } from './MessageBubble'

interface ChatViewProps {
  chat: Chat
  messages: ChatMessage[]
  onBack: () => void
  onSend: (text: string) => Promise<void>
  onRetry: (message: ChatMessage) => void
}

const NEAR_BOTTOM_PX = 120

export function ChatView({ chat, messages, onBack, onSend, onRetry }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const prevChatRef = useRef<string | null>(null)
  const prevCountRef = useRef(0)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const chatChanged = prevChatRef.current !== chat.chatId
    const added = messages.length > prevCountRef.current
    const last = messages[messages.length - 1]
    // Jump to the newest message when the chat opens, when we send, or when the
    // user is already reading the bottom. Otherwise keep their scroll position.
    if (chatChanged || (added && (nearBottomRef.current || last?.direction === 'outgoing'))) {
      el.scrollTop = el.scrollHeight
      nearBottomRef.current = true
    }
    prevChatRef.current = chat.chatId
    prevCountRef.current = messages.length
  }, [chat.chatId, messages])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  const subtitle = chat.phone ? formatPhone(chat.phone) : `MAX ID ${chat.chatId}`

  return (
    <section className="chat-view" aria-label={`Chat with ${chat.title}`}>
      <header className="chat-header">
        <button type="button" className="icon-button chat-back" onClick={onBack} aria-label="Back to chats">
          <BackIcon width={22} height={22} />
        </button>
        <Avatar title={chat.title} seed={chat.chatId} size={40} />
        <div className="chat-header-text">
          <h2>{chat.title}</h2>
          <p>{chat.title === subtitle ? 'MAX' : subtitle}</p>
        </div>
      </header>

      <div className="messages" ref={scrollRef} onScroll={handleScroll} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="messages-empty">
            <p>No messages yet.</p>
            <p className="muted">Write the first message below.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const newDay = !prev || !isSameDay(prev.timestamp, m.timestamp)
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="day-separator">
                    <span>{formatDaySeparator(m.timestamp)}</span>
                  </div>
                )}
                <MessageBubble message={m} onRetry={onRetry} />
              </Fragment>
            )
          })
        )}
      </div>

      <Composer onSend={onSend} autoFocusKey={chat.chatId} />
    </section>
  )
}
