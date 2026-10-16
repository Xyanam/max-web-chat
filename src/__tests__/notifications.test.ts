import { describe, expect, it } from 'vitest'
import { parseNotification } from '../api/notifications'

const incomingText = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 1, wid: '79990000000@c.us', typeInstance: 'v3' },
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: {
    chatId: '10000000',
    chatName: 'Ivan',
    chatType: 'user',
    sender: '10000000',
    senderName: 'Ivan',
    senderType: 'user',
    senderContactName: 'Ivan Petrov',
    senderPhoneNumber: 79991234567,
  },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
}

describe('parseNotification', () => {
  it('parses an incoming text message', () => {
    expect(parseNotification(incomingText)).toEqual({
      type: 'message',
      direction: 'incoming',
      chatId: '10000000',
      idMessage: '1763115112345',
      timestamp: 1763115112000,
      kind: 'text',
      text: 'Привет!',
      messageType: 'textMessage',
      chatTitle: 'Ivan Petrov',
      phone: '79991234567',
    })
  })

  it('parses extendedTextMessage text', () => {
    const n = parseNotification({
      ...incomingText,
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'link https://x.y' } },
    })
    expect(n).toMatchObject({ type: 'message', kind: 'text', text: 'link https://x.y' })
  })

  it('marks media as unsupported and never exposes captions as text', () => {
    const n = parseNotification({
      ...incomingText,
      messageData: { typeMessage: 'imageMessage', fileMessageData: { caption: 'cap', downloadUrl: 'https://x' } },
    })
    expect(n).toMatchObject({ type: 'message', kind: 'unsupported', text: '', messageType: 'imageMessage' })
  })

  it('treats outgoing API and phone messages as outgoing', () => {
    for (const typeWebhook of ['outgoingAPIMessageReceived', 'outgoingMessageReceived']) {
      const n = parseNotification({ ...incomingText, typeWebhook })
      expect(n).toMatchObject({ type: 'message', direction: 'outgoing', chatTitle: 'Ivan', phone: undefined })
    }
  })

  it('ignores group chats', () => {
    const n = parseNotification({
      ...incomingText,
      senderData: { ...incomingText.senderData, chatId: '-10000000000000', chatType: 'group' },
    })
    expect(n.type).toBe('ignored')
  })

  it('maps outgoingMessageStatus values', () => {
    const base = { typeWebhook: 'outgoingMessageStatus', chatId: '10000000', idMessage: '42', timestamp: 1 }
    expect(parseNotification({ ...base, status: 'delivered' })).toMatchObject({ type: 'status', status: 'delivered' })
    expect(parseNotification({ ...base, status: 'read' })).toMatchObject({ type: 'status', status: 'read' })
    expect(parseNotification({ ...base, status: 'noAccount' })).toMatchObject({
      type: 'status',
      status: 'failed',
      description: 'The recipient has no MAX account.',
    })
    expect(parseNotification({ ...base, status: 'weird' }).type).toBe('ignored')
  })

  it('ignores other and malformed notifications', () => {
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' }).type).toBe('ignored')
    expect(parseNotification(null).type).toBe('ignored')
    expect(parseNotification({ typeWebhook: 'incomingMessageReceived' }).type).toBe('ignored')
  })
})
