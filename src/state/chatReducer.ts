import type { Chat, ChatMessage, MessageStatus } from '../types'

export interface ChatState {
  chats: Record<string, Chat>
  messages: Record<string, ChatMessage[]>
}

export const emptyChatState: ChatState = { chats: {}, messages: {} }

export interface ChatMeta {
  title?: string
  phone?: string
}

export type ChatAction =
  | { type: 'reset'; state: ChatState }
  | { type: 'openChat'; chatId: string; meta?: ChatMeta }
  | { type: 'markRead'; chatId: string }
  | { type: 'addMessage'; message: ChatMessage; meta?: ChatMeta; isActive?: boolean }
  | { type: 'updateMessage'; chatId: string; id: string; patch: Partial<ChatMessage> }
  | { type: 'applyStatus'; chatId: string; idMessage: string; status: MessageStatus; error?: string }

const statusRank: Record<MessageStatus, number> = {
  failed: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
}

/** Status never moves backwards (e.g. "read" is not replaced by a late "delivered"). */
export function mergeStatus(current: MessageStatus | undefined, next: MessageStatus): MessageStatus {
  if (!current) return next
  if (next === 'failed') return current === 'read' || current === 'delivered' ? current : 'failed'
  if (current === 'failed') return statusRank[next] >= statusRank.delivered ? next : current
  return statusRank[next] > statusRank[current] ? next : current
}

function upsertChat(chats: Record<string, Chat>, chatId: string, meta?: ChatMeta): Record<string, Chat> {
  const existing = chats[chatId]
  if (existing) {
    // Replace placeholder titles (raw chatId or phone number) with a real name once known.
    const isPlaceholder =
      existing.title === existing.chatId ||
      (existing.phone !== undefined && existing.title.replace(/\D/g, '') === existing.phone)
    const title = isPlaceholder && meta?.title ? meta.title : existing.title
    const phone = existing.phone ?? meta?.phone
    if (title === existing.title && phone === existing.phone) return chats
    return { ...chats, [chatId]: { ...existing, title, phone } }
  }
  return {
    ...chats,
    [chatId]: {
      chatId,
      title: meta?.title || chatId,
      phone: meta?.phone,
      unread: 0,
      createdAt: Date.now(),
    },
  }
}

function insertSorted(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const next = [...list]
  let i = next.length
  while (i > 0 && next[i - 1].timestamp > message.timestamp) i--
  next.splice(i, 0, message)
  return next
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'reset':
      return action.state

    case 'openChat': {
      const chats = upsertChat(state.chats, action.chatId, action.meta)
      const chat = chats[action.chatId]
      return {
        chats: chat.unread ? { ...chats, [action.chatId]: { ...chat, unread: 0 } } : chats,
        messages: state.messages[action.chatId] ? state.messages : { ...state.messages, [action.chatId]: [] },
      }
    }

    case 'markRead': {
      const chat = state.chats[action.chatId]
      if (!chat || chat.unread === 0) return state
      return { ...state, chats: { ...state.chats, [action.chatId]: { ...chat, unread: 0 } } }
    }

    case 'addMessage': {
      const { message } = action
      const list = state.messages[message.chatId] ?? []
      const duplicate = list.some(
        (m) => m.id === message.id || (message.idMessage && m.idMessage === message.idMessage),
      )
      if (duplicate) return state

      // outgoingAPIMessageReceived can arrive before the SendMessage response.
      // Attach its idMessage to the matching pending message instead of adding a copy.
      if (message.direction === 'outgoing' && message.idMessage) {
        const pending = list.find(
          (m) => m.direction === 'outgoing' && m.status === 'sending' && !m.idMessage && m.text === message.text,
        )
        if (pending) {
          return {
            ...state,
            messages: {
              ...state.messages,
              [message.chatId]: list.map((m) => (m === pending ? { ...m, idMessage: message.idMessage } : m)),
            },
          }
        }
      }

      let chats = upsertChat(state.chats, message.chatId, action.meta)
      if (message.direction === 'incoming' && !action.isActive) {
        const chat = chats[message.chatId]
        chats = { ...chats, [message.chatId]: { ...chat, unread: chat.unread + 1 } }
      }
      return {
        chats,
        messages: { ...state.messages, [message.chatId]: insertSorted(list, message) },
      }
    }

    case 'updateMessage': {
      const list = state.messages[action.chatId]
      if (!list) return state
      const target = list.find((m) => m.id === action.id)
      if (!target) return state

      let updated: ChatMessage = { ...target, ...action.patch }
      // A delivery status notification may already have advanced the message past "sent".
      if (action.patch.status === 'sent' && target.status) {
        updated.status = mergeStatus(target.status === 'failed' ? 'sending' : target.status, 'sent')
      }
      let rest = list
      // A notification for this idMessage may have arrived before the SendMessage
      // response. Merge it into the local message instead of showing it twice.
      if (action.patch.idMessage) {
        const twin = list.find((m) => m.id !== action.id && m.idMessage === action.patch.idMessage)
        if (twin) {
          rest = list.filter((m) => m !== twin)
          if (twin.status) updated = { ...updated, status: mergeStatus(updated.status, twin.status) }
        }
      }
      return {
        ...state,
        messages: { ...state.messages, [action.chatId]: rest.map((m) => (m.id === action.id ? updated : m)) },
      }
    }

    case 'applyStatus': {
      const list = state.messages[action.chatId]
      if (!list) return state
      let changed = false
      const next = list.map((m) => {
        if (m.idMessage !== action.idMessage || m.direction !== 'outgoing') return m
        const status = mergeStatus(m.status, action.status)
        if (status === m.status) return m
        changed = true
        return { ...m, status, error: status === 'failed' ? action.error : undefined }
      })
      return changed ? { ...state, messages: { ...state.messages, [action.chatId]: next } } : state
    }
  }
}

export function lastMessage(state: ChatState, chatId: string): ChatMessage | undefined {
  const list = state.messages[chatId]
  return list && list.length ? list[list.length - 1] : undefined
}

/** Chats sorted by most recent activity. */
export function sortedChats(state: ChatState): Chat[] {
  const activity = (c: Chat) => lastMessage(state, c.chatId)?.timestamp ?? c.createdAt
  return Object.values(state.chats).sort((a, b) => activity(b) - activity(a))
}
