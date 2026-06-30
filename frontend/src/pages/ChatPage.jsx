// src/pages/ChatPage.jsx
import { useState, useRef, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../hooks/useChat'

function initialsOf(user) {
  if (user?.name) {
    return user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  }
  return user?.username?.[0]?.toUpperCase() ?? '?'
}

export default function ChatPage() {
  const { user: me } = useAuth()
  const {
    conversations,
    convLoading,
    convError,
    activeUser,
    messages,
    msgLoading,
    msgError,
    sending,
    openConversation,
    sendMessage,
  } = useChat()

  const [draft, setDraft] = useState('')
  const bottomRef = useRef(null)

  // Auto-scroll to the latest message whenever the thread changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeUser])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!draft.trim() || sending) return
    const text = draft
    setDraft('')
    await sendMessage(text)
  }

  return (
    <div className="page-shell">
      <Navbar />
      <main className="chat-page">
        {/* ── LEFT: conversations list ───────────────────────────────── */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2 className="chat-sidebar-title">Messages</h2>
          </div>

          {convError && (
            <div className="alert alert-danger" style={{ margin: '0.75rem' }}>
              {convError}
            </div>
          )}

          {convLoading ? (
            <div className="chat-conv-list">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="chat-conv-item skeleton-card" style={{ minHeight: 56 }} />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <div className="empty-icon">💬</div>
              <p>No conversations yet. Connect with developers to start chatting!</p>
            </div>
          ) : (
            <div className="chat-conv-list">
              {conversations.map((conv) => {
                const user = conv.user ?? conv.participant ?? conv
                const isActive = activeUser?._id === user._id
                return (
                  <button
                    key={user._id}
                    className={`chat-conv-item ${isActive ? 'active' : ''}`}
                    onClick={() => openConversation(user)}
                  >
                    <div className="avatar" style={{ width: 42, height: 42, fontSize: '0.95rem' }}>
                      {initialsOf(user)}
                    </div>
                    <div className="chat-conv-info">
                      <div className="chat-conv-name">{user.name || user.username}</div>
                      <div className="chat-conv-preview">
                        {conv.lastMessage || conv.lastMessageText || 'Say hello 👋'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        {/* ── RIGHT: chat window ─────────────────────────────────────── */}
        <section className="chat-window">
          {!activeUser ? (
            <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
              <div className="empty-icon">👈</div>
              <p>Select a conversation to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="chat-window-header">
                <div className="avatar" style={{ width: 38, height: 38, fontSize: '0.9rem' }}>
                  {initialsOf(activeUser)}
                </div>
                <div className="chat-window-name">{activeUser.name || activeUser.username}</div>
              </div>

              <div className="chat-messages">
                {msgLoading ? (
                  <div className="spinner-wrap" style={{ minHeight: 'unset', padding: '2rem' }}>
                    <div className="spinner" />
                  </div>
                ) : msgError ? (
                  <div className="alert alert-danger" style={{ margin: '1rem' }}>
                    {msgError}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
                    <div className="empty-icon">✨</div>
                    <p>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const senderId = msg.sender ?? msg.senderId ?? msg.from
                    const isMine   = senderId === me?._id
                    return (
                      <div
                        key={msg._id ?? i}
                        className={`chat-bubble-row ${isMine ? 'mine' : 'theirs'}`}
                      >
                        <div className={`chat-bubble ${isMine ? 'chat-bubble--mine' : 'chat-bubble--theirs'}`}>
                          {msg.text ?? msg.message}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form className="chat-input-bar" onSubmit={handleSend}>
                <input
                  type="text"
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={sending}
                />
                <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
