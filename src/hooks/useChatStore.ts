import { useCallback, useRef, useState } from 'react'
import { chatReducer, type ChatAction, type ChatState } from '../state/chatReducer'
import { loadChatState, saveChatState } from '../lib/storage'

/**
 * Chat history for one GREEN-API instance, persisted to localStorage.
 *
 * dispatch() applies the reducer and saves synchronously, so once it returns
 * the change is durable. The notification poller relies on this: it deletes a
 * notification from the GREEN-API queue only after the message is stored.
 *
 * The owning component is keyed per session, so switching instances remounts
 * it and the history of one instance never leaks into another.
 */
export function useChatStore(idInstance: string) {
  const [state, setState] = useState<ChatState>(() => loadChatState(idInstance))
  const stateRef = useRef(state)

  const dispatch = useCallback(
    (action: ChatAction) => {
      const next = chatReducer(stateRef.current, action)
      if (next === stateRef.current) return
      stateRef.current = next
      saveChatState(idInstance, next)
      setState(next)
    },
    [idInstance],
  )

  const getState = useCallback(() => stateRef.current, [])

  return { state, dispatch, getState }
}
