import NotificationToast from './NotificationToast.jsx'

function NotificationContainer({ notifications, onDismiss }) {
  if (notifications.length === 0) return null

  return (
    <aside className="notification-viewport" aria-label="Notifications">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </aside>
  )
}

export default NotificationContainer
