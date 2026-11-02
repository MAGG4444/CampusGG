function ChatInfoSection({ icon: Icon, title, children }) {
  return (
    <section className="chat-info-section">
      <h3>
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  )
}

export default ChatInfoSection
