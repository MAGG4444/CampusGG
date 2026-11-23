function ChatAvatar({ name, avatar, online, size = 'medium' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()

  return (
    <span className={`chat-avatar chat-avatar-${size}`} aria-hidden="true">
      {avatar ? <img src={avatar} alt="" /> : initials}
      {typeof online === 'boolean' && <span className={online ? 'chat-presence chat-presence-online' : 'chat-presence'} />}
    </span>
  )
}

export default ChatAvatar
