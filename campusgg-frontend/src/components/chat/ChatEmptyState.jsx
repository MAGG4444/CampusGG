import { MessagesSquare } from 'lucide-react'

function ChatEmptyState() {
  return (
    <div className="chat-empty-state">
      <span className="chat-empty-icon" aria-hidden="true">
        <MessagesSquare size={34} strokeWidth={1.8} />
      </span>
      <p className="page-kicker">Campus connections</p>
      <h2>Select a conversation</h2>
      <p>Choose a teammate or campus group to view your message history.</p>
    </div>
  )
}

export default ChatEmptyState
