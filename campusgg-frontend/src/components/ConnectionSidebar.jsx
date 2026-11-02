import { ChevronLeft, ChevronRight } from 'lucide-react'
import './ConnectionSidebar.css'

export default function ConnectionSidebar({ isOpen, onToggle }) {
  const ToggleIcon = isOpen ? ChevronRight : ChevronLeft
  const action = isOpen ? 'Collapse' : 'Expand'

  return (
    <>
      <button
        className="connection-sidebar-toggle"
        type="button"
        aria-controls="connection-sidebar"
        aria-expanded={isOpen}
        aria-label={`${action} connection sidebar`}
        title={`${action} connection sidebar`}
        onClick={onToggle}
      >
        <ToggleIcon size={18} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <aside
        className="connection-sidebar"
        id="connection-sidebar"
        aria-hidden={!isOpen}
        aria-label="Direct messages"
      >
        <header className="connection-sidebar-header">
          <h2>DMs</h2>
        </header>
      </aside>
    </>
  )
}
