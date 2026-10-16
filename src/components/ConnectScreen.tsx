import type { Credentials } from '../types'
import { ConnectForm } from './ConnectForm'
import { Logo } from './Icons'

interface ConnectScreenProps {
  initial?: Credentials | null
  initialRemember?: boolean
  onConnect: (credentials: Credentials, remember: boolean) => Promise<void>
}

export function ConnectScreen({ initial, initialRemember, onConnect }: ConnectScreenProps) {
  return (
    <main className="connect-screen">
      <div className="connect-card">
        <div className="connect-brand">
          <Logo size={56} />
          <h1>MAX Web Chat</h1>
          <p>Connect your GREEN-API instance for MAX to send and receive messages.</p>
        </div>
        <ConnectForm initial={initial} initialRemember={initialRemember} submitLabel="Connect" onSubmit={onConnect} />
        <p className="connect-footnote">
          Find <code>idInstance</code>, <code>apiTokenInstance</code> and the API URL in the{' '}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            GREEN-API console
          </a>
          . Credentials are sent only to GREEN-API.
        </p>
      </div>
    </main>
  )
}
