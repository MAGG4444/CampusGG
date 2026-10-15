import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from 'lucide-react'

const defaultIcons = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: CircleAlert,
}

function NotificationToast({ notification, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false)
  const exitTimerRef = useRef(null)
  const Icon = notification.icon || defaultIcons[notification.type] || Info

  const beginDismiss = useCallback(() => {
    if (isExiting) return

    setIsExiting(true)
    exitTimerRef.current = window.setTimeout(() => onDismiss(notification.id), 180)
  }, [isExiting, notification.id, onDismiss])

  useEffect(() => {
    if (!notification.duration || isExiting) return undefined

    const autoDismissTimer = window.setTimeout(beginDismiss, notification.duration)
    return () => window.clearTimeout(autoDismissTimer)
  }, [beginDismiss, isExiting, notification.duration])

  useEffect(
    () => () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    },
    [],
  )

  return (
    <section
      className={`notification-toast notification-toast-${notification.type} ${isExiting ? 'notification-toast-exiting' : ''}`}
      role={notification.type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <span className="notification-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.1} />
      </span>
      <div className="notification-copy">
        <span className="notification-type">{notification.type}</span>
        <h2>{notification.title}</h2>
        {notification.message ? <p>{notification.message}</p> : null}
      </div>
      <button
        className="notification-dismiss"
        type="button"
        aria-label={`Dismiss ${notification.title} notification`}
        onClick={beginDismiss}
      >
        <X size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </section>
  )
}

export default NotificationToast
