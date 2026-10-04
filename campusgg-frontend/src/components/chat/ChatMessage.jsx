function ChatMessage({ message, currentUserId, senderName }) {
  const sentByCurrentUser = message.senderId === currentUserId
  const authorLabel = sentByCurrentUser ? 'You' : senderName

  return (
    <div
      className={`chat-message ${sentByCurrentUser ? 'chat-message-sent' : 'chat-message-received'}`}
      role="listitem"
    >
      <span className="chat-message-author">{authorLabel}</span>
      <p>{message.text}</p>
      <time>{message.timestamp}</time>
    </div>
  )
}

export default ChatMessage
