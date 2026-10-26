import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ContentCreateAction({ tab, returnTo }) {
  const [open, setOpen] = useState(false)
  const container = useRef(null)
  const trigger = useRef(null)
  const dropdownId = useId()

  useEffect(() => {
    if (!open) return
    container.current.querySelector('nav a')?.focus()
    function outside(event) {
      if (!container.current?.contains(event.target)) setOpen(false)
    }
    function escape(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  if (tab !== 'drafts') return (
    <Link className="my-content-button my-content-create" to={tab === 'posts' ? '/create-post' : '/create-lobby'} state={{ from: returnTo }}>
      <Plus size={18} aria-hidden="true" />{tab === 'posts' ? 'New Post' : 'New Lobby'}
    </Link>
  )

  function moveFocus(event) {
    const links = [...container.current.querySelectorAll('nav a')]
    const index = links.indexOf(document.activeElement)
    let next
    if (event.key === 'ArrowDown') next = (index + 1) % links.length
    else if (event.key === 'ArrowUp') next = (index - 1 + links.length) % links.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = links.length - 1
    else return
    event.preventDefault()
    links[next]?.focus()
  }

  return (
    <div className="my-content-create-dropdown" ref={container} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button className="my-content-button my-content-create" type="button" ref={trigger}
        aria-expanded={open} aria-controls={dropdownId} onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (open) container.current.querySelector('nav a')?.focus()
            else setOpen(true)
          }
        }}>
        <Plus size={18} aria-hidden="true" />New<ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && <nav id={dropdownId} className="my-content-create-menu" aria-label="Create content" onKeyDown={moveFocus}>
        <Link to="/create-lobby" state={{ from: returnTo }}>New Lobby</Link>
        <Link to="/create-post" state={{ from: returnTo }}>New Post</Link>
      </nav>}
    </div>
  )
}
