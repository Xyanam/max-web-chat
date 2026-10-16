import { useState } from 'react'
import type { Credentials, InstanceState } from './types'
import { GreenApiClient } from './api/greenApi'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/storage'
import { ConnectScreen } from './components/ConnectScreen'
import { Messenger } from './components/Messenger'

interface Session {
  credentials: Credentials
  remember: boolean
  /** Known right after connecting; null when restored from storage (checked in Messenger). */
  instanceState: InstanceState | null
  /** Changes on every (re)connect so Messenger remounts and stops polling for old credentials. */
  id: number
}

function restoreSession(): Session | null {
  const saved = loadCredentials()
  return saved ? { ...saved, instanceState: null, id: 0 } : null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(restoreSession)

  /** Verifies credentials with GetStateInstance before saving them. */
  const connect = async (credentials: Credentials, remember: boolean) => {
    const instanceState = await new GreenApiClient(credentials).getStateInstance()
    saveCredentials(credentials, remember)
    setSession((prev) => ({ credentials, remember, instanceState, id: (prev?.id ?? 0) + 1 }))
  }

  const disconnect = () => {
    clearCredentials()
    setSession(null)
  }

  if (!session) return <ConnectScreen onConnect={connect} />

  const { credentials } = session
  return (
    <Messenger
      key={session.id}
      credentials={credentials}
      remember={session.remember}
      initialInstanceState={session.instanceState}
      onUpdateCredentials={connect}
      onDisconnect={disconnect}
    />
  )
}
