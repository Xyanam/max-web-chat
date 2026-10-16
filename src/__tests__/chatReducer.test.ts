import { describe, expect, it } from 'vitest'
import { chatReducer, emptyChatState, mergeStatus, sortedChats, type ChatState } from '../state/chatReducer'
import type { ChatMessage } from '../types'

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1',
  chatId: '100',
  direction: 'incoming',
  kind: 'text',
  text: 'hi',
  timestamp: 1000,
  ...over,
})

const add = (state: ChatState, message: ChatMessage, isActive = false) =>
  chatReducer(state, { type: 'addMessage', message, isActive })

describe('chatReducer', () => {
  it('creates a chat for a message from an unknown chat and counts unread', () => {
    const s = chatReducer(emptyChatState, {
      type: 'addMessage',
      message: msg({ idMessage: 'm1' }),
      meta: { title: 'Ivan' },
    })
    expect(s.chats['100']).toMatchObject({ title: 'Ivan', unread: 1 })
    expect(s.messages['100']).toHaveLength(1)
  })

  it('does not count unread for the active chat', () => {
    const s = add(emptyChatState, msg({}), true)
    expect(s.chats['100'].unread).toBe(0)
  })

  it('ignores duplicate idMessage (re-delivered notification)', () => {
    const s1 = add(emptyChatState, msg({ id: 'a', idMessage: 'X' }))
    const s2 = add(s1, msg({ id: 'X', idMessage: 'X' }))
    expect(s2).toBe(s1)
  })

  it('keeps messages in chronological order', () => {
    let s = add(emptyChatState, msg({ id: 'b', timestamp: 2000 }))
    s = add(s, msg({ id: 'a', timestamp: 1000 }))
    s = add(s, msg({ id: 'c', timestamp: 3000 }))
    expect(s.messages['100'].map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('merges an early outgoingAPIMessageReceived into the pending local message', () => {
    let s = add(emptyChatState, msg({ id: 'local', direction: 'outgoing', status: 'sending', text: 'yo' }), true)
    s = add(s, msg({ id: 'X', idMessage: 'X', direction: 'outgoing', status: 'sent', text: 'yo' }))
    expect(s.messages['100']).toHaveLength(1)
    s = chatReducer(s, { type: 'updateMessage', chatId: '100', id: 'local', patch: { idMessage: 'X', status: 'sent' } })
    expect(s.messages['100']).toEqual([expect.objectContaining({ id: 'local', idMessage: 'X', status: 'sent' })])
  })

  it('removes a twin when SendMessage resolves after the notification was stored', () => {
    let s = add(emptyChatState, msg({ id: 'local', direction: 'outgoing', status: 'sending', text: 'a' }), true)
    s = add(s, msg({ id: 'X', idMessage: 'X', direction: 'outgoing', status: 'sent', text: 'different' }))
    s = chatReducer(s, { type: 'applyStatus', chatId: '100', idMessage: 'X', status: 'delivered' })
    s = chatReducer(s, { type: 'updateMessage', chatId: '100', id: 'local', patch: { idMessage: 'X', status: 'sent' } })
    expect(s.messages['100']).toEqual([expect.objectContaining({ id: 'local', status: 'delivered' })])
  })

  it('applies delivery statuses without going backwards', () => {
    let s = add(emptyChatState, msg({ id: 'o', idMessage: 'X', direction: 'outgoing', status: 'sent' }))
    s = chatReducer(s, { type: 'applyStatus', chatId: '100', idMessage: 'X', status: 'read' })
    s = chatReducer(s, { type: 'applyStatus', chatId: '100', idMessage: 'X', status: 'delivered' })
    expect(s.messages['100'][0].status).toBe('read')
  })

  it('marks failed status with an error', () => {
    let s = add(emptyChatState, msg({ id: 'o', idMessage: 'X', direction: 'outgoing', status: 'sent' }))
    s = chatReducer(s, { type: 'applyStatus', chatId: '100', idMessage: 'X', status: 'failed', error: 'nope' })
    expect(s.messages['100'][0]).toMatchObject({ status: 'failed', error: 'nope' })
  })

  it('replaces a phone placeholder title with the contact name', () => {
    let s = chatReducer(emptyChatState, {
      type: 'openChat',
      chatId: '100',
      meta: { title: '+7 999 123-45-67', phone: '79991234567' },
    })
    s = chatReducer(s, { type: 'addMessage', message: msg({}), meta: { title: 'Ivan' } })
    expect(s.chats['100'].title).toBe('Ivan')
  })

  it('openChat resets unread', () => {
    let s = add(emptyChatState, msg({}))
    s = chatReducer(s, { type: 'openChat', chatId: '100' })
    expect(s.chats['100'].unread).toBe(0)
  })

  it('sorts chats by latest activity', () => {
    let s = add(emptyChatState, msg({ chatId: 'a', id: '1', timestamp: 1 }))
    s = add(s, msg({ chatId: 'b', id: '2', timestamp: 5 }))
    expect(sortedChats(s).map((c) => c.chatId)).toEqual(['b', 'a'])
  })
})

describe('mergeStatus', () => {
  it('handles transitions', () => {
    expect(mergeStatus('sending', 'sent')).toBe('sent')
    expect(mergeStatus('read', 'sent')).toBe('read')
    expect(mergeStatus('sent', 'failed')).toBe('failed')
    expect(mergeStatus('delivered', 'failed')).toBe('delivered')
  })
})

describe('chat title placeholders', () => {
  it('treats a phone title in the old format as a placeholder too', () => {
    let s = chatReducer(emptyChatState, {
      type: 'openChat',
      chatId: '100',
      meta: { title: '+7 999 123-45-67', phone: '79991234567' },
    })
    s = chatReducer(s, { type: 'addMessage', message: msg({ id: 'z' }), meta: { title: 'Ivan' } })
    expect(s.chats['100'].title).toBe('Ivan')
  })
})

describe('updateContact', () => {
  const opened = chatReducer(emptyChatState, {
    type: 'openChat',
    chatId: '100',
    meta: { title: '+7 (999) 123-45-67', phone: '79991234567' },
  })

  it('sets the name and avatar from GetContactInfo', () => {
    const s = chatReducer(opened, { type: 'updateContact', chatId: '100', name: 'Ваня', avatarUrl: 'https://a/1' })
    expect(s.chats['100']).toMatchObject({ title: 'Ваня', avatarUrl: 'https://a/1', phone: '79991234567' })
  })

  it('keeps the current title when the name is empty and clears a removed avatar', () => {
    let s = chatReducer(opened, { type: 'updateContact', chatId: '100', name: '', avatarUrl: 'https://a/1' })
    s = chatReducer(s, { type: 'updateContact', chatId: '100', name: '', avatarUrl: '' })
    expect(s.chats['100'].title).toBe('+7 (999) 123-45-67')
    expect(s.chats['100'].avatarUrl).toBeUndefined()
  })

  it('fills in a missing phone number', () => {
    let s = add(emptyChatState, msg({ chatId: '200' }))
    s = chatReducer(s, { type: 'updateContact', chatId: '200', name: 'Ольга', avatarUrl: '', phone: '375291234567' })
    expect(s.chats['200'].phone).toBe('375291234567')
  })

  it('returns the same state when nothing changes or the chat is unknown', () => {
    const s = chatReducer(opened, { type: 'updateContact', chatId: '100', name: '', avatarUrl: '' })
    expect(s).toBe(opened)
    expect(chatReducer(opened, { type: 'updateContact', chatId: 'x', name: 'a', avatarUrl: '' })).toBe(opened)
  })
})
