import { describe, expect, it } from 'vitest'
import { enableNotificationsBody, missingNotifications } from '../lib/notificationSettings'

describe('notification settings', () => {
  it('lists disabled notification types', () => {
    const missing = missingNotifications({
      incomingWebhook: 'yes',
      outgoingMessageWebhook: 'no',
      outgoingWebhook: 'no',
      stateWebhook: 'no',
    })
    expect(missing.map((n) => n.key)).toEqual(['outgoingMessageWebhook', 'outgoingWebhook'])
  })

  it('treats absent settings as disabled', () => {
    expect(missingNotifications({}).map((n) => n.key)).toEqual([
      'incomingWebhook',
      'outgoingMessageWebhook',
      'outgoingWebhook',
    ])
  })

  it('returns nothing when everything is enabled', () => {
    expect(
      missingNotifications({ incomingWebhook: 'yes', outgoingMessageWebhook: 'yes', outgoingWebhook: 'yes' }),
    ).toEqual([])
  })

  it('builds a SetSettings body only for the missing types', () => {
    const body = enableNotificationsBody(missingNotifications({ incomingWebhook: 'yes' }))
    expect(body).toEqual({ outgoingMessageWebhook: 'yes', outgoingWebhook: 'yes' })
  })
})
