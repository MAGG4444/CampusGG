import { ArrowLeft } from 'lucide-react'
import ChatAvatar from './ChatAvatar.jsx'

function ChatHeader({ conversation, onBack }) {
  return (
    <header className="active-chat-header">
      <button className="chat-mobile-back" type="button" onClick={onBack} aria-label="Back to conversations">
        <ArrowLeft size={20} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <ChatAvatar
        name={conversation.username}
        avatar={conversation.avatar}
        online={conversation.online}
        size="large"
      />
      <div className="active-chat-identity">
        <h2 id="active-conversation-title">{conversation.username}</h2>
        <p>
          <span className={`status-dot ${conversation.online ? 'status-dot-online' : ''}`} aria-hidden="true" />
          {conversation.online ? 'Online' : 'Offline'} <span aria-hidden="true">·</span> {conversation.handle}
        </p>
      </div>
    </header>
  )
}

export default ChatHeader
