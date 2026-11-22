import { useState } from 'react'
import { ChatContext } from './chatContext.js'

// Direct messaging is not connected to a backend yet.
export default function ChatProvider({ children }) {
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  return <ChatContext.Provider value={{ chatConversations: [], selectedConversationId,
    selectedConversation: null, messageDraft: '', setMessageDraft: () => {},
    selectConversation: setSelectedConversationId, sendMessage: () => false }}>{children}</ChatContext.Provider>
}
