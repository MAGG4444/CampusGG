import { Search } from 'lucide-react'

function ConversationSearch({ value, onChange, inputRef, id = 'conversation-search' }) {
  return (
    <div className="chat-search">
      <label className="sr-only" htmlFor={id}>Search conversations by name</label>
      <Search size={18} strokeWidth={2} aria-hidden="true" />
      <input
        id={id}
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
