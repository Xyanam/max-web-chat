import { ChatBubbleIcon } from './Icons'

export function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <section className="empty-state">
      <div className="empty-state-icon">
        <ChatBubbleIcon width={36} height={36} />
      </div>
      <h2>Select a chat</h2>
      <p>Choose a conversation on the left or start a new one by phone number.</p>
      <button type="button" className="button button-primary" onClick={onNewChat}>
        New chat
      </button>
    </section>
  )
}
