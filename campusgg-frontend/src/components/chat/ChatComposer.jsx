import { Send } from 'lucide-react'

function ChatComposer() {
  return (
    <div className="chat-composer" aria-label="Message composer coming soon">
      <label className="sr-only" htmlFor="chat-message-draft">Message composer</label>
      <input
        id="chat-message-draft"
        type="text"
        placeholder="Messaging will be available soon"
        disabled
      />
      <button type="button" disabled aria-label="Send message (coming soon)">
        <Send size={19} strokeWidth={2.2} aria-hidden="true" />
        <span>Send</span>
      </button>
    </div>
  )
}

export default ChatComposer
