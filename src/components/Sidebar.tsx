import { useState } from 'react'
import type { Chat, ChatMessage } from '../types'
import { formatListTime } from '../lib/format'
import { formatPhone } from '../lib/phone'
import { Avatar } from './Avatar'
import { EditIcon, SearchIcon, SettingsIcon } from './Icons'

export type ConnectionStatus = 'connecting' | 'online' | 'error'

interface SidebarProps {
  chats: Chat[]
  lastMessages: Record<string, ChatMessage | undefined>
  activeChatId: string | null
  connectionStatus: ConnectionStatus
  connectionMessage?: string
  idInstance: string
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
  onOpenSettings: () => void
}

function preview(message: ChatMessage | undefined): string {
  if (!message) return 'No messages yet'
  const prefix = message.direction === 'outgoing' ? 'You: ' : ''
  if (message.kind === 'unsupported') return `${prefix}Unsupported message`
  return prefix + message.text.replace(/\s+/g, ' ')
}

const statusLabel: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  online: 'Connected',
  error: 'Connection problem',
}

export function Sidebar({
  chats,
  lastMessages,
  activeChatId,
  connectionStatus,
  connectionMessage,
  idInstance,
  onSelectChat,
  onNewChat,
  onOpenSettings,
}: SidebarProps) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  const visible = q
    ? chats.filter((c) => c.title.toLowerCase().includes(q) || Boolean(qDigits && c.phone?.includes(qDigits)))
    : chats

  return (
    <aside className="sidebar" aria-label="Chats">
      <header className="sidebar-header">
        <h1>Chats</h1>
        <div className="sidebar-actions">
          <button type="button" className="icon-button" onClick={onNewChat} aria-label="New chat" title="New chat">
            <EditIcon width={20} height={20} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onOpenSettings}
            aria-label="Connection settings"
            title="Connection settings"
          >
            <SettingsIcon width={20} height={20} />
          </button>
        </div>
      </header>

      <div className="sidebar-search">
        <SearchIcon width={18} height={18} />
        <input
          type="search"
          placeholder="Search"
          aria-label="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chat-list" role="list">
        {visible.length === 0 && (
          <div className="chat-list-empty">
            {chats.length === 0 ? (
              <>
                <p>No chats yet.</p>
                <button type="button" className="button button-primary" onClick={onNewChat}>
                  Start a new chat
                </button>
              </>
            ) : (
              <p>Nothing found.</p>
            )}
          </div>
        )}
        {visible.map((chat) => {
          const last = lastMessages[chat.chatId]
          const active = chat.chatId === activeChatId
          return (
            <div role="listitem" key={chat.chatId}>
              <button
                type="button"
                className={`chat-item${active ? ' is-active' : ''}`}
                onClick={() => onSelectChat(chat.chatId)}
                aria-current={active ? 'true' : undefined}
              >
                <Avatar title={chat.title} seed={chat.chatId} />
                <span className="chat-item-body">
                  <span className="chat-item-top">
                    <span className="chat-item-title">{chat.title}</span>
                    {last && <span className="chat-item-time">{formatListTime(last.timestamp)}</span>}
                  </span>
                  <span className="chat-item-bottom">
                    <span className={`chat-item-preview${last?.status === 'failed' ? ' is-failed' : ''}`}>
                      {last?.status === 'failed'
                        ? `Not sent: ${last.text.replace(/\s+/g, ' ')}`
                        : last
                          ? preview(last)
                          : chat.phone
                            ? formatPhone(chat.phone)
                            : preview(undefined)}
                    </span>
                    {chat.unread > 0 && (
                      <span className="badge" aria-label={`${chat.unread} unread`}>
                        {chat.unread > 99 ? '99+' : chat.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <footer className="sidebar-footer">
        <span className={`status-dot status-${connectionStatus}`} aria-hidden="true" />
        <span className="sidebar-footer-text">
          <span>{statusLabel[connectionStatus]}</span>
          <span className="muted" title={connectionMessage}>
            {connectionMessage ?? `Instance ${idInstance}`}
          </span>
        </span>
      </footer>
    </aside>
  )
}
