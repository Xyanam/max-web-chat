import { useState } from 'react'
import type { Credentials } from './types'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/storage'
import { ConnectScreen } from './components/ConnectScreen'
import { Messenger } from './components/Messenger'

interface Session {
  credentials: Credentials
  remember: boolean
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadCredentials())

  const connect = async (credentials: Credentials, remember: boolean) => {
    saveCredentials(credentials, remember)
    setSession({ credentials, remember })
  }

  const disconnect = () => {
    clearCredentials()
    setSession(null)
  }

  if (!session) return <ConnectScreen onConnect={connect} />

  return (
    <Messenger
      key={session.credentials.idInstance}
      credentials={session.credentials}
      remember={session.remember}
      instanceState={null}
      onUpdateCredentials={connect}
      onDisconnect={disconnect}
    />
  )
}
