import { useCallback, useMemo, useState } from 'react'
import NotificationContainer from './NotificationContainer.jsx'
import { NotificationContext } from './notificationContext.js'
import { enqueueNotification, MAX_VISIBLE_NOTIFICATIONS } from './notificationQueue.js'
import './Notifications.css'

const defaultDurations = {
  success: 4500,
  info: 5000,
  warning: 6000,
  error: 0,
}

let notificationSequence = 0

function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const dismissNotification = useCallback((notificationId) => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== notificationId),
    )
  }, [])

  const addNotification = useCallback((notification) => {
    const type = notification.type || 'info'
    const id = notification.id || `notification-${Date.now()}-${++notificationSequence}`
    const duration = notification.duration ?? defaultDurations[type] ?? defaultDurations.info

    setNotifications((currentNotifications) => enqueueNotification(
      currentNotifications, { ...notification, id, type, duration },
    ))

    return id
  }, [])

  const value = useMemo(
    () => ({ addNotification, dismissNotification }),
    [addNotification, dismissNotification],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS)}
        onDismiss={dismissNotification}
      />
    </NotificationContext.Provider>
  )
}

export default NotificationProvider
