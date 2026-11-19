import { useEffect, useState } from 'react'
import { request } from '../api/request.js'
import { ForumChannelsContext } from './forumChannelsContext.js'

export default function ForumChannelsProvider({ children }) {
  const [channels, setChannels] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    request('/forum/channels', { signal: controller.signal })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid channel catalog')
        if (!controller.signal.aborted) { setChannels(data); setError('') }
      })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load channels.') })
    return () => controller.abort()
  }, [attempt])
  const retry = () => { setError(''); setChannels(null); setAttempt((value) => value + 1) }
  return <ForumChannelsContext.Provider value={{ channels, error, retry }}>{children}</ForumChannelsContext.Provider>
}
