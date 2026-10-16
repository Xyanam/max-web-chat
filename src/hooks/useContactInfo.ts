import { useEffect, useRef } from 'react'
import { isAbortError, type ContactInfo, type GreenApiClient } from '../api/greenApi'

/** GetContactInfo allows 10 requests per second per instance; stay well below it. */
const REQUEST_GAP_MS = 250

function sleep(ms: number, signal: AbortSignal): Promise<void> {
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
 * Loads the name and avatar of every chat once per session, one request at a
 * time. Avatar links may expire, so they are refreshed on every connect rather
 * than trusted from storage. Failures are ignored: the chat keeps its current
 * title and shows initials.
 */
export function useContactInfo(
  client: Pick<GreenApiClient, 'getContactInfo'>,
  chatIds: string[],
  onInfo: (chatId: string, info: ContactInfo) => void,
) {
  const requestedRef = useRef(new Set<string>())
  const onInfoRef = useRef(onInfo)
  useEffect(() => {
    onInfoRef.current = onInfo
  })

  // Sorted so that reordering the chat list does not restart the queue.
  const idsKey = [...chatIds].sort().join('\n')

  useEffect(() => {
    const requested = requestedRef.current
    const pending = idsKey ? idsKey.split('\n').filter((id) => !requested.has(id)) : []
    if (!pending.length) return

    pending.forEach((id) => requested.add(id))
    const finished = new Set<string>()
    const controller = new AbortController()
    const { signal } = controller

    const run = async () => {
      for (const chatId of pending) {
        if (signal.aborted) return
        try {
          const info = await client.getContactInfo(chatId, signal)
          if (signal.aborted) return
          onInfoRef.current(chatId, info)
        } catch (err) {
          if (signal.aborted || isAbortError(err)) return
        }
        finished.add(chatId)
        await sleep(REQUEST_GAP_MS, signal)
      }
    }
    void run()

    return () => {
      controller.abort()
      // Requests that never completed are retried by the next run.
      pending.forEach((id) => {
        if (!finished.has(id)) requested.delete(id)
      })
    }
  }, [client, idsKey])
}
