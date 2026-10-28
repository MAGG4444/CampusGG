import { Search } from 'lucide-react'

function ConversationSearch({ value, onChange, inputRef }) {
  return (
    <div className="chat-search">
      <label className="sr-only" htmlFor="conversation-search">Search conversations by name</label>
      <Search size={18} strokeWidth={2} aria-hidden="true" />
      <input
        id="conversation-search"
        ref={inputRef}
        type="search"
        placeholder="Search conversations"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export default ConversationSearch
