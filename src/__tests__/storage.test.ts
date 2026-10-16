// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadActiveChatId, saveActiveChatId } from '../lib/storage'

describe('active chat persistence', () => {
  beforeEach(() => localStorage.clear())

  it('stores the open chat per instance', () => {
    saveActiveChatId('111', '10000000')
    saveActiveChatId('222', '20000000')
    expect(loadActiveChatId('111')).toBe('10000000')
    expect(loadActiveChatId('222')).toBe('20000000')
  })

  it('forgets the chat when it is closed', () => {
    saveActiveChatId('111', '10000000')
    saveActiveChatId('111', null)
    expect(loadActiveChatId('111')).toBeNull()
  })
})
