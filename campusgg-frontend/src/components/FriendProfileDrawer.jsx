import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import ChatAvatar from './chat/ChatAvatar.jsx'

export default function FriendProfileDrawer({ open, person, onClose, onRemove, returnFocusRef, narrow }) {
  const closeRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const handleKey = event => { if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) { event.preventDefault(); onClose(); requestAnimationFrame(() => returnFocusRef.current?.focus()) } }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, returnFocusRef, narrow])
  function close() { onClose(); requestAnimationFrame(() => returnFocusRef.current?.focus()) }
  return <aside id="connection-profile-drawer" className="friend-profile-drawer" aria-labelledby="friend-profile-title" aria-hidden={!open} inert={!open}>
    <header className="friend-profile-header"><h2 id="friend-profile-title">Friend Profile</h2><button ref={closeRef} type="button" className="connection-icon-button" aria-label="Close friend profile" onClick={close}><X size={20} aria-hidden="true" /></button></header>
    <div className="friend-profile-content">
      <ChatAvatar name={person.name} avatar={person.avatar} online={person.online} size="profile" />
      <h3>{person.name}</h3>{person.username && <p className="friend-profile-handle">@{person.username.replace(/^@/, '')}</p>}
      {typeof person.online === 'boolean' && <p className="friend-profile-status">{person.online ? 'Online' : 'Offline'}</p>}
      {person.bio && <section><h4>About</h4><p>{person.bio}</p></section>}
      {(Array.isArray(person.game) ? person.game.length > 0 : Boolean(person.game)) && <section><h4>Favorite Games</h4><p>{Array.isArray(person.game) ? person.game.join(', ') : person.game}</p></section>}
      {person.sharedLobby && <section><h4>Shared Lobbies</h4><p>{person.sharedLobby}</p></section>}
      {onRemove && <div className="connection-actions"><button type="button" onClick={onRemove}>Remove Friend</button></div>}
    </div>
  </aside>
}
