import { FolderOpen, Gamepad2, GraduationCap, Info, MapPin, X } from 'lucide-react'
import ChatInfoSection from './ChatInfoSection.jsx'
import ChatUserSummary from './ChatUserSummary.jsx'

function ChatDetailsPanel({ conversation, onClose, onConnectionFeedback, panelRef }) {
  const details = conversation.details

  function handleKeyDown(event) {
    if (event.key === 'Escape') onClose()
  }

  return (
    <aside
      className="chat-details-panel"
      id="chat-details-panel"
      ref={panelRef}
      aria-labelledby="chat-details-title"
      tabIndex="-1"
      onKeyDown={handleKeyDown}
    >
      <header className="chat-details-header">
        <div>
          <p className="chat-details-eyebrow">Conversation</p>
          <h2 id="chat-details-title">Details</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close conversation details">
          <X size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </header>

      <div className="chat-details-content">
        <ChatUserSummary
          conversation={conversation}
          onConnectionFeedback={onConnectionFeedback}
        />

        {details ? (
          <>
            <ChatInfoSection icon={Info} title="About">
              <p>{details.bio}</p>
            </ChatInfoSection>

            <ChatInfoSection icon={Gamepad2} title="Games and skill">
              {details.games.length > 0 ? (
                <ul className="chat-interest-list" aria-label="Game interests">
                  {details.games.map((game) => <li key={game}>{game}</li>)}
                </ul>
              ) : (
                <p className="chat-supporting-empty">No game interests added.</p>
              )}
              <dl className="chat-detail-list">
                <div>
                  <dt>Skill level</dt>
                  <dd>{details.skillLevel}</dd>
                </div>
              </dl>
            </ChatInfoSection>

            <ChatInfoSection icon={GraduationCap} title="Campus community">
              <dl className="chat-detail-list">
                <div>
                  <dt><MapPin size={13} strokeWidth={2} aria-hidden="true" /> Campus</dt>
                  <dd>{details.campus}</dd>
                </div>
                <div>
                  <dt>Community</dt>
                  <dd>{details.community}</dd>
                </div>
                <div>
                  <dt>Chat started</dt>
                  <dd>{details.started}</dd>
                </div>
              </dl>
            </ChatInfoSection>
          </>
        ) : (
          <div className="chat-details-empty" role="status">
            <Info size={24} strokeWidth={1.8} aria-hidden="true" />
            <strong>No additional details</strong>
            <p>Profile and conversation information will appear here when available.</p>
          </div>
        )}

        <ChatInfoSection icon={FolderOpen} title="Shared content">
          <div className="chat-shared-empty">
            <FolderOpen size={22} strokeWidth={1.8} aria-hidden="true" />
            <div>
              <strong>No shared content yet</strong>
              <p>Links, media, and files shared in this chat will appear here.</p>
            </div>
          </div>
        </ChatInfoSection>
      </div>
    </aside>
  )
}

export default ChatDetailsPanel
