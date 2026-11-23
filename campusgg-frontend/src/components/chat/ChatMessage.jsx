function ChatMessage({ message, currentUserId, senderName, showTimestamp = true }) {
  const sentByCurrentUser = message.senderId === currentUserId
  return (
    <div
      className={`chat-message ${sentByCurrentUser ? 'chat-message-sent' : 'chat-message-received'}`}
      role="listitem"
      aria-label={sentByCurrentUser ? 'Message from you' : `Message from ${senderName}`}
    >
      <p className="chat-message-bubble">{message.text}</p>
      {showTimestamp && <time dateTime={message.createdAt || message.sentAt}>{message.timestamp}</time>}
    </div>
  )
}

export default ChatMessage
