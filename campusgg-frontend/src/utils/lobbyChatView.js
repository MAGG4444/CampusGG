export const NEAR_BOTTOM_PX = 64
export const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000

export function isNearBottom(element) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_PX
}

export function newMessageIds(previousIds, messages) {
  return [...new Set(messages.filter((message) => !previousIds.has(message.id)).map((message) => message.id))]
}

export function uniqueMessages(messages) {
  const seen = new Set()
  return messages.filter((message) => {
    if (seen.has(message.id)) return false
    seen.add(message.id)
    return true
  })
}

export function isGroupedMessage(previous, current) {
  if (!previous || previous.sender.id !== current.sender.id) return false
  const difference = Date.parse(current.createdAt) - Date.parse(previous.createdAt)
  return Number.isFinite(difference) && difference >= 0 && difference <= MESSAGE_GROUP_WINDOW_MS
}

export function shouldSendOnKey(event) {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229
}
