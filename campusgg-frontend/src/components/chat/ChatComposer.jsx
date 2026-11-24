import { useId, useLayoutEffect, useRef } from 'react'
import { Send } from 'lucide-react'

function ChatComposer({ value, onChange, onSend, recipientName, sending = false }) {
  const textareaRef = useRef(null)
  const textareaId = useId()
  const canSend = !sending && value.trim().length > 0 && value.length <= 2000

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`
  }, [value])

  async function handleSubmit(event) {
    event.preventDefault()

    if (!canSend) return

    const messageSent = await onSend(value)
    if (messageSent) textareaRef.current?.focus()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <form className="chat-composer" aria-label={`Message ${recipientName}`} onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={textareaId}>Message {recipientName}</label>
      <textarea
        id={textareaId}
        ref={textareaRef}
        rows={1}
        maxLength={2000}
        placeholder={`Message ${recipientName}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" disabled={!canSend} aria-label={`Send message to ${recipientName}`}>
        <Send size={19} strokeWidth={2.2} aria-hidden="true" />
        <span>Send</span>
      </button>
    </form>
  )
}

export default ChatComposer
