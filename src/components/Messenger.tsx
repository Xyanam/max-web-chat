import { useCallback, useMemo, useState } from 'react'
import type { ChatMessage, Credentials, InstanceState } from '../types'
import { useChatStore } from '../hooks/useChatStore'
import { lastMessage, sortedChats } from '../state/chatReducer'
import { ChatView } from './ChatView'
import { EmptyState } from './EmptyState'
import { NewChatDialog } from './NewChatDialog'
import { SettingsDialog } from './SettingsDialog'
import { Sidebar, type ConnectionStatus } from './Sidebar'

interface MessengerProps {
  credentials: Credentials
  remember: boolean
  instanceState: InstanceState | null
  onUpdateCredentials: (credentials: Credentials, remember: boolean) => Promise<void>
  onDisconnect: () => void
}

export function Messenger({ credentials, remember, instanceState, onUpdateCredentials, onDisconnect }: MessengerProps) {
  const [state, dispatch] = useChatStore(credentials.idInstance)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'newChat' | 'settings' | null>(null)
  const connectionStatus: ConnectionStatus = 'online'

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

  const handleCreateChat = async (_phone: string) => {
    throw new Error('Not implemented yet.')
  }

  const handleSend = async (_text: string) => {}
  const handleRetry = (_message: ChatMessage) => {}

  return (
    <div className={`layout${activeChat ? ' has-active-chat' : ''}`}>
      <Sidebar
        chats={chats}
        lastMessages={lastMessages}
        activeChatId={activeChatId}
        connectionStatus={connectionStatus}
        idInstance={credentials.idInstance}
        onSelectChat={openChat}
        onNewChat={() => setDialog('newChat')}
        onOpenSettings={() => setDialog('settings')}
      />
      <main className="main">
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
