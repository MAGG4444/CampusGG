import { Check } from 'lucide-react'
import ChatAvatar from './ChatAvatar.jsx'

function ConversationItem({ conversation, selected, onSelect }) {
  return (
    <li>
      <button
        className={`conversation-item ${selected ? 'conversation-item-selected' : ''}`}
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(conversation.id)}
      >
        <ChatAvatar
          name={conversation.username}
          avatar={conversation.avatar}
          online={conversation.online}
        />

        <span className="conversation-copy">
          <span className="conversation-name-row">
            <strong>{conversation.username}</strong>
            <time>{conversation.timestamp}</time>
          </span>
          <span className="conversation-preview-row">
            <span className="conversation-preview">{conversation.lastMessage}</span>
            {conversation.unreadCount > 0 ? (
              <span
                className="conversation-unread"
                aria-label={`${conversation.unreadCount} unread messages`}
              >
                {conversation.unreadCount}
              </span>
            ) : null}
          </span>
          {selected ? (
            <span className="conversation-active-label">
              <Check size={12} strokeWidth={2.5} aria-hidden="true" /> Active conversation
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

export default ConversationItem
