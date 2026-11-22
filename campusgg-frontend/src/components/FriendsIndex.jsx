import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { groupFriends } from '../utils/friendGroups.js'

const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

export default function FriendsIndex({ people, renderFriend, emptyMessage = 'No friends yet.' }) {
  const groups = useMemo(() => groupFriends(people), [people])
  const listRef = useRef(null)
  const indexRef = useRef(null)
  const sectionRefs = useRef(new Map())
  const [active, setActive] = useState(null)
  const activeRef = useRef(null)
  const wheelTimeRef = useRef(0)

  function setCurrent(letter) { activeRef.current = letter; setActive(letter) }
  const jump = useCallback((letter) => {
    const list = listRef.current
    const section = sectionRefs.current.get(letter)
    if (!list || !section) return
    setCurrent(letter)
    const top = section.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
    list.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [])

  useEffect(() => {
    const index = indexRef.current
    if (!index) return undefined
    const wheel = event => {
      const letters = groups.map(([letter]) => letter)
      if (!letters.length || !event.deltaY) return
      event.preventDefault()
      if (Date.now() - wheelTimeRef.current < 150) return
      wheelTimeRef.current = Date.now()
      const position = Math.max(0, letters.indexOf(activeRef.current))
      const next = Math.max(0, Math.min(letters.length - 1, position + (event.deltaY > 0 ? 1 : -1)))
      if (letters[next] !== activeRef.current) jump(letters[next])
    }
    index.addEventListener('wheel', wheel, { passive: false })
    return () => index.removeEventListener('wheel', wheel)
  }, [groups, jump])

  function handleScroll() {
    const list = listRef.current
    if (!list || !groups.length) return
    if (list.scrollHeight > list.clientHeight && list.scrollTop + list.clientHeight >= list.scrollHeight - 1) {
      setCurrent(groups.at(-1)[0]); return
    }
    let visible = groups[0][0]
    for (const [letter] of groups) {
      const section = sectionRefs.current.get(letter)
      if (section && section.getBoundingClientRect().top <= list.getBoundingClientRect().top + 2) visible = letter
    }
    setCurrent(visible)
  }

  const available = new Set(groups.map(([letter]) => letter))
  const current = available.has(active) ? active : groups[0]?.[0]
  return <div className="friends-index-layout">
    <div className="friends-index-list" ref={listRef} onScroll={handleScroll} aria-label="Friends list">
      {groups.length ? groups.map(([letter, members]) => <section className="friends-index-group" key={letter} ref={node => { if (node) sectionRefs.current.set(letter, node); else sectionRefs.current.delete(letter) }}><h3>{letter}</h3><ul className="connection-people">{members.map(renderFriend)}</ul></section>) : <p className="friends-index-empty" role="status">{emptyMessage}</p>}
    </div>
    <nav className="friends-index-nav" ref={indexRef} aria-label="Jump to friends by letter">
      {alphabet.map(letter => <button key={letter} type="button" aria-label={`Jump to ${letter}`} aria-disabled={!available.has(letter)} aria-current={current === letter ? 'true' : undefined} onPointerEnter={event => { if (event.pointerType === 'mouse' && available.has(letter)) jump(letter) }} onClick={() => { if (available.has(letter)) jump(letter) }}>{letter}</button>)}
    </nav>
  </div>
}
