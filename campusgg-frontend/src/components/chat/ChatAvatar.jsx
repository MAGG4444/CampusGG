function ChatAvatar({ name, avatar, online = false, size = 'medium' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()

  return (
    <span className={`chat-avatar chat-avatar-${size}`} aria-hidden="true">
      {avatar ? <img src={avatar} alt="" /> : initials}
      <span className={`chat-presence ${online ? 'chat-presence-online' : ''}`} />
    </span>
  )
}

export default ChatAvatar
