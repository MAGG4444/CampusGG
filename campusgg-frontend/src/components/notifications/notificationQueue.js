export const MAX_VISIBLE_NOTIFICATIONS = 2

export function enqueueNotification(queue, notification) {
  if (notification.type !== 'error' && notification.type !== 'warning') return [...queue, notification]
  // Keep urgent feedback ahead of queued informational messages without discarding it.
  const index = queue.findIndex((item, position) => position >= MAX_VISIBLE_NOTIFICATIONS
    && item.type !== 'error' && item.type !== 'warning')
  if (index === -1) return [...queue, notification]
  return [...queue.slice(0, index), notification, ...queue.slice(index)]
}
