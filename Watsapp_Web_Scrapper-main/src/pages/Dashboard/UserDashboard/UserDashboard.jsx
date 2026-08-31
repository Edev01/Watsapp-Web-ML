import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../../components/Sidebar/Sidebar'
import PropertyFilters, { DEFAULT_FILTERS } from '../../../components/PropertyFilters/PropertyFilters'
import QRConnect from '../../../components/QRConnect/QRConnect'
import Header from '../../../components/Header/Header'
import SkeletonLoading from '../../../components/SkeletonLoading/SkeletonLoading'
import ScrapedChats from '../../../components/ScrapedChats/ScrapedChats'

import ResetPassword from '../../../components/ResetPassword/ResetPassword'

const ExpiredSubscriptionOverlay = ({ user, subInfo }) => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
    <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center mb-6 shadow-inner text-rose-500">
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>

    <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">
      6-Month Subscription Expired
    </h2>
    
    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
      Your 6-Month WhatsApp Scraping access ended on <strong className="text-slate-700 dark:text-slate-200">{subInfo.endDateStr}</strong>. 
      To continue scanning WhatsApp QR codes and scraping chat listings, please contact your Administrator to renew your subscription.
    </p>

    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 max-w-sm w-full mb-6 text-left space-y-2.5 text-xs shadow-sm">
      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
        <span>Account User:</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">{user?.fullName || user?.name || user?.email}</span>
      </div>
      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
        <span>Plan Name:</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">6 Months Scraping Plan</span>
      </div>
      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
        <span>Access Status:</span>
        <span className="font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/50">Expired</span>
      </div>
    </div>

    <button
      onClick={() => alert('Please contact your system Administrator to extend or renew your subscription.')}
      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shadow-md flex items-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      Contact Administrator for Renewal
    </button>
  </div>
)

const USER_NAV = [
  { id: 'search', label: 'Search Properties', icon: 'home' },
  { id: 'connect', label: 'WhatsApp Connect', icon: 'qr' },
  { id: 'scrapedChats', label: 'Scraped Chats', icon: 'messages' },
  { id: 'saved', label: 'Saved Listings', icon: 'heart' },
  { id: 'resetPassword', label: 'Reset Password', icon: 'key' },
]

const UserDashboard = ({ user, onSignOut, setToast, theme, setTheme }) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('user_active_tab') || 'search'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [tabLoading, setTabLoading] = useState(true)

  useEffect(() => {
    localStorage.setItem('user_active_tab', activeTab)
  }, [activeTab])

  const handleSearch = (appliedFilters) => {
    navigate('/results', { state: { filters: appliedFilters } })
  }

  // Calculate user subscription state
  const getSubInfo = () => {
    if (!user) return { isExpired: false, daysLeft: 180, endDateStr: '' }
    if (user.role === 'admin') return { isExpired: false, daysLeft: 9999, endDateStr: 'Lifetime' }

    const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
    const localUser = localUsers.find(u => u.email?.toLowerCase() === user.email?.toLowerCase())
    
    const subEndDateStr = localUser?.subscriptionEndDate || user?.subscriptionEndDate

    let endDate = subEndDateStr ? new Date(subEndDateStr) : null
    if (!endDate || isNaN(endDate.getTime())) {
      const joined = (localUser?.joinedAt || user?.joinedAt) ? new Date(localUser?.joinedAt || user?.joinedAt) : new Date()
      endDate = new Date(joined)
      endDate.setMonth(endDate.getMonth() + 6)
    }

    const diffDays = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const isExpired = diffDays <= 0

    return {
      isExpired,
      daysLeft: diffDays > 0 ? diffDays : 0,
      endDateStr: endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }

  const subInfo = getSubInfo()

  // Trigger loading skeleton on tab change
  useEffect(() => {
    setTabLoading(true)
    const timer = setTimeout(() => {
      setTabLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [activeTab])

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden transition-colors">
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={onSignOut}
        navItems={USER_NAV}
        isAdmin={false}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
        <Header 
          title={USER_NAV.find(n => n.id === activeTab)?.label}
          onMenuClick={() => setSidebarOpen(true)}
          theme={theme}
          setTheme={setTheme}
          user={user}
        />
        <main className="flex-1 overflow-y-auto">
          {tabLoading ? (
            <SkeletonLoading tab={activeTab} />
          ) : (
            <>
              {activeTab === 'search' && (
                <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
                  <div className="mb-5">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">Search Properties</h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Set your filters and click Search to view results</p>
                  </div>
                  <PropertyFilters
                    filters={filters}
                    setFilters={setFilters}
                    resultCount={null}
                    onSearch={handleSearch}
                  />
                </div>
              )}
              {activeTab === 'connect' && (
                subInfo.isExpired 
                  ? <ExpiredSubscriptionOverlay user={user} subInfo={subInfo} />
                  : <QRConnect />
              )}
              {activeTab === 'scrapedChats' && (
                subInfo.isExpired 
                  ? <ExpiredSubscriptionOverlay user={user} subInfo={subInfo} />
                  : <ScrapedChats setToast={setToast} />
              )}
              {activeTab === 'resetPassword' && <ResetPassword setToast={setToast} />}
              {activeTab === 'saved' && (
                <div className="p-6 text-center mt-16">
                  <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <p className="font-bold text-slate-600 dark:text-slate-350">No saved listings yet</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Click the heart icon on any property to save it</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default UserDashboard
