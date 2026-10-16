import { useEffect, useReducer } from 'react'
import { chatReducer } from '../state/chatReducer'
import { loadChatState, saveChatState } from '../lib/storage'

/**
 * Chat history for one GREEN-API instance, persisted to localStorage.
 * The owning component is keyed by idInstance, so switching instances remounts
 * it and the history of one instance never leaks into another.
 */
export function useChatStore(idInstance: string) {
  const [state, dispatch] = useReducer(chatReducer, idInstance, loadChatState)

  useEffect(() => {
    saveChatState(idInstance, state)
  }, [idInstance, state])

  return [state, dispatch] as const
}
