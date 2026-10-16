import { describe, expect, it, vi } from 'vitest'
import { GreenApiClient, GreenApiError } from '../api/greenApi'

const creds = { apiUrl: 'https://1234.api.green-api.com/v3/', idInstance: '1234567890', apiTokenInstance: 'test-token' }

function mockFetch(status: number, body: string) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, { status }))
}

describe('GreenApiClient', () => {
  it('sends a text message with the documented URL, method, headers and body', async () => {
    const fetchFn = mockFetch(200, '{"idMessage":"1763115112345"}')
    const client = new GreenApiClient(creds, fetchFn)
    await expect(client.sendMessage('10000000', 'Hello')).resolves.toEqual({ idMessage: '1763115112345' })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://1234.api.green-api.com/v3/waInstance1234567890/sendMessage/test-token')
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(init!.body as string)).toEqual({ chatId: '10000000', message: 'Hello' })
  })

  it('calls checkAccount with an integer phone number', async () => {
    const fetchFn = mockFetch(200, '{"exist":true,"chatId":"10000000","fromCache":true}')
    const client = new GreenApiClient(creds, fetchFn)
    await expect(client.checkAccount('79991234567')).resolves.toEqual({ exist: true, chatId: '10000000' })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toMatch(/\/waInstance1234567890\/checkAccount\/test-token$/)
    expect(JSON.parse(init!.body as string)).toEqual({ phoneNumber: 79991234567 })
  })

  it('reports checkAccount limit responses', async () => {
    const client = new GreenApiClient(creds, mockFetch(200, '{"status":false,"reason":"User get contact info limit reached"}'))
    await expect(client.checkAccount('79991234567')).rejects.toMatchObject({ kind: 'rateLimit' })
  })

  it('long-polls receiveNotification and returns null for an empty queue', async () => {
    const fetchFn = mockFetch(200, 'null')
    const client = new GreenApiClient(creds, fetchFn)
    await expect(client.receiveNotification(20)).resolves.toBeNull()
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://1234.api.green-api.com/v3/waInstance1234567890/receiveNotification/test-token?receiveTimeout=20',
    )
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ method: 'GET' })

    const empty = new GreenApiClient(creds, mockFetch(200, ''))
    await expect(empty.receiveNotification(20)).resolves.toBeNull()
  })

  it('clamps receiveTimeout to 5–60 seconds', async () => {
    const fetchFn = mockFetch(200, 'null')
    const client = new GreenApiClient(creds, fetchFn)
    await client.receiveNotification(500)
    expect(fetchFn.mock.calls[0][0]).toMatch(/receiveTimeout=60$/)
  })

  it('returns notification receiptId and body', async () => {
    const client = new GreenApiClient(creds, mockFetch(200, '{"receiptId":7,"body":{"typeWebhook":"x"}}'))
    await expect(client.receiveNotification(5)).resolves.toEqual({ receiptId: 7, body: { typeWebhook: 'x' } })
  })

  it('deletes notifications with DELETE and the receiptId in the path', async () => {
    const fetchFn = mockFetch(200, '{"result":true,"reason":""}')
    const client = new GreenApiClient(creds, fetchFn)
    await expect(client.deleteNotification(7)).resolves.toBe(true)
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://1234.api.green-api.com/v3/waInstance1234567890/deleteNotification/test-token/7',
    )
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
  })

  it('maps 401 to an auth error without leaking the token', async () => {
    const client = new GreenApiClient(creds, mockFetch(401, ''))
    const err = await client.getStateInstance().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GreenApiError)
    expect(err).toMatchObject({ kind: 'auth' })
    expect((err as Error).message).not.toContain('test-token')
  })

  it('maps network failures', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch https://.../test-token')
    })
    const client = new GreenApiClient(creds, fetchFn)
    const err = await client.sendMessage('1', 'x').catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'network' })
    expect((err as Error).message).not.toContain('test-token')
  })

  it('explains the webhookUrl conflict', async () => {
    const client = new GreenApiClient(creds, mockFetch(400, '{"message":"Custom webhook url is set"}'))
    await expect(client.receiveNotification(5)).rejects.toThrow(/webhookUrl/)
  })

  it('shows a friendly Russian message instead of raw API details', async () => {
    const client = new GreenApiClient(creds, mockFetch(500, '{"message":"Internal error","stack":"..."}'))
    const err = (await client.sendMessage('1', 'x').catch((e: unknown) => e)) as Error
    expect(err.message).toBe('Сервер GREEN-API временно недоступен. Попробуйте позже.')
    expect(err.message).not.toMatch(/Internal|\{/)
  })

  it('calls getContactInfo with the chatId and prefers the address-book name', async () => {
    const fetchFn = mockFetch(
      200,
      JSON.stringify({
        avatar: 'https://i.oneme.ru/i?r=abc',
        name: 'Ivan Petrov',
        contactName: 'Ваня',
        chatId: '10000000',
        chatType: 'user',
        lastSeen: 1754632014,
        phoneNumber: 79876543210,
      }),
    )
    const client = new GreenApiClient(creds, fetchFn)
    await expect(client.getContactInfo('10000000')).resolves.toEqual({
      name: 'Ваня',
      avatarUrl: 'https://i.oneme.ru/i?r=abc',
      phone: '79876543210',
    })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://1234.api.green-api.com/v3/waInstance1234567890/getContactInfo/test-token')
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(init!.body as string)).toEqual({ chatId: '10000000' })
  })

  it('falls back to the MAX profile name and drops hidden or non-https data', async () => {
    const client = new GreenApiClient(
      creds,
      mockFetch(200, '{"avatar":"javascript:alert(1)","name":"Ivan","contactName":"","phoneNumber":0}'),
    )
    await expect(client.getContactInfo('10000000')).resolves.toEqual({ name: 'Ivan', avatarUrl: '', phone: undefined })
  })

  it('maps suspended account 403', async () => {
    const client = new GreenApiClient(creds, mockFetch(403, 'Your account is suspended'))
    await expect(client.sendMessage('1', 'x')).rejects.toThrow(/временно ограничен/)
  })
})
