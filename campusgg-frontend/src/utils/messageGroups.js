const MAX_GAP_MS = 5 * 60 * 1000

function messageTime(message) {
  const value = message.createdAt ?? message.sentAt
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return null
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? null : time
}

function joinsPrevious(previous, current, firstUnreadId) {
  if (!previous || current.id === firstUnreadId || previous.senderId == null || previous.senderId !== current.senderId) return false
  const before = messageTime(previous)
  const after = messageTime(current)
  if (!before || !after) return false
  const gap = after.getTime() - before.getTime()
  return gap >= 0 && gap <= MAX_GAP_MS && before.getFullYear() === after.getFullYear() && before.getMonth() === after.getMonth() && before.getDate() === after.getDate()
}

export function messageGroupPositions(messages, firstUnreadId) {
  const starts = messages.map((message, index) => !joinsPrevious(messages[index - 1], message, firstUnreadId))
  return messages.map((message, index) => ({ id: message.id, startsGroup: starts[index], endsGroup: index === messages.length - 1 || starts[index + 1] }))
}
