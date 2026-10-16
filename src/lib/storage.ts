import type { Credentials } from '../types'
import { emptyChatState, type ChatState } from '../state/chatReducer'

const CREDENTIALS_KEY = 'max-web-chat:credentials'
const chatKey = (idInstance: string) => `max-web-chat:chats:${idInstance}`

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage may be unavailable (private mode, quota) — the app still works in memory.
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // ignore
  }
}

function isCredentials(value: unknown): value is Credentials {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.apiUrl === 'string' && typeof v.idInstance === 'string' && typeof v.apiTokenInstance === 'string'
}

/**
 * Credentials live in sessionStorage by default (cleared when the tab closes).
 * localStorage is used only if the user explicitly ticks "Remember on this device".
 */
export function loadCredentials(): { credentials: Credentials; remember: boolean } | null {
  for (const [storage, remember] of [
    [sessionStorage, false],
    [localStorage, true],
  ] as const) {
    const raw = safeGet(storage, CREDENTIALS_KEY)
    if (!raw) continue
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isCredentials(parsed)) return { credentials: parsed, remember }
    } catch {
      // fall through
    }
  }
  return null
}

export function saveCredentials(credentials: Credentials, remember: boolean) {
  clearCredentials()
  safeSet(remember ? localStorage : sessionStorage, CREDENTIALS_KEY, JSON.stringify(credentials))
}

export function clearCredentials() {
  safeRemove(sessionStorage, CREDENTIALS_KEY)
  safeRemove(localStorage, CREDENTIALS_KEY)
}

export function loadChatState(idInstance: string): ChatState {
  const raw = safeGet(localStorage, chatKey(idInstance))
  if (!raw) return emptyChatState
  try {
    const parsed = JSON.parse(raw) as ChatState
    if (parsed && typeof parsed.chats === 'object' && typeof parsed.messages === 'object') {
      // Requests that were in flight when the page closed never got a response.
      for (const list of Object.values(parsed.messages)) {
        for (const m of list) {
          if (m.status === 'sending') {
            m.status = 'failed'
            m.error = 'Отправка прервана до подтверждения сервером.'
          }
        }
      }
      return parsed
    }
  } catch {
    // corrupted — start fresh
  }
  return emptyChatState
}

export function saveChatState(idInstance: string, state: ChatState) {
  safeSet(localStorage, chatKey(idInstance), JSON.stringify(state))
}
