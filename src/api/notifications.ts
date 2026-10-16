import type { MessageDirection, MessageStatus } from '../types'

/**
 * Parsed form of a GREEN-API notification body (the `body` field returned by
 * ReceiveNotification). Only what this text chat needs is extracted.
 */
export type ParsedNotification =
  | {
      type: 'message'
      direction: MessageDirection
      chatId: string
      idMessage: string
      /** Milliseconds since epoch. */
      timestamp: number
      kind: 'text' | 'unsupported'
      text: string
      messageType: string
      /** Best available display name for the chat. */
      chatTitle?: string
      phone?: string
    }
  | {
      type: 'status'
      chatId: string
      idMessage: string
      status: MessageStatus
      description?: string
    }
  | { type: 'ignored'; reason: string }

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)

/** chatId may come as a string or a number. Group chats in MAX have negative IDs. */
function chatIdOf(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return str(v)
}

/** GREEN-API timestamps are UNIX seconds. Fall back to "now" if missing. */
function toMillis(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return Date.now()
  return v < 1e12 ? v * 1000 : v
}

/** Returns text for text-like message types; undefined for media and others. */
function extractText(messageData: Json): string | undefined {
  const type = messageData.typeMessage
  if (type === 'textMessage') {
    const data = messageData.textMessageData
    return isObject(data) && typeof data.textMessage === 'string' ? data.textMessage : undefined
  }
  if (type === 'extendedTextMessage' || type === 'quotedMessage') {
    const data = messageData.extendedTextMessageData
    return isObject(data) && typeof data.text === 'string' ? data.text : undefined
  }
  return undefined
}

const OUTGOING_STATUS: Record<string, MessageStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'failed',
  notInGroup: 'failed',
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  failed: 'MAX could not deliver the message.',
  noAccount: 'The recipient has no MAX account.',
  notInGroup: 'You are not a member of this group.',
}

function isGroupChat(chatId: string, senderData: Json): boolean {
  return senderData.chatType === 'group' || chatId.startsWith('-') || chatId.endsWith('@g.us')
}

export function parseNotification(body: unknown): ParsedNotification {
  if (!isObject(body)) return { type: 'ignored', reason: 'invalid body' }
  const typeWebhook = str(body.typeWebhook) ?? 'unknown'

  switch (typeWebhook) {
    case 'incomingMessageReceived':
    case 'outgoingMessageReceived': // sent from the phone / another MAX client
    case 'outgoingAPIMessageReceived': {
      // sent through the API (possibly by this app)
      const senderData = isObject(body.senderData) ? body.senderData : null
      const messageData = isObject(body.messageData) ? body.messageData : null
      const chatId = senderData ? chatIdOf(senderData.chatId) : undefined
      const idMessage = str(body.idMessage)
      if (!senderData || !messageData || !chatId || !idMessage) {
        return { type: 'ignored', reason: `${typeWebhook}: missing fields` }
      }
      if (isGroupChat(chatId, senderData)) return { type: 'ignored', reason: 'group chats are not supported' }

      const direction: MessageDirection = typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing'
      const messageType = str(messageData.typeMessage) ?? 'unknown'
      const text = extractText(messageData)
      const phoneNumber = senderData.senderPhoneNumber
      const phone =
        direction === 'incoming' && typeof phoneNumber === 'number' && phoneNumber > 0 ? String(phoneNumber) : undefined
      const chatTitle =
        direction === 'incoming'
          ? (str(senderData.senderContactName) ?? str(senderData.chatName) ?? str(senderData.senderName))
          : str(senderData.chatName)

      return {
        type: 'message',
        direction,
        chatId,
        idMessage,
        timestamp: toMillis(body.timestamp),
        kind: text !== undefined ? 'text' : 'unsupported',
        text: text ?? '',
        messageType,
        chatTitle,
        phone,
      }
    }

    case 'outgoingMessageStatus': {
      const chatId = chatIdOf(body.chatId)
      const idMessage = str(body.idMessage)
      const rawStatus = str(body.status)
      const status = rawStatus ? OUTGOING_STATUS[rawStatus] : undefined
      if (!chatId || !idMessage || !status) return { type: 'ignored', reason: 'outgoingMessageStatus: unknown status' }
      return {
        type: 'status',
        chatId,
        idMessage,
        status,
        description: status === 'failed' ? (str(body.description) ?? STATUS_DESCRIPTIONS[rawStatus!]) : undefined,
      }
    }

    default:
      // stateInstanceChanged, incomingCall, etc. are acknowledged and skipped.
      return { type: 'ignored', reason: typeWebhook }
  }
}
