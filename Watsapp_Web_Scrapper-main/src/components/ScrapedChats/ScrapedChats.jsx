import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_ENDPOINTS, scrapedChatsApi } from '../../api'

const extractList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.chats)) return payload.chats
  if (Array.isArray(payload?.messages)) return payload.messages
  if (Array.isArray(payload?.data?.chats)) return payload.data.chats
  if (Array.isArray(payload?.data?.messages)) return payload.data.messages
  return []
}

const normalizeDate = (value) => {
  if (!value) return ''

  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && String(value).trim() !== '') {
    const date = new Date(numericValue < 1000000000000 ? numericValue * 1000 : numericValue)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

const normalizeChat = (chat = {}) => ({
  jid: chat.jid || chat.chatId || chat.id || chat._id || '',
  name: chat.name || chat.pushName || chat.displayName || chat.title || chat.jid || 'Unknown chat',
  avatar: chat.avatar || chat.profilePicUrl || chat.picture || chat.image || '',
  isMonitored: Boolean(chat.is_monitored ?? chat.isMonitored ?? chat.monitored),
  createdAt: normalizeDate(chat.created_at || chat.createdAt || chat.updated_at || chat.updatedAt),
})

const normalizeMessage = (message = {}, index) => {
  const id = typeof message.id === 'object'
    ? message.id?._serialized || message.id?.id
    : message.id

  const body = message.body
    || message.text
    || message.message
    || message.content
    || message.caption
    || message._data?.body
    || ''

  const from = message.from || message.author || message.sender || message._data?.from || ''
  const to = message.to || message.recipient || message._data?.to || ''

  return {
    id: id || `${from || to || 'message'}-${message.timestamp || index}`,
    body: String(body || ''),
    from,
    to,
    senderName: message.senderName || message.notifyName || message.pushName || message._data?.notifyName || from || 'Unknown sender',
    type: message.type || message.messageType || message._data?.type || 'message',
    fromMe: Boolean(
      message.fromMe ?? 
      message.from_me ?? 
      message.isFromMe ?? 
      message.id?.fromMe ?? 
      message.key?.fromMe ?? 
      (typeof id === 'string' && id.startsWith('true_'))
    ),
    createdAt: normalizeDate(message.created_at || message.createdAt || message.timestamp || message.t),
  }
}

const formatDateTime = (value) => {
  if (!value) return 'No timestamp'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No timestamp'

  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getInitial = (value) => {
  const cleaned = String(value || '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() : '?'
}

const ChatAvatar = ({ chat }) => {
  const [failed, setFailed] = useState(false)

  if (chat.avatar && !failed) {
    return (
      <img
        src={chat.avatar}
        alt=""
        className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 shrink-0"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-sm font-black shrink-0">
      {getInitial(chat.name || chat.jid)}
    </div>
  )
}

const StatBox = ({ label, value, sub }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{sub}</p>}
  </div>
)

const EmptyState = ({ title, description }) => (
  <div className="text-center py-12 px-4">
    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/70 mx-auto mb-3 flex items-center justify-center">
      <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
      </svg>
    </div>
    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</p>
    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{description}</p>
  </div>
)

const ScrapedChats = ({ setToast }) => {
  const [chats, setChats] = useState([])
  const [messages, setMessages] = useState([])
  const [selectedChatId, setSelectedChatId] = useState('')
  const [selectedJids, setSelectedJids] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [chatFilter, setChatFilter] = useState('all')
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [monitoringIds, setMonitoringIds] = useState([])
  const [error, setError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [chatStats, setChatStats] = useState({ total: 0, monitored: 0, unmonitored: 0 })
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const [showMobileMessages, setShowMobileMessages] = useState(false)

  const selectedChat = useMemo(
    () => chats.find(chat => chat.jid === selectedChatId) || null,
    [chats, selectedChatId]
  )

  const monitoredCount = chatStats.monitored || chats.filter(chat => chat.isMonitored).length

  const selectedJidSet = useMemo(
    () => new Set(selectedJids),
    [selectedJids]
  )

  const visibleChats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const baseList = chatFilter === 'monitored'
      ? chats.filter(chat => chat.isMonitored)
      : chats

    if (!term) return baseList

    return baseList.filter(chat => (
      chat.name.toLowerCase().includes(term)
      || chat.jid.toLowerCase().includes(term)
    ))
  }, [chatFilter, chats, searchTerm])

  const selectableVisibleChats = useMemo(
    () => visibleChats.filter(chat => !chat.isMonitored),
    [visibleChats]
  )

  const allVisibleSelected = selectableVisibleChats.length > 0
    && selectableVisibleChats.every(chat => selectedJidSet.has(chat.jid))

  const loadChats = useCallback(async () => {
    setLoadingChats(true)
    setError('')

    const listType = chatFilter === 'monitored' ? 'monitored' : 'all'

    const [statsResult, chatsResult] = await Promise.allSettled([
      scrapedChatsApi.getChatStats(),
      scrapedChatsApi.getChats({ type: listType }),
    ])

    if (statsResult.status === 'fulfilled') {
      const stats = statsResult.value?.data || statsResult.value || {}
      setChatStats({
        total: Number(stats.total) || 0,
        monitored: Number(stats.monitored) || 0,
        unmonitored: Number(stats.unmonitored) || 0,
      })
    }

    if (chatsResult.status === 'fulfilled') {
      const list = extractList(chatsResult.value).map(normalizeChat).filter(chat => chat.jid)
      setChats(list)
      setLastSyncedAt(new Date().toISOString())
      setSelectedJids(prev => prev.filter(id => list.some(chat => chat.jid === id && !chat.isMonitored)))
      setSelectedChatId(prev => {
        if (prev && list.some(chat => chat.jid === prev)) return prev
        return list[0]?.jid || ''
      })
    } else {
      setChats([])
      setError(chatsResult.reason?.message || 'Failed to load scraped chats')
    }

    setLoadingChats(false)
  }, [chatFilter])

  const loadMessages = useCallback(async (chatId) => {
    if (!chatId) {
      setMessages([])
      return
    }

    setLoadingMessages(true)
    setMessageError('')

    try {
      const payload = await scrapedChatsApi.getMessages(chatId)
      const list = extractList(payload).map(normalizeMessage)
      setMessages(list)
    } catch (err) {
      setMessages([])
      setMessageError(err.message || 'Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    loadMessages(selectedChatId)
  }, [loadMessages, selectedChatId])

  const toggleChatSelection = (chat) => {
    if (!chat?.jid || chat.isMonitored || monitoringIds.includes(chat.jid)) return

    setSelectedJids(prev => (
      prev.includes(chat.jid)
        ? prev.filter(id => id !== chat.jid)
        : [...prev, chat.jid]
    ))
  }

  const toggleVisibleSelection = () => {
    const visibleIds = selectableVisibleChats.map(chat => chat.jid)
    if (visibleIds.length === 0) return

    setSelectedJids(prev => {
      if (visibleIds.every(id => prev.includes(id))) {
        return prev.filter(id => !visibleIds.includes(id))
      }

      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }

  const handleMonitorSelected = async () => {
    const jidsToMonitor = selectedJids.filter(id => chats.some(chat => chat.jid === id && !chat.isMonitored))
    if (jidsToMonitor.length === 0) return

    setMonitoringIds(prev => Array.from(new Set([...prev, ...jidsToMonitor])))

    try {
      await scrapedChatsApi.monitorChats(jidsToMonitor)
      setToast?.({ type: 'success', message: `${jidsToMonitor.length} chat${jidsToMonitor.length > 1 ? 's' : ''} added to monitored chats` })
      setSelectedJids([])
      await loadChats()
    } catch (err) {
      setToast?.({ type: 'error', message: err.message || 'Failed to monitor selected chats' })
    } finally {
      setMonitoringIds(prev => prev.filter(id => !jidsToMonitor.includes(id)))
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">Scraped Chats</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            WhatsApp chats, monitored status, and scraped messages
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>

          <button
            type="button"
            onClick={handleMonitorSelected}
            disabled={selectedJids.length === 0 || monitoringIds.length > 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <svg className={`w-4 h-4 ${monitoringIds.length > 0 && selectedJids.length > 0 ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Monitor Selected ({selectedJids.length})
          </button>

          <button
            type="button"
            onClick={loadChats}
            disabled={loadingChats}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-60 transition-colors"
          >
            <svg className={`w-4 h-4 ${loadingChats ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatBox label="Total chats" value={chatStats.total || chats.length} sub="Filtered server-side by type" />
        <StatBox label="Monitored" value={monitoredCount} sub="type=monitored" />
        <StatBox label="Messages" value={messages.length} sub={selectedChat?.name || 'Select a chat'} />
        <StatBox label="Last sync" value={lastSyncedAt ? formatDateTime(lastSyncedAt) : 'Pending'} sub="Dashboard refresh time" />
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-5">
        <section className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-col h-[600px] ${
          showMobileMessages ? 'hidden xl:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Chats</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{visibleChats.length} visible · {selectedJids.length} selected</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-900/70 rounded-xl p-1 flex">
              {[
                { id: 'all', label: 'All' },
                { id: 'monitored', label: 'Monitored' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setChatFilter(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    chatFilter === item.id
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/35">
            <button
              type="button"
              onClick={toggleVisibleSelection}
              disabled={selectableVisibleChats.length === 0}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                allVisibleSelected
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
              }`}>
                {allVisibleSelected && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {allVisibleSelected ? 'Unselect visible' : 'Select visible'}
            </button>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {selectableVisibleChats.length} available for monitor
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingChats ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-36" />
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-700/70 rounded w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleChats.length === 0 ? (
              <EmptyState
                title="No chats found"
                description={chatFilter === 'monitored' ? 'No monitored chats yet' : 'Try another search'}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {visibleChats.map(chat => {
                  const isSelected = chat.jid === selectedChatId
                  const isChecked = selectedJidSet.has(chat.jid)
                  const isMonitoring = monitoringIds.includes(chat.jid)

                  return (
                    <div
                      key={chat.jid}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedChatId(chat.jid)
                        setShowMobileMessages(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedChatId(chat.jid)
                          setShowMobileMessages(true)
                        }
                      }}
                      className={`w-full text-left p-4 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          disabled={chat.isMonitored || isMonitoring}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleChatSelection(chat)
                          }}
                          className={`mt-2 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : chat.isMonitored || isMonitoring
                                ? 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                          }`}
                          aria-label={chat.isMonitored ? 'Already monitored' : `Select ${chat.name}`}
                        >
                          {isChecked && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <ChatAvatar chat={chat} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{chat.name}</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">{chat.jid}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              chat.isMonitored
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                            }`}>
                              {chat.isMonitored ? 'Monitored' : 'New'}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(chat.createdAt)}</p>
                            <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                              chat.isMonitored
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : isChecked
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                            }`}>
                              {isMonitoring && (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              )}
                              {chat.isMonitored ? 'Added' : isChecked ? 'Selected' : 'Select'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-col h-[600px] ${
          showMobileMessages ? 'flex' : 'hidden xl:flex'
        }`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setShowMobileMessages(false)}
                className="xl:hidden p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                aria-label="Back to chats"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              {selectedChat && <ChatAvatar chat={selectedChat} />}
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                  {selectedChat ? selectedChat.name : 'Messages'}
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                  {selectedChat?.jid || API_ENDPOINTS.scrapedChatMessages}
                </p>
              </div>
            </div>
            {selectedChat && (
              <button
                type="button"
                onClick={() => loadMessages(selectedChat.jid)}
                disabled={loadingMessages}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 text-xs font-bold hover:border-emerald-300 dark:hover:border-emerald-700 disabled:opacity-60 transition-colors shrink-0"
              >
                <svg className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">Reload Messages</span>
                <span className="sm:hidden">Reload</span>
              </button>
            )}
          </div>

          <div className="flex-1 bg-slate-50 dark:bg-slate-900/45 p-4 overflow-y-auto">
            {!selectedChat ? (
              <EmptyState title="Select a chat" description="Messages will appear here" />
            ) : loadingMessages ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map(item => (
                  <div key={item} className={`flex ${item % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <div className="w-72 max-w-[80%] rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-700/70 rounded w-full" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-700/70 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messageError ? (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300">
                {messageError}
              </div>
            ) : messages.length === 0 ? (
              <EmptyState title="No messages yet" description="This chat returned an empty message list" />
            ) : (
              <div className="space-y-3">
                {messages.map(message => (
                  <div key={message.id} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[86%] rounded-2xl border p-3 shadow-sm ${
                      message.fromMe
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                    }`}>
                      <div className="flex items-center justify-between gap-4 mb-1.5">
                        <p className={`text-[10px] font-bold truncate ${message.fromMe ? 'text-emerald-50' : 'text-slate-500 dark:text-slate-400'}`}>
                          {message.fromMe ? 'You' : message.senderName}
                        </p>
                        <p className={`text-[10px] shrink-0 ${message.fromMe ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {message.body || `[${message.type}]`}
                      </p>
                      {!message.fromMe && message.from && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-2 truncate">{message.from}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default ScrapedChats
