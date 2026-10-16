import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage, Credentials, InstanceState } from '../types'
import { GreenApiClient, GreenApiError, isAbortError } from '../api/greenApi'
import { parseNotification } from '../api/notifications'
import { startNotificationPoller, type PollerStatus } from '../api/notificationPoller'
import { useChatStore } from '../hooks/useChatStore'
import { useContactInfo } from '../hooks/useContactInfo'
import { lastMessage, sortedChats } from '../state/chatReducer'
import { formatPhone } from '../lib/phone'
import { localId } from '../lib/id'
import { instanceStateHint, instanceStateLabel } from '../lib/instanceState'
import { enableNotificationsBody, missingNotifications, type RequiredNotification } from '../lib/notificationSettings'
import { ChatView } from './ChatView'
import { EmptyState } from './EmptyState'
import { NotificationSettingsBanner } from './NotificationSettingsBanner'
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
  const { state, dispatch, getState } = useChatStore(credentials.idInstance)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'newChat' | 'settings' | null>(null)
  const [instanceState, setInstanceState] = useState<InstanceState | null>(initialInstanceState)
  const [stateError, setStateError] = useState<string | null>(null)
  const [pollStatus, setPollStatus] = useState<PollerStatus | null>(null)

  const activeChatIdRef = useRef(activeChatId)
  useEffect(() => {
    activeChatIdRef.current = activeChatId
  })

  // Receive incoming messages and delivery statuses via the HTTP API queue.
  // The poller is stopped (and its in-flight request aborted) on unmount, i.e.
  // when the user disconnects or replaces credentials.
  useEffect(() => {
    const handleNotification = (body: unknown) => {
      const n = parseNotification(body)
      if (n.type === 'message') {
        const isActive = activeChatIdRef.current === n.chatId && document.visibilityState === 'visible'
        dispatch({
          type: 'addMessage',
          isActive,
          meta: { title: n.chatTitle, phone: n.phone },
          message: {
            id: n.idMessage,
            idMessage: n.idMessage,
            chatId: n.chatId,
            direction: n.direction,
            kind: n.kind,
            text: n.text,
            messageType: n.kind === 'unsupported' ? n.messageType : undefined,
            timestamp: n.timestamp,
            status: n.direction === 'outgoing' ? 'sent' : undefined,
          },
        })
      } else if (n.type === 'status') {
        dispatch({ type: 'applyStatus', chatId: n.chatId, idMessage: n.idMessage, status: n.status, error: n.description })
      }
    }
    return startNotificationPoller({ client, onNotification: handleNotification, onStatus: setPollStatus })
  }, [client, dispatch])

  // Clear the unread counter when the user returns to the tab with an open chat.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && activeChatIdRef.current) {
        dispatch({ type: 'markRead', chatId: activeChatIdRef.current })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [dispatch])

  // Notification types disabled on the instance never reach the queue, so warn about them.
  const [missingSettings, setMissingSettings] = useState<RequiredNotification[]>([])
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    client
      .getSettings(controller.signal)
      .then((settings) => setMissingSettings(missingNotifications(settings)))
      .catch(() => {
        // Not critical: the chat works without this check.
      })
    return () => controller.abort()
  }, [client])

  const enableNotifications = async () => {
    try {
      await client.setSettings(enableNotificationsBody(missingSettings))
    } catch (err) {
      throw new Error(errorMessage(err, 'Не удалось сохранить настройки.'))
    }
    setMissingSettings([])
    setSettingsSaved(true)
  }

  // Periodically re-check the instance state so the UI reflects authorization changes.
  useEffect(() => {
    const controller = new AbortController()
    const check = async () => {
      try {
        setInstanceState(await client.getStateInstance(controller.signal))
        setStateError(null)
      } catch (err) {
        if (!isAbortError(err)) setStateError(errorMessage(err, 'Нет связи с GREEN-API.'))
      }
    }
    if (!initialInstanceState) void check()
    const timer = window.setInterval(check, STATE_CHECK_INTERVAL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [client, initialInstanceState])

  const pollError =
    pollStatus?.state === 'error'
      ? `Не удалось получить сообщения: ${errorMessage(pollStatus.error, 'неизвестная ошибка.')} Повтор через ${Math.round(pollStatus.retryInMs / 1000)} с.`
      : null
  const connectionStatus: ConnectionStatus =
    stateError || pollError ? 'error' : instanceState && pollStatus?.state === 'ok' ? 'online' : 'connecting'
  const connectionMessage =
    pollError ?? stateError ?? (instanceState ? `Инстанс ${credentials.idInstance} · ${instanceStateLabel(instanceState)}` : undefined)

  const chats = useMemo(() => sortedChats(state), [state])
  const lastMessages = useMemo(
    () => Object.fromEntries(chats.map((c) => [c.chatId, lastMessage(state, c.chatId)])),
    [chats, state],
  )
  const activeChat = activeChatId ? state.chats[activeChatId] : undefined

  useContactInfo(
    client,
    chats.map((c) => c.chatId),
    (chatId, info) => dispatch({ type: 'updateContact', chatId, ...info }),
  )

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
      throw new Error(errorMessage(err, 'Не удалось проверить номер телефона.'))
    }
    if (!result.exist || !result.chatId) {
      throw new Error(`Номер ${formatPhone(phone)} не зарегистрирован в MAX.`)
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
        patch: { status: 'failed', error: errorMessage(err, 'Сообщение не отправлено.') },
      })
    }
  }

  const handleSend = async (text: string) => {
    if (activeChat) await sendText(activeChat.chatId, text)
  }

  const handleRetry = (message: ChatMessage) => {
    const current = getState().messages[message.chatId]?.find((m) => m.id === message.id)
    if (current?.status !== 'failed') return
    void sendText(message.chatId, message.text, current)
  }


  const hasNotices = missingSettings.length > 0 || settingsSaved || (instanceState !== null && instanceState !== 'authorized')
  const notices = hasNotices ? (
    <div className="notices">
      {missingSettings.length > 0 && (
        <NotificationSettingsBanner missing={missingSettings} onEnable={enableNotifications} />
      )}
      {settingsSaved && (
        <div className="banner banner-info" role="status">
          Настройки сохранены. Инстанс перезапускается, уведомления начнут приходить в течение 5 минут.
        </div>
      )}
      {instanceState && instanceState !== 'authorized' && (
        <div className="banner" role="status">
          {instanceStateHint(instanceState)}
        </div>
      )}
    </div>
  ) : null

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
        notices={notices}
      />
      <main className="main">
        {activeChat ? (
          <ChatView
            key={activeChat.chatId}
            chat={activeChat}
            messages={state.messages[activeChat.chatId] ?? []}
            onBack={() => setActiveChatId(null)}
            onSend={handleSend}
            onRetry={handleRetry}
            notices={notices}
          />
        ) : (
          <>
            {notices}
            <EmptyState onNewChat={() => setDialog('newChat')} />
          </>
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
