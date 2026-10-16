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
  if (!message) return 'Сообщений пока нет'
  const prefix = message.direction === 'outgoing' ? 'Вы: ' : ''
  if (message.kind === 'unsupported') return `${prefix}Неподдерживаемое сообщение`
  return prefix + message.text.replace(/\s+/g, ' ')
}

const statusLabel: Record<ConnectionStatus, string> = {
  connecting: 'Подключение…',
  online: 'Подключено',
  error: 'Проблема с подключением',
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
    <aside className="sidebar" aria-label="Чаты">
      <header className="sidebar-header">
        <h1>Чаты</h1>
        <div className="sidebar-actions">
          <button type="button" className="icon-button" onClick={onNewChat} aria-label="Новый чат" title="Новый чат">
            <EditIcon width={20} height={20} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onOpenSettings}
            aria-label="Настройки подключения"
            title="Настройки подключения"
          >
            <SettingsIcon width={20} height={20} />
          </button>
        </div>
      </header>

      <div className="sidebar-search">
        <SearchIcon width={18} height={18} />
        <input
          type="search"
          placeholder="Поиск"
          aria-label="Поиск по чатам"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chat-list" role="list">
        {visible.length === 0 && (
          <div className="chat-list-empty">
            {chats.length === 0 ? (
              <>
                <p>Чатов пока нет.</p>
                <button type="button" className="button button-primary" onClick={onNewChat}>
                  Начать новый чат
                </button>
              </>
            ) : (
              <p>Ничего не найдено.</p>
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
                <Avatar title={chat.title} seed={chat.chatId} src={chat.avatarUrl} />
                <span className="chat-item-body">
                  <span className="chat-item-top">
                    <span className="chat-item-title">{chat.title}</span>
                    {last && <span className="chat-item-time">{formatListTime(last.timestamp)}</span>}
                  </span>
                  <span className="chat-item-bottom">
                    <span className={`chat-item-preview${last?.status === 'failed' ? ' is-failed' : ''}`}>
                      {last?.status === 'failed'
                        ? `Не отправлено: ${last.text.replace(/\s+/g, ' ')}`
                        : last
                          ? preview(last)
                          : chat.phone
                            ? formatPhone(chat.phone)
                            : preview(undefined)}
                    </span>
                    {chat.unread > 0 && (
                      <span className="badge" aria-label={`Непрочитанных: ${chat.unread}`}>
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
            {connectionMessage ?? `Инстанс ${idInstance}`}
          </span>
        </span>
      </footer>
    </aside>
  )
}
