import { describe, expect, it, vi } from 'vitest'
import { startNotificationPoller } from '../api/notificationPoller'
import { GreenApiError, type ReceivedNotification } from '../api/greenApi'

const instantSleep = () => Promise.resolve()

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

describe('startNotificationPoller', () => {
  it('processes a notification before deleting it, then keeps polling', async () => {
    const order: string[] = []
    const queue: (ReceivedNotification | null)[] = [{ receiptId: 1, body: { n: 1 } }, null]
    let stop = () => {}
    const client = {
      receiveNotification: vi.fn(async () => {
        const next = queue.shift()
        if (next === undefined) {
          stop()
          return null
        }
        return next
      }),
      deleteNotification: vi.fn(async (id: number) => {
        order.push(`delete:${id}`)
        return true
      }),
    }
    stop = startNotificationPoller({
      client,
      onNotification: (body) => {
        order.push(`process:${JSON.stringify(body)}`)
      },
      sleep: instantSleep,
    })
    for (let i = 0; i < 10; i++) await flush()
    expect(order).toEqual(['process:{"n":1}', 'delete:1'])
    expect(client.receiveNotification).toHaveBeenCalledTimes(3)
  })

  it('still deletes a notification whose handler throws, so the queue is not blocked', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let calls = 0
    let stop = () => {}
    const client = {
      receiveNotification: vi.fn(async () => (calls++ === 0 ? { receiptId: 5, body: {} } : (stop(), null))),
      deleteNotification: vi.fn(async () => true),
    }
    stop = startNotificationPoller({
      client,
      onNotification: () => {
        throw new Error('boom')
      },
      sleep: instantSleep,
    })
    for (let i = 0; i < 10; i++) await flush()
    expect(client.deleteNotification).toHaveBeenCalledWith(5, expect.anything())
    expect(warn).toHaveBeenCalledWith(expect.not.stringContaining('token'))
    warn.mockRestore()
  })

  it('backs off after errors and reports status', async () => {
    const sleeps: number[] = []
    const statuses: string[] = []
    let calls = 0
    let stop = () => {}
    const client = {
      receiveNotification: vi.fn(async () => {
        calls++
        if (calls <= 3) throw new GreenApiError('network', 'down')
        stop()
        return null
      }),
      deleteNotification: vi.fn(async () => true),
    }
    stop = startNotificationPoller({
      client,
      onNotification: () => {},
      onStatus: (s) => statuses.push(s.state),
      initialBackoffMs: 1000,
      maxBackoffMs: 3000,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })
    for (let i = 0; i < 20; i++) await flush()
    expect(sleeps).toEqual([1000, 2000, 3000])
    expect(statuses).toEqual(['error', 'error', 'error'])
    expect(client.deleteNotification).not.toHaveBeenCalled()
  })

  it('does not delete when stopped during processing', async () => {
    let stop = () => {}
    const client = {
      receiveNotification: vi.fn(async () => ({ receiptId: 9, body: {} })),
      deleteNotification: vi.fn(async () => true),
    }
    stop = startNotificationPoller({ client, onNotification: () => stop(), sleep: instantSleep })
    for (let i = 0; i < 10; i++) await flush()
    expect(client.deleteNotification).not.toHaveBeenCalled()
    expect(client.receiveNotification).toHaveBeenCalledTimes(1)
  })

  it('passes an abort signal that fires on stop', async () => {
    let captured: AbortSignal | undefined
    const client = {
      receiveNotification: vi.fn((_t: number, signal?: AbortSignal) => {
        captured = signal
        return new Promise<null>(() => {})
      }),
      deleteNotification: vi.fn(async () => true),
    }
    const stop = startNotificationPoller({ client, onNotification: () => {} })
    await flush()
    expect(captured?.aborted).toBe(false)
    stop()
    expect(captured?.aborted).toBe(true)
  })
})
