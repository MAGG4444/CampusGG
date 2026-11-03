import { useState } from 'react'
import { ChatContext } from './chatContext.js'
import { conversations as initialConversations, CURRENT_USER_ID } from '../data/chatData.js'
import { appendChatMessage, markConversationRead, updateChatDraft } from '../utils/chatState.js'

export default function ChatProvider({ children }) {
  const [chatConversations, setChatConversations] = useState(initialConversations)
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const selectedConversation = chatConversations.find((item) => item.id === selectedConversationId)
  const messageDraft = drafts[selectedConversationId] ?? ''

  function setMessageDraft(value) {
    if (selectedConversationId) setDrafts((current) => updateChatDraft(current, selectedConversationId, value))
  }

  function selectConversation(id) {
    if (id) setChatConversations((current) => markConversationRead(current, id))
    setSelectedConversationId(id)
  }

  function sendMessage(messageText) {
    const text = messageText.trim()
    if (!selectedConversation || !text) return false
    const timestamp = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date())
    const message = { id: crypto.randomUUID(), senderId: CURRENT_USER_ID, text, timestamp }
    setChatConversations((current) => appendChatMessage(current, selectedConversationId, message))
    setMessageDraft('')
    return true
  }

  return <ChatContext.Provider value={{ chatConversations, selectedConversationId, selectedConversation,
    messageDraft, setMessageDraft, selectConversation, sendMessage }}>{children}</ChatContext.Provider>
}
