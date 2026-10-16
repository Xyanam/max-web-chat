export interface Credentials {
  /** API host from the GREEN-API console, e.g. https://3100.api.green-api.com/v3 */
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type MessageDirection = 'incoming' | 'outgoing'

/**
 * sending   – request in flight
 * sent      – accepted by GREEN-API (queued, idMessage received)
 * delivered – outgoingMessageStatus "delivered"
 * read      – outgoingMessageStatus "read"
 * failed    – request failed or outgoingMessageStatus failed/noAccount/notInGroup
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface ChatMessage {
  /** Stable local key. Equals idMessage for messages received from notifications. */
  id: string
  idMessage?: string
  chatId: string
  direction: MessageDirection
  /** "unsupported" is used for media and other non-text messages. */
  kind: 'text' | 'unsupported'
  text: string
  /** Original typeMessage for unsupported messages, e.g. "imageMessage". */
  messageType?: string
  /** Milliseconds since epoch. */
  timestamp: number
  status?: MessageStatus
  error?: string
}

export interface Chat {
  /** MAX chatId as returned by CheckAccount / notifications. */
  chatId: string
  title: string
  /** Normalized phone number (digits only), if known. */
  phone?: string
  unread: number
  createdAt: number
}

export type InstanceState =
  | 'authorized'
  | 'notAuthorized'
  | 'blocked'
  | 'starting'
  | 'suspended'
  | 'pendingPassword'
  | string
