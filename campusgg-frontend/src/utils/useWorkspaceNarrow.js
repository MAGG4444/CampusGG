import { useLayoutEffect, useRef, useState } from 'react'

export function useWorkspaceNarrow() {
  const ref = useRef(null)
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const workspace = ref.current
    if (!workspace || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(entries => setNarrow(entries[0].contentRect.width <= 700))
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [])
  return [ref, narrow]
}
