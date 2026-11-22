import { MessageCircle } from 'lucide-react'
import ConversationItem from './ConversationItem.jsx'

function ConversationList({ conversations, selectedId, onSelect, hasSearchQuery }) {
  if (conversations.length === 0) {
    return (
      <div className="conversation-list-empty" role="status">
        <MessageCircle size={28} strokeWidth={1.8} aria-hidden="true" />
        <strong>{hasSearchQuery ? 'No conversations found' : 'No conversations yet'}</strong>
        <span>{hasSearchQuery ? 'Try another player name.' : 'Direct messaging is not available yet.'}</span>
      </div>
    )
  }

  return (
    <ul className="conversation-list" aria-label="Conversations">
      {conversations.map((conversation) => (
        <ConversationItem
          conversation={conversation}
          key={conversation.id}
          selected={selectedId === conversation.id}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

export default ConversationList
