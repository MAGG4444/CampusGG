export function updateChatDraft(drafts, conversationId, value) {
  return conversationId ? { ...drafts, [conversationId]: value } : drafts
}

export function markConversationRead(conversations, conversationId) {
  return conversations.map((conversation) => conversation.id === conversationId && conversation.unreadCount > 0
    ? { ...conversation, unreadCount: 0 }
    : conversation)
}

export function appendChatMessage(conversations, conversationId, message) {
  return conversations.map((conversation) => conversation.id === conversationId
    ? { ...conversation, lastMessage: message.text, timestamp: 'Now', messages: [...conversation.messages, message] }
    : conversation)
}
