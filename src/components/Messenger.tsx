import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage, Credentials, InstanceState } from '../types'
import { GreenApiClient, GreenApiError, isAbortError } from '../api/greenApi'
import { useChatStore } from '../hooks/useChatStore'
import { lastMessage, sortedChats } from '../state/chatReducer'
import { formatPhone } from '../lib/phone'
import { localId } from '../lib/id'
import { ChatView } from './ChatView'
import { EmptyState } from './EmptyState'
import { NewChatDialog } from './NewChatDialog'
import { SettingsDialog } from './SettingsDialog'
import { Sidebar, type ConnectionStatus } from './Sidebar'

interface MessengerProps {
  credentials: Credentials
  remember: boolean
  initialInstanceState: InstanceState | null
  onUpdateCredentials: (credentials: Credentials, remember: boolean) => Promise<void>
  onDisconnect: () => void
}

const STATE_CHECK_INTERVAL_MS = 60_000

const instanceStateHints: Record<string, string> = {
  notAuthorized: 'The instance is not authorized in MAX. Link your MAX account in the GREEN-API console.',
  blocked: 'The MAX account of this instance is blocked.',
  starting: 'The instance is starting. This can take up to 5 minutes.',
  suspended: 'The MAX account is suspended: messages can be sent only to contacts who saved your number.',
  pendingPassword: 'MAX requires the two-factor password. Finish authorization in the GREEN-API console.',
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof GreenApiError ? err.message : fallback
}

export function Messenger({
  credentials,
  remember,
  initialInstanceState,
  onUpdateCredentials,
  onDisconnect,
}: MessengerProps) {
  const client = useMemo(() => new GreenApiClient(credentials), [credentials])
  const [state, dispatch] = useChatStore(credentials.idInstance)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'newChat' | 'settings' | null>(null)
  const [instanceState, setInstanceState] = useState<InstanceState | null>(initialInstanceState)
  const [stateError, setStateError] = useState<string | null>(null)

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  // Periodically re-check the instance state so the UI reflects authorization changes.
  useEffect(() => {
    const controller = new AbortController()
    const check = async () => {
      try {
        setInstanceState(await client.getStateInstance(controller.signal))
        setStateError(null)
      } catch (err) {
        if (!isAbortError(err)) setStateError(errorMessage(err, 'Could not reach GREEN-API.'))
      }
    }
    if (!initialInstanceState) void check()
    const timer = window.setInterval(check, STATE_CHECK_INTERVAL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [client, initialInstanceState])

  const connectionStatus: ConnectionStatus = stateError ? 'error' : instanceState ? 'online' : 'connecting'
  const connectionMessage = stateError ?? (instanceState ? `Instance ${credentials.idInstance} · ${instanceState}` : undefined)

  const chats = useMemo(() => sortedChats(state), [state])
  const lastMessages = useMemo(
    () => Object.fromEntries(chats.map((c) => [c.chatId, lastMessage(state, c.chatId)])),
    [chats, state],
  )
  const activeChat = activeChatId ? state.chats[activeChatId] : undefined

  const openChat = useCallback(
    (chatId: string) => {
      setActiveChatId(chatId)
      dispatch({ type: 'openChat', chatId })
    },
    [dispatch],
  )

  const closeDialog = useCallback(() => setDialog(null), [])

  const handleCreateChat = async (phone: string) => {
    let result
    try {
      result = await client.checkAccount(phone)
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not check the phone number.'))
    }
    if (!result.exist || !result.chatId) {
      throw new Error(`${formatPhone(phone)} is not registered in MAX.`)
    }
    dispatch({ type: 'openChat', chatId: result.chatId, meta: { title: formatPhone(phone), phone } })
    setActiveChatId(result.chatId)
    setDialog(null)
  }

  const sendText = async (chatId: string, text: string, retryOf?: ChatMessage) => {
    const id = retryOf?.id ?? localId()
    if (retryOf) {
      dispatch({ type: 'updateMessage', chatId, id, patch: { status: 'sending', error: undefined } })
    } else {
      dispatch({
        type: 'addMessage',
        isActive: true,
        message: { id, chatId, direction: 'outgoing', kind: 'text', text, timestamp: Date.now(), status: 'sending' },
      })
    }
    try {
      const { idMessage } = await client.sendMessage(chatId, text)
      dispatch({ type: 'updateMessage', chatId, id, patch: { idMessage, status: 'sent' } })
    } catch (err) {
      dispatch({
        type: 'updateMessage',
        chatId,
        id,
        patch: { status: 'failed', error: errorMessage(err, 'Message was not sent.') },
      })
    }
  }

  const handleSend = async (text: string) => {
    if (activeChat) await sendText(activeChat.chatId, text)
  }

  const handleRetry = (message: ChatMessage) => {
    const current = stateRef.current.messages[message.chatId]?.find((m) => m.id === message.id)
    if (current?.status !== 'failed') return
    void sendText(message.chatId, message.text, current)
  }

  const stateHint = instanceState && instanceState !== 'authorized' ? instanceStateHints[instanceState] : undefined

  return (
    <div className={`layout${activeChat ? ' has-active-chat' : ''}`}>
      <Sidebar
        chats={chats}
        lastMessages={lastMessages}
        activeChatId={activeChatId}
        connectionStatus={connectionStatus}
        connectionMessage={connectionMessage}
        idInstance={credentials.idInstance}
        onSelectChat={openChat}
        onNewChat={() => setDialog('newChat')}
        onOpenSettings={() => setDialog('settings')}
      />
      <main className="main">
        {instanceState && instanceState !== 'authorized' && (
          <div className="banner" role="status">
            {stateHint ?? `Instance state: ${instanceState}`}
          </div>
        )}
        {activeChat ? (
          <ChatView
            chat={activeChat}
            messages={state.messages[activeChat.chatId] ?? []}
            onBack={() => setActiveChatId(null)}
            onSend={handleSend}
            onRetry={handleRetry}
          />
        ) : (
          <EmptyState onNewChat={() => setDialog('newChat')} />
        )}
      </main>

      {dialog === 'newChat' && <NewChatDialog onClose={closeDialog} onCreate={handleCreateChat} />}
      {dialog === 'settings' && (
        <SettingsDialog
          credentials={credentials}
          remember={remember}
          instanceState={instanceState}
          onClose={closeDialog}
          onSave={onUpdateCredentials}
          onDisconnect={onDisconnect}
        />
      )}
    </div>
  )
}
