import { useState, useEffect, useRef } from 'react'
import Sidebar from '../../../components/Sidebar/Sidebar'
import QRConnect from '../../../components/QRConnect/QRConnect'
import Header from '../../../components/Header/Header'
import SkeletonLoading from '../../../components/SkeletonLoading/SkeletonLoading'
import { API_ENDPOINTS } from '../../../api'

// Admin nav items
const ADMIN_NAV = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'createUser', label: 'Create User', icon: 'userPlus' },
]

const StatCard = ({ label, value, sub, color, onClick }) => {
  const colorMap = {
    'text-emerald-600': 'text-emerald-600 dark:text-emerald-400',
    'text-blue-600': 'text-blue-600 dark:text-blue-400',
    'text-purple-600': 'text-purple-600 dark:text-purple-400',
    'text-amber-600': 'text-amber-600 dark:text-amber-400',
  }
  const displayColor = colorMap[color] || color || 'text-slate-900 dark:text-slate-100'

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md active:scale-[0.99]' : ''
      }`}
    >
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${displayColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

const getGraphData = (users, timeframe) => {
  const now = new Date()
  let data = []

  if (timeframe === 'week') {
    // Last 7 days, ending today
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
      const dateString = d.toDateString()
      
      const count = users.filter(u => {
        if (!u.joinedAt) return false
        const joinedDate = new Date(u.joinedAt)
        return joinedDate.toDateString() === dateString
      }).length

      data.push({ 
        label: dayName, 
        value: count, 
        fullLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
      })
    }
  } else if (timeframe === 'month') {
    // Last 30 days, grouped into 6 intervals of 5 days each
    for (let i = 5; i >= 0; i--) {
      const start = new Date()
      start.setDate(now.getDate() - (i * 5 + 4))
      const end = new Date()
      end.setDate(now.getDate() - (i * 5))
      
      const label = `${start.toLocaleDateString('en-US', { day: 'numeric' })}-${end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
      
      start.setHours(0,0,0,0)
      end.setHours(23,59,59,999)
      
      const count = users.filter(u => {
        if (!u.joinedAt) return false
        const joinedDate = new Date(u.joinedAt)
        return joinedDate >= start && joinedDate <= end
      }).length

      const startStr = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      const endStr = end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

      data.push({ 
        label: label, 
        value: count, 
        fullLabel: `${startStr} - ${endStr}` 
      })
    }
  } else if (timeframe === 'sixMonths') {
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(now.getMonth() - i)
      const monthName = d.toLocaleDateString('en-US', { month: 'short' })
      const year = d.getFullYear()
      const monthIndex = d.getMonth()

      const count = users.filter(u => {
        if (!u.joinedAt) return false
        const joinedDate = new Date(u.joinedAt)
        return joinedDate.getMonth() === monthIndex && joinedDate.getFullYear() === year
      }).length

      data.push({ 
        label: monthName, 
        value: count, 
        fullLabel: `${d.toLocaleDateString('en-US', { month: 'long' })} ${year}` 
      })
    }
  }

  return data
}

const UsersOnboardingChart = ({ users = [], theme }) => {
  const [timeframe, setTimeframe] = useState('week')
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [width, setWidth] = useState(500)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width) {
          setWidth(entry.contentRect.width)
        }
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const data = getGraphData(users, timeframe)
  
  const height = 220
  const paddingLeft = 40
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 30

  const maxVal = Math.max(...data.map(d => d.value), 4)
  const gridLinesCount = 4

  // Map data to SVG points
  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1 || 1)) * (width - paddingLeft - paddingRight)
    const y = height - paddingBottom - (d.value / maxVal) * (height - paddingTop - paddingBottom)
    return { x, y, label: d.label, value: d.value, fullLabel: d.fullLabel }
  })

  // Generate line path d attribute
  const linePath = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : ''

  // Generate gradient area path d attribute
  const yBottom = height - paddingBottom
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${yBottom} L ${points[0].x} ${yBottom} Z`
    : ''

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Users Onboarding</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Registration trends over time</p>
        </div>
        <div className="relative">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-900/50 rounded-xl outline-none cursor-pointer transition-colors"
          >
            <option value="week" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Last Week</option>
            <option value="month" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Last Month</option>
            <option value="sixMonths" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Last 6 Months</option>
          </select>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-emerald-600 dark:text-emerald-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full h-[220px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {Array.from({ length: gridLinesCount }).map((_, idx) => {
            const val = (maxVal / (gridLinesCount - 1)) * idx
            const y = height - paddingBottom - (val / maxVal) * (height - paddingTop - paddingBottom)
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={theme === 'dark' ? '#334155' : '#e2e8f0'}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] fill-slate-400 font-bold"
                >
                  {Math.round(val)}
                </text>
              </g>
            )
          })}

          {/* Gradient area */}
          {areaPath && (
            <path d={areaPath} fill="url(#chartGrad)" />
          )}

          {/* Path line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#10b981"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Vertical dashed line and active dot on hover */}
          {hoveredIdx !== null && points[hoveredIdx] && (
            <g>
              <line
                x1={points[hoveredIdx].x}
                y1={paddingTop}
                x2={points[hoveredIdx].x}
                y2={height - paddingBottom}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <circle
                cx={points[hoveredIdx].x}
                cy={points[hoveredIdx].y}
                r={4.5}
                fill={theme === 'dark' ? '#1e293b' : '#ffffff'}
                stroke="#10b981"
                strokeWidth={2.5}
              />
            </g>
          )}

          {/* Invisible interactive vertical columns for full-area hover */}
          {points.map((p, i) => {
            const columnWidth = (width - paddingLeft - paddingRight) / (points.length - 1 || 1)
            const xStart = p.x - columnWidth / 2
            return (
              <rect
                key={`hover-${i}`}
                x={xStart}
                y={paddingTop}
                width={columnWidth}
                height={height - paddingTop - paddingBottom}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            )
          })}

          {/* X-axis labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              className="text-[9px] fill-slate-400 dark:fill-slate-500 font-bold"
            >
              {p.label}
            </text>
          ))}
        </svg>

        {/* Custom Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute bg-slate-900 text-white text-[10px] rounded-lg p-2 shadow-lg pointer-events-none transition-all duration-75 z-20 border border-slate-800 whitespace-nowrap"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${(points[hoveredIdx].y / height) * 100 - 10}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <p className="font-bold border-b border-slate-700 pb-0.5 mb-0.5">{points[hoveredIdx].fullLabel}</p>
            <p className="text-emerald-400 font-extrabold text-[10px] leading-tight">users: {points[hoveredIdx].value}</p>
          </div>
        )}
      </div>
    </div>
  )
}

const AdminOverview = ({ users = [], theme, setActiveTab }) => {
  const totalUsers = users.length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Admin Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Platform statistics and management</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard 
          label="Total Users" 
          value={totalUsers} 
          sub="Registered users" 
          color="text-blue-600" 
          onClick={() => setActiveTab && setActiveTab('users')}
        />
        <StatCard label="WhatsApp Groups" value="12" sub="All connected" color="text-amber-600" />
      </div>

      {/* Users Onboarding Chart */}
      <div>
        <UsersOnboardingChart users={users} theme={theme} />
      </div>
    </div>
  )
}
const AdminUsersPanel = ({ users = [], setActiveTab, onRenewSubscription }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredUsers.length)
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage)

  const formatJoinDate = (iso) => {
    if (!iso) return 'N/A'
    return new Date(iso).toLocaleDateString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto transition-colors space-y-6">
      {/* Page Title Block */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">Users Management</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Total Registered Users: <span className="font-bold text-slate-800 dark:text-slate-200">{users.length}</span>
        </p>
      </div>

      {/* Action Row - Search left, Add button on the far right */}
      <div className="flex flex-row items-center justify-between gap-3 w-full">
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search users by name/email..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
          />
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('createUser')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/10 shrink-0 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 dark:text-slate-500 shadow-sm transition-colors">
          <svg className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">No registered users found</p>
          <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">Users will appear here once they sign up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subscription</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Joined Date</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {paginatedUsers.map((u, i) => {
                    let endDate = u.subscriptionEndDate ? new Date(u.subscriptionEndDate) : null
                    if (!endDate || isNaN(endDate.getTime())) {
                      const joined = u.joinedAt ? new Date(u.joinedAt) : new Date()
                      endDate = new Date(joined)
                      endDate.setMonth(endDate.getMonth() + 6)
                    }
                    const diffDays = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    const isExpired = diffDays <= 0

                    return (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center">
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.fullName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 font-mono">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            u.role === 'admin'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/50'
                          }`}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {u.role === 'admin' ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                              👑 Lifetime Admin
                            </span>
                          ) : (
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
                              isExpired
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                              {isExpired ? 'Expired' : `6-Mo Active • ${diffDays}d left`}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">{formatJoinDate(u.joinedAt)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-right">
                          {u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => onRenewSubscription && onRenewSubscription(u.email)}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition-all shadow-sm cursor-pointer inline-flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                              Renew (+6 Mo)
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing <span className="font-bold text-slate-800 dark:text-slate-200">{startIndex + 1}</span> to{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">{endIndex}</span> of{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">{filteredUsers.length}</span> users
              </p>
              <div className="flex items-center gap-1.5">
                {/* Prev Button */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      currentPage === page
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                {/* Next Button */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const AdminCreateUserPanel = ({ setToast, onUserCreated }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone_number: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      if (setToast) {
        setToast({ type: 'error', message: 'Please fix the errors in the form' })
      }
      return
    }

    setIsLoading(true)

    const callCreateUserApi = async () => {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 6)

      const newUserLocal = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone_number: formData.phone_number,
        role: 'user',
        joinedAt: startDate.toISOString(),
        subscriptionStatus: 'active',
        subscriptionStartDate: startDate.toISOString(),
        subscriptionEndDate: endDate.toISOString()
      }

      // Save user to LocalStorage
      const saveToLocal = () => {
        const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
        const idx = localUsers.findIndex(u => u.email?.toLowerCase() === formData.email.toLowerCase())
        if (idx !== -1) {
          localUsers[idx] = { ...localUsers[idx], ...newUserLocal }
        } else {
          localUsers.push(newUserLocal)
        }
        localStorage.setItem('local_users', JSON.stringify(localUsers))
      }

      try {
        const token = localStorage.getItem('authToken')
        const headers = {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(API_ENDPOINTS.users, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.fullName,
            phone_number: formData.phone_number
          })
        });

        saveToLocal()

        if (response.ok) {
          setIsLoading(false)
          if (setToast) {
            setToast({ type: 'success', message: `User ${formData.fullName || formData.email} created with a 6-Month Subscription!` })
          }

          setFormData({
            fullName: '',
            email: '',
            password: '',
            phone_number: ''
          })

          if (onUserCreated) {
            onUserCreated()
          }
        } else {
          const errData = await response.json().catch(() => ({}))
          const errMsg = errData.message || errData.error || 'Failed to create user on server'
          // Save locally even if server returns error so local demo user works
          setIsLoading(false)
          if (setToast) {
            setToast({ type: 'success', message: `User ${formData.fullName || formData.email} created locally with a 6-Month Subscription!` })
          }
          setFormData({
            fullName: '',
            email: '',
            password: '',
            phone_number: ''
          })
          if (onUserCreated) {
            onUserCreated()
          }
        }
      } catch (apiError) {
        console.error("API create user failed, saving locally:", apiError)
        saveToLocal()
        setIsLoading(false)
        if (setToast) {
          setToast({ type: 'success', message: `User ${formData.fullName || formData.email} created locally with a 6-Month Subscription!` })
        }
        setFormData({
          fullName: '',
          email: '',
          password: '',
          phone_number: ''
        })
        if (onUserCreated) {
          onUserCreated()
        }
      }
    };

    callCreateUserApi();
  }

  return (
    <div className="p-6 max-w-xl mx-auto transition-colors">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Create User</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Register a new user on the platform</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm transition-colors">
        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className={`w-full pl-11 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 dark:text-white bg-white dark:bg-slate-700 ${
                  errors.fullName ? 'border-rose-500 ring-rose-500/20' : 'border-slate-200 dark:border-slate-600'
                }`}
                placeholder="Enter full name"
              />
            </div>
            {errors.fullName && (
              <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                </svg>
              </span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full pl-11 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 dark:text-white bg-white dark:bg-slate-700 ${
                  errors.email ? 'border-rose-500 ring-rose-500/20' : 'border-slate-200 dark:border-slate-600'
                }`}
                placeholder="Enter email address"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full pl-11 pr-11 py-2.5 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 dark:text-white bg-white dark:bg-slate-700 ${
                  errors.password ? 'border-rose-500 ring-rose-500/20' : 'border-slate-200 dark:border-slate-600'
                }`}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 01-1.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.password}
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </span>
              <input
                type="text"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                className={`w-full pl-11 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 dark:text-white bg-white dark:bg-slate-700 ${
                  errors.phone_number ? 'border-rose-500 ring-rose-500/20' : 'border-slate-200 dark:border-slate-600'
                }`}
                placeholder="Enter phone number"
              />
            </div>
            {errors.phone_number && (
              <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.phone_number}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating User...
              </>
            ) : (
              <>
                Create Account
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

const AdminDashboard = ({ user, onSignOut, setToast, theme, setTheme }) => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('admin_active_tab') || 'overview'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [tabLoading, setTabLoading] = useState(true)

  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab)
  }, [activeTab])

  const fetchUsers = async () => {
    let apiUsers = []
    try {
      const token = localStorage.getItem('authToken')
      const headers = {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true'
      }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(API_ENDPOINTS.users, { headers })
      if (res.ok) {
        const json = await res.json()
        const list = Array.isArray(json) ? json
          : Array.isArray(json.users) ? json.users
          : Array.isArray(json.data) ? json.data
          : []

        apiUsers = list.map(u => ({
          fullName: u.fullName || u.name || u.username || u.email?.split('@')[0] || 'User',
          email: u.email || '',
          role: u.role || 'user',
          joinedAt: u.joinedAt || u.createdAt || u.created_at || new Date().toISOString(),
          subscriptionStatus: u.subscriptionStatus || 'active',
          subscriptionStartDate: u.subscriptionStartDate,
          subscriptionEndDate: u.subscriptionEndDate
        }))
      }
    } catch (err) {
      console.warn('Failed to fetch users from API:', err.message)
    }

    // Merge with LocalStorage local_users
    let localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
    
    // Seed expired user requested by user if not already present
    const expiredUserSeed = {
      fullName: 'Expired Demo User',
      email: 'aftersubscription@gmail.com',
      password: 'Zhsk99100$',
      role: 'user',
      joinedAt: '2025-01-01T00:00:00.000Z',
      subscriptionStatus: 'expired',
      subscriptionStartDate: '2025-01-01T00:00:00.000Z',
      subscriptionEndDate: '2025-07-01T00:00:00.000Z'
    }

    if (!localUsers.some(u => u.email?.toLowerCase() === expiredUserSeed.email.toLowerCase())) {
      localUsers.push(expiredUserSeed)
      localStorage.setItem('local_users', JSON.stringify(localUsers))
    }

    const combined = [...apiUsers]
    localUsers.forEach(lu => {
      const idx = combined.findIndex(u => u.email?.toLowerCase() === lu.email?.toLowerCase())
      if (idx !== -1) {
        combined[idx] = { ...combined[idx], ...lu }
      } else {
        combined.push(lu)
      }
    })

    setUsers(combined)
  }

  const handleRenewSubscription = (targetEmail) => {
    const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
    const idx = localUsers.findIndex(u => u.email?.toLowerCase() === targetEmail?.toLowerCase())
    
    let targetUser = idx !== -1 ? localUsers[idx] : users.find(u => u.email?.toLowerCase() === targetEmail?.toLowerCase())
    if (!targetUser) return

    let currentEnd = targetUser.subscriptionEndDate ? new Date(targetUser.subscriptionEndDate) : new Date()
    if (isNaN(currentEnd.getTime()) || currentEnd < new Date()) {
      currentEnd = new Date()
    }
    const newEnd = new Date(currentEnd)
    newEnd.setMonth(newEnd.getMonth() + 6)

    const updatedUser = {
      ...targetUser,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date().toISOString(),
      subscriptionEndDate: newEnd.toISOString()
    }

    if (idx !== -1) {
      localUsers[idx] = updatedUser
    } else {
      localUsers.push(updatedUser)
    }

    localStorage.setItem('local_users', JSON.stringify(localUsers))
    if (setToast) {
      setToast({ type: 'success', message: `Subscription for ${targetUser.fullName || targetUser.email} renewed for +6 Months!` })
    }
    fetchUsers()
  }

  // Fetch users from API & LocalStorage
  useEffect(() => {
    fetchUsers()
  }, [])

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
        navItems={ADMIN_NAV}
        isAdmin
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
        <Header 
          title={`Admin — ${ADMIN_NAV.find(n => n.id === activeTab)?.label}`}
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
              {activeTab === 'overview' && <AdminOverview users={users} theme={theme} setActiveTab={setActiveTab} />}
              {activeTab === 'connect' && <QRConnect />}
              {activeTab === 'users' && <AdminUsersPanel users={users} setActiveTab={setActiveTab} onRenewSubscription={handleRenewSubscription} />}
              {activeTab === 'createUser' && <AdminCreateUserPanel setToast={setToast} onUserCreated={fetchUsers} />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
