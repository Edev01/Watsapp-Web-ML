import { useEffect } from 'react'
import { Toaster, toast as hotToast } from 'react-hot-toast'

const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast || !toast.message) return

    // Clean message: strip any emojis
    const cleanMsg = toast.message
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
      .trim()

    if (!cleanMsg) return

    if (toast.type === 'success') {
      hotToast.success(cleanMsg, { id: cleanMsg })
    } else {
      hotToast.error(cleanMsg, { id: cleanMsg })
    }

    if (onClose) {
      onClose()
    }
  }, [toast, onClose])

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  return (
    <Toaster
      position="top-right"
      containerStyle={{ top: 80, right: 16 }}
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: '600',
          borderRadius: '14px',
          padding: '12px 18px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
        },
        success: {
          iconTheme: { primary: '#10b981', secondary: '#ffffff' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
        },
      }}
    />
  )
}

export default Toast
