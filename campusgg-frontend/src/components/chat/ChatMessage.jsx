function ChatMessage({ message, senderName }) {
  const sentByCurrentUser = message.sender === 'me'

  return (
    <div className={`chat-message ${sentByCurrentUser ? 'chat-message-sent' : 'chat-message-received'}`}>
      <p>{message.text}</p>
      <time>{message.timestamp}</time>
      <span className="sr-only">{sentByCurrentUser ? 'Sent by you' : `Sent by ${senderName}`}</span>
    </div>
  )
}

export default ChatMessage
