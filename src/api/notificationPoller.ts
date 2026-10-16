import { isAbortError, type GreenApiClient } from './greenApi'

export type PollerStatus = { state: 'ok' } | { state: 'error'; error: unknown; retryInMs: number }

export interface PollerOptions {
  client: Pick<GreenApiClient, 'receiveNotification' | 'deleteNotification'>
  /**
   * Called for every notification body. Must finish processing (e.g. store the
   * message) before resolving — the notification is deleted from the queue only
   * afterwards.
   */
  onNotification: (body: unknown) => void | Promise<void>
  onStatus?: (status: PollerStatus) => void
  /** Long-poll timeout for ReceiveNotification, seconds (5–60). */
  receiveTimeout?: number
  /** Minimum pause between two ReceiveNotification calls, ms. */
  minIntervalMs?: number
  /** Backoff after errors, ms. */
  initialBackoffMs?: number
  maxBackoffMs?: number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done)
  })
}

/**
 * Runs the GREEN-API HTTP API receiving loop:
 *   ReceiveNotification → process → DeleteNotification(receiptId) → repeat.
 *
 * Notifications are FIFO and a notification stays at the head of the queue
 * until it is deleted, so it is deleted only after it was processed. If the
 * delete request fails the same notification is received again; the consumer
 * de-duplicates by idMessage, so it is never shown twice.
 *
 * Returns a stop function that aborts the in-flight request.
 */
export function startNotificationPoller(options: PollerOptions): () => void {
  const {
    client,
    onNotification,
    onStatus,
    receiveTimeout = 20,
    minIntervalMs = 1000,
    initialBackoffMs = 2000,
    maxBackoffMs = 30_000,
    sleep = defaultSleep,
  } = options

  const controller = new AbortController()
  const { signal } = controller

  const loop = async () => {
    let backoff = initialBackoffMs
    let lastStatus: PollerStatus['state'] | null = null

    while (!signal.aborted) {
      const startedAt = Date.now()
      try {
        const notification = await client.receiveNotification(receiveTimeout, signal)
        if (signal.aborted) break
        if (lastStatus !== 'ok') onStatus?.({ state: 'ok' })
        lastStatus = 'ok'
        backoff = initialBackoffMs

        if (notification) {
          try {
            await onNotification(notification.body)
          } catch {
            // A notification that cannot be processed must not block the queue
            // forever. Only a generic warning is logged — never the payload or URL.
            console.warn('Skipping a GREEN-API notification that could not be processed.')
          }
          if (signal.aborted) break // not deleted: it will be received again next time
          await client.deleteNotification(notification.receiptId, signal)
          continue // drain the queue without waiting
        }

        // Empty queue. Long polling normally waits receiveTimeout seconds; keep a
        // small minimum gap in case the server answers immediately.
        const elapsed = Date.now() - startedAt
        if (elapsed < minIntervalMs) await sleep(minIntervalMs - elapsed, signal)
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break
        lastStatus = 'error'
        onStatus?.({ state: 'error', error, retryInMs: backoff })
        await sleep(backoff, signal)
        backoff = Math.min(backoff * 2, maxBackoffMs)
      }
    }
  }

  void loop()
  return () => controller.abort()
}
