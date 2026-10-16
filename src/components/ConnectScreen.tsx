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
          <h1>Веб-чат MAX</h1>
          <p>Подключите инстанс GREEN-API для MAX, чтобы отправлять и получать сообщения.</p>
        </div>
        <ConnectForm initial={initial} initialRemember={initialRemember} submitLabel="Подключиться" onSubmit={onConnect} />
        <p className="connect-footnote">
          <code>idInstance</code>, <code>apiTokenInstance</code> и адрес API указаны в{' '}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            консоли GREEN-API
          </a>
          . Данные для входа передаются только в GREEN-API.
        </p>
      </div>
    </main>
  )
}
