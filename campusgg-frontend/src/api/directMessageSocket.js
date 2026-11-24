import { io } from 'socket.io-client'

export function subscribeDirectMessages(token, onChange, connect = io, config = import.meta.env || {}) {
  if (!token) return () => {}
  const pageOrigin = globalThis.location?.origin || 'http://localhost:5173'
  const apiOrigin = new URL(config.VITE_API_URL || 'http://localhost:3000', pageOrigin).origin
  const origin = new URL(config.VITE_SOCKET_URL || apiOrigin, pageOrigin).origin
  const socket = connect(`${origin}/direct-messages`, {
    path: config.VITE_SOCKET_PATH || '/socket.io',
    auth: { token },
    autoConnect: false,
    reconnection: true,
    timeout: 8000,
  })
  let timer
  function refresh() {
    // Batch bursts so notification delivery cannot repeatedly abort REST reads.
    if (timer !== undefined) return
    timer = setTimeout(() => { timer = undefined; onChange() }, 100)
  }
  socket.on('direct-messages:ready', refresh)
  socket.on('direct-messages:changed', refresh)
  socket.connect()
  return () => {
    clearTimeout(timer)
    socket.off('direct-messages:ready', refresh)
    socket.off('direct-messages:changed', refresh)
    socket.disconnect()
  }
}
