import React from 'react'

const Header = ({ title, onMenuClick, theme, setTheme, user }) => {
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Calculate subscription info for badge
  const getSubBadge = () => {
    if (!user) return null
    if (user.role === 'admin') {
      return (
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
          👑 Admin Mode
        </span>
      )
    }

    const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
    const localUser = localUsers.find(u => u.email?.toLowerCase() === user.email?.toLowerCase())
    
    const subEndDateStr = localUser?.subscriptionEndDate || user?.subscriptionEndDate

    let endDate = subEndDateStr ? new Date(subEndDateStr) : null
    if (!endDate || isNaN(endDate.getTime())) {
      const joined = (localUser?.joinedAt || user?.joinedAt) ? new Date(localUser?.joinedAt || user?.joinedAt) : new Date()
      endDate = new Date(joined)
      endDate.setMonth(endDate.getMonth() + 6)
    }

    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (daysLeft <= 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Subscription Expired
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        6-Mo Plan • {daysLeft}d left
      </span>
    )
  }

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button 
            onClick={onMenuClick} 
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{title}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Subscription Status Badge */}
        {getSubBadge()}

        {/* Sleek Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-amber-400 cursor-pointer transition-all duration-300 active:scale-95 flex items-center justify-center shadow-inner"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            // Sun Icon
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            // Moon Icon
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}

export default Header
