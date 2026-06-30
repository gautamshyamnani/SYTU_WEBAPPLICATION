// src/hooks/useChat.js
// Encapsulates conversation list, active conversation's messages, and the
// socket.io real-time wiring so ChatPage.jsx stays focused on layout.

import { useState, useEffect, useCallback, useRef } from 'react'
import { chatApi } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'
import { useAuth } from '../context/AuthContext'

export function useChat() {
  const { user: me } = useAuth()

  const [conversations, setConversations]   = useState([])
  const [convLoading, setConvLoading]       = useState(true)
  const [convError, setConvError]           = useState('')

  const [activeUser, setActiveUser]         = useState(null) // the other person in the open chat
  const [messages, setMessages]             = useState([])
  const [msgLoading, setMsgLoading]         = useState(false)
  const [msgError, setMsgError]             = useState('')

  const [sending, setSending]               = useState(false)

  // Keep the currently-open conversation's id accessible inside the socket
  // callback without re-subscribing the listener on every change.
  const activeUserIdRef = useRef(null)
  useEffect(() => {
    activeUserIdRef.current = activeUser?._id ?? null
  }, [activeUser])

  // ── Socket connect / listen for incoming messages ────────────────────────
  useEffect(() => {
    if (!me?._id) return

    const socket = connectSocket()

    const handleReceive = (msg) => {
      const fromId = msg.sender ?? msg.senderId ?? msg.from
      const toId   = msg.receiver ?? msg.receiverId ?? msg.to

      // If the incoming message belongs to the conversation currently open,
      // append it straight to the message thread.
      const otherId = fromId === me._id ? toId : fromId
      if (otherId === activeUserIdRef.current) {
        setMessages((prev) => [...prev, msg])
      }

      // Bump that conversation to the top of the list with the latest preview.
      setConversations((prev) => {
        const idx = prev.findIndex((c) => (c.user?._id ?? c._id) === otherId)
        if (idx === -1) return prev // unknown conversation; list will refresh on next visit
        const updated = { ...prev[idx], lastMessage: msg.text ?? msg.message ?? prev[idx].lastMessage }
        const next = [...prev]
        next.splice(idx, 1)
        next.unshift(updated)
        return next
      })
    }

    socket.on('receiveMessage', handleReceive)

    return () => {
      socket.off('receiveMessage', handleReceive)
    }
  }, [me?._id])

  // Disconnect the socket entirely on full unmount (e.g. logout/app close).
  useEffect(() => {
    return () => disconnectSocket()
  }, [])

  // ── Fetch conversations ───────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setConvLoading(true)
    setConvError('')
    try {
      const { data } = await chatApi.conversations()
      setConversations(data.conversations ?? data)
    } catch (err) {
      setConvError(err.response?.data?.message || 'Failed to load conversations.')
    } finally {
      setConvLoading(false)
    }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // ── Open a conversation ───────────────────────────────────────────────────
  const openConversation = useCallback(async (user) => {
    setActiveUser(user)
    setMessages([])
    setMsgError('')
    setMsgLoading(true)
    try {
      const { data } = await chatApi.messages(user._id)
      setMessages(data.messages ?? data)
    } catch (err) {
      setMsgError(err.response?.data?.message || 'Failed to load messages.')
    } finally {
      setMsgLoading(false)
    }
  }, [])

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || !activeUser?._id) return

    setSending(true)
    try {
      const { data } = await chatApi.send(activeUser._id, trimmed)
      const saved = data.message ?? data

      setMessages((prev) => [...prev, saved])

      // Emit over the socket so the other party gets it instantly.
      const socket = connectSocket()
      socket.emit('sendMessage', {
        ...saved,
        receiver: activeUser._id,
        sender: me?._id,
        text: trimmed,
      })

      // Keep this conversation pinned to the top with the latest preview.
      setConversations((prev) => {
        const idx = prev.findIndex((c) => (c.user?._id ?? c._id) === activeUser._id)
        if (idx === -1) return prev
        const updated = { ...prev[idx], lastMessage: trimmed }
        const next = [...prev]
        next.splice(idx, 1)
        next.unshift(updated)
        return next
      })

      return { ok: true }
    } catch (err) {
      return { ok: false, msg: err.response?.data?.message || 'Failed to send message.' }
    } finally {
      setSending(false)
    }
  }, [activeUser, me?._id])

  return {
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
  }
}
