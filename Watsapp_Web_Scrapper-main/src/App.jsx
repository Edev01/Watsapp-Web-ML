import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import SignIn from './pages/SignIn/SignIn'
import Dashboard from './pages/Dashboard/Dashboard'
import Results from './pages/Results/Results'
import Toast from './components/Toast/Toast'

function AppContent({ toast, setToast, theme, setTheme, authUser, setAuthUser, handleSignOut }) {
  const location = useLocation()
  const isSignIn = location.pathname === '/signin'

  // Sync theme to document element based on route
  useEffect(() => {
    if (isSignIn) {
      document.documentElement.classList.remove('dark')
    } else {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    localStorage.setItem('theme', theme)
  }, [theme, isSignIn])

  if (isSignIn) {
    return (
      <div className="min-h-screen bg-white text-slate-800 relative font-sans">
        <main className="relative z-10 w-full">
          <Routes>
            <Route
              path="/signin"
              element={
                authUser
                  ? <Navigate to="/dashboard" replace />
                  : (
                    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
                      <div className="w-full max-w-[440px] bg-white rounded-3xl p-6 sm:p-9 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100">
                        <SignIn setAuthUser={setAuthUser} setToast={setToast} />
                      </div>
                    </div>
                  )
              }
            />
            <Route path="*" element={<Navigate to="/signin" replace />} />
          </Routes>
        </main>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 relative overflow-hidden font-sans transition-colors">
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-100 pointer-events-none" />

      <main className="relative z-10 w-full">
        <Routes>
          <Route path="/" element={<Navigate to="/signin" replace />} />
          <Route path="/signin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/signup" element={<Navigate to="/signin" replace />} />
          <Route
            path="/dashboard"
            element={
              authUser
                ? <Dashboard user={authUser} onSignOut={handleSignOut} setToast={setToast} theme={theme} setTheme={setTheme} />
                : <Navigate to="/signin" replace />
            }
          />
          <Route
            path="/results"
            element={
              authUser
                ? <Results />
                : <Navigate to="/signin" replace />
            }
          />
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}

function App() {
  const [toast, setToast] = useState(null)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  // Auth state — read initial value from localStorage on load
  const [authUser, setAuthUser] = useState(() => {
    const saved = localStorage.getItem('currentUser')
    const token = localStorage.getItem('authToken')
    if (saved && !token) {
      localStorage.removeItem('currentUser')
      return null
    }
    return saved ? JSON.parse(saved) : null
  })

  // Pre-seed demo expired user into LocalStorage
  useEffect(() => {
    const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
    const demoExpiredUser = {
      fullName: 'Expired Demo User',
      email: 'aftersubscription@gmail.com',
      password: 'Zhsk99100$',
      role: 'user',
      joinedAt: '2025-01-01T00:00:00.000Z',
      subscriptionStatus: 'expired',
      subscriptionStartDate: '2025-01-01T00:00:00.000Z',
      subscriptionEndDate: '2025-07-01T00:00:00.000Z'
    }

    const idx = localUsers.findIndex(u => u.email?.toLowerCase() === demoExpiredUser.email.toLowerCase())
    if (idx !== -1) {
      localUsers[idx] = demoExpiredUser
    } else {
      localUsers.push(demoExpiredUser)
    }
    localStorage.setItem('local_users', JSON.stringify(localUsers))
  }, [])

  // Sync authUser state to localStorage
  useEffect(() => {
    if (authUser) {
      localStorage.setItem('currentUser', JSON.stringify(authUser))
    } else {
      localStorage.removeItem('currentUser')
      localStorage.removeItem('authToken')
    }
  }, [authUser])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleSignOut = () => {
    localStorage.removeItem('authToken')
    setAuthUser(null)
    setToast({ type: 'success', message: 'Logged out successfully' })
  }

  return (
    <BrowserRouter>
      <AppContent
        toast={toast}
        setToast={setToast}
        theme={theme}
        setTheme={setTheme}
        authUser={authUser}
        setAuthUser={setAuthUser}
        handleSignOut={handleSignOut}
      />
    </BrowserRouter>
  )
}

export default App
