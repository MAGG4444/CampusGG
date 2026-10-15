import { CheckCircle2, Clock3, UserRoundPlus } from 'lucide-react'
import ChatAvatar from './ChatAvatar.jsx'

const connectionIcons = {
  Connected: CheckCircle2,
  Pending: Clock3,
  'Not connected': UserRoundPlus,
}

function ChatUserSummary({ conversation, onConnectionFeedback }) {
  const details = conversation.details
  const ConnectionIcon = connectionIcons[details?.connectionStatus] || UserRoundPlus

  return (
    <div className="chat-user-summary">
      <ChatAvatar
        name={conversation.username}
        avatar={conversation.avatar}
        online={conversation.online}
        size="profile"
      />
      <h3>{conversation.username}</h3>
      <p className="chat-user-handle">{conversation.handle}</p>
      <p className="chat-user-presence">
        <span className={`status-dot ${conversation.online ? 'status-dot-online' : ''}`} aria-hidden="true" />
        {conversation.online ? 'Online now' : 'Currently offline'}
      </p>
      {details?.connectionStatus ? (
        <button
          className="chat-connection-status"
          type="button"
          data-status={details.connectionStatus.toLowerCase().replace(' ', '-')}
          aria-label={`Connection status: ${details.connectionStatus}. Show connection feedback`}
          onClick={() => onConnectionFeedback(conversation)}
        >
          <ConnectionIcon size={15} strokeWidth={2.2} aria-hidden="true" />
          {details.connectionStatus}
        </button>
      ) : null}
    </div>
  )
}

export default ChatUserSummary
