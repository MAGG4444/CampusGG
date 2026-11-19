import { useLayoutEffect, useRef } from 'react'

export default function ForumStickyHeader({ children }) {
  const headerRef = useRef(null)
  useLayoutEffect(() => {
    const header = headerRef.current
    const shell = header?.closest('.app-shell')
    if (!header || !shell) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const outer = shell.getBoundingClientRect()
      const inner = header.getBoundingClientRect()
      header.style.setProperty('--forum-background-size', `${outer.width}px ${outer.height}px`)
      header.style.setProperty('--forum-background-position', `${outer.left - inner.left}px ${outer.top - inner.top}px`)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(shell)
    observer?.observe(header)
    return () => { observer?.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame) cancelAnimationFrame(frame) }
  }, [])
  return <div className="forum-sticky-header" ref={headerRef}>{children}</div>
}
