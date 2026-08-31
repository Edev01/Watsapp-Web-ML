import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { io } from 'socket.io-client'
import { API_ENDPOINTS } from '../../api'

const API_URL = API_ENDPOINTS.qrLatest
const SOCKET_BASE_URL = import.meta.env.VITE_SCRAPPER_URL || 'https://scrapper-node-app.onrender.com'
const POLL_INTERVAL = 5000 // 5 seconds interval fallback

const STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  CONNECTED: 'connected',
  ERROR: 'error'
}

// Format relative time (e.g. "Just now", "25s ago", "5m ago")
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return 'Recently'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Recently'
  
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
}

const QRConnect = () => {
  const [status, setStatus] = useState(STATUS.LOADING)
  const [qrData, setQrData] = useState(null)
  const [qrMeta, setQrMeta] = useState(null) // { createdAt, pageUrl, source }
  const [errorMsg, setErrorMsg] = useState('')
  const [lastUpdatedText, setLastUpdatedText] = useState('')
  const [socketConnected, setSocketConnected] = useState(false)

  const isInitialFetch = useRef(true)

  const fetchQR = useCallback(async (silent = false) => {
    if (!silent && isInitialFetch.current) {
      setStatus(STATUS.LOADING)
    }

    try {
      const cacheBustUrl = `${API_URL}${API_URL.includes('?') ? '&' : '?'}t=${Date.now()}`
      const res = await fetch(cacheBustUrl, {
        headers: {
          'bypass-tunnel-reminder': 'true',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const json = await res.json()

      // Handle array or object structure
      const rawData = Array.isArray(json?.data) ? json.data[0] : (json?.data || json)
      const qrCode = rawData?.url || rawData?.qr || json?.url || json?.qr || '';

      if (!qrCode) throw new Error('QR code URL/data not found in backend response')

      const createdAt = rawData?.created_at || rawData?.createdAt || json?.created_at || new Date().toISOString()

      setQrData(qrCode)
      setQrMeta({
        createdAt,
        pageUrl: rawData?.page_url || rawData?.pageUrl || '',
        source: rawData?.source || 'API'
      })
      setLastUpdatedText(formatRelativeTime(createdAt))
      setStatus(STATUS.READY)
      setErrorMsg('')
      isInitialFetch.current = false

    } catch (err) {
      console.error('QR fetch error:', err.message)
      if (isInitialFetch.current) {
        setStatus(STATUS.ERROR)
        setErrorMsg(err.message || 'Failed to fetch QR code from backend')
      }
    }
  }, [])

  // Socket.IO live sync for real-time QR updates
  useEffect(() => {
    let socket;
    try {
      socket = io(SOCKET_BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
      })

      socket.on('connect', () => {
        setSocketConnected(true)
      })

      socket.on('disconnect', () => {
        setSocketConnected(false)
      })

      // Listen for 'new_qr' event from backend
      socket.on('new_qr', (data) => {
        const rawData = Array.isArray(data) ? data[0] : data
        const qrCode = typeof rawData === 'string'
          ? rawData
          : (rawData?.url || rawData?.qr || rawData?.data || '')

        if (qrCode) {
          setQrData(qrCode)
          const createdAt = rawData?.created_at || rawData?.createdAt || new Date().toISOString()
          setQrMeta({
            createdAt,
            pageUrl: rawData?.page_url || rawData?.pageUrl || '',
            source: 'WebSocket Live'
          })
          setLastUpdatedText(formatRelativeTime(createdAt))
          setStatus(STATUS.READY)
          setErrorMsg('')
          isInitialFetch.current = false
        }
      })

      // Listen for 'qr_disappeared' event from backend
      socket.on('qr_disappeared', () => {
        setQrData(null)
        setStatus(STATUS.CONNECTED)
      })
    } catch (e) {
      console.error('Socket initialization error:', e)
    }

    return () => {
      if (socket) socket.disconnect()
    }
  }, [])

  // Initial fetch + Auto polling every 5 seconds as fallback
  useEffect(() => {
    fetchQR(false)

    const interval = setInterval(() => {
      fetchQR(true)
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchQR])

  // Update relative time readout every 5 seconds
  useEffect(() => {
    if (!qrMeta?.createdAt) return
    const timer = setInterval(() => {
      setLastUpdatedText(formatRelativeTime(qrMeta.createdAt))
    }, 5000)
    return () => clearInterval(timer)
  }, [qrMeta?.createdAt])

  return (
    <div className="p-8 max-w-lg mx-auto transition-colors text-center">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">WhatsApp Connection</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Connect your WhatsApp account by scanning the QR code below.
        </p>
      </div>

      {/* QR Code Box */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center justify-center min-h-[380px] transition-colors relative">

        {/* LOADING STATE */}
        {status === STATUS.LOADING && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fetching live QR code...</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Connecting to scrapper node server</p>
          </div>
        )}

        {/* READY STATE (QR Code display) */}
        {status === STATUS.READY && qrData && (
          <div className="text-center flex flex-col items-center w-full">
            {/* Live sync badge */}
            <div className="flex items-center gap-2 mb-4 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {socketConnected ? 'WebSocket Live Sync' : 'Live Sync Active'}
              </span>
            </div>

            {/* QR Code Container */}
            <div className="p-4 bg-white rounded-2xl border-2 border-emerald-100 dark:border-slate-700 shadow-md transition-transform hover:scale-[1.01]">
              <QRCodeSVG
                value={qrData}
                size={220}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
              />
            </div>

            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-4">
              Open WhatsApp → Linked Devices → Link a Device
            </p>
            
            <div className="flex items-center justify-center gap-3 mt-2">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Last updated: <span className="font-semibold text-slate-600 dark:text-slate-400">{lastUpdatedText}</span>
              </p>
              <button
                onClick={() => fetchQR(false)}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-bold underline cursor-pointer"
              >
                ↺ Refresh
              </button>
            </div>
          </div>
        )}

        {/* CONNECTED / DISAPPEARED STATE */}
        {status === STATUS.CONNECTED && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-black text-slate-900 dark:text-slate-100 mb-1">WhatsApp Connected!</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mx-auto mb-4">
              The QR code was scanned or linked successfully.
            </p>
            <button 
              onClick={() => fetchQR(false)} 
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Check QR Status
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {status === STATUS.ERROR && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">Server Connection Failed</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-[220px] mx-auto">{errorMsg}</p>
            <button 
              onClick={() => fetchQR(false)} 
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-emerald-500 transition-colors shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default QRConnect
