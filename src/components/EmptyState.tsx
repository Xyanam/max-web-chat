import { ChatBubbleIcon } from './Icons'

export function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <section className="empty-state">
      <div className="empty-state-icon">
        <ChatBubbleIcon width={36} height={36} />
      </div>
      <h2>Выберите чат</h2>
      <p>Выберите переписку слева или начните новую по номеру телефона.</p>
      <button type="button" className="button button-primary" onClick={onNewChat}>
        Новый чат
      </button>
    </section>
  )
}
