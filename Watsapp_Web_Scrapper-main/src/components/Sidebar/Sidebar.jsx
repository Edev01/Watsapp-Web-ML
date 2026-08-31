import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const IconMap = {
  grid: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  qr: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  home: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  users: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  messages: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" /></svg>,
  heart: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  userPlus: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  key: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m-3.293 3.293a1 1 0 01-1.414 0l-1.414-1.414a1 1 0 010-1.414zM10.5 10.5a6 6 0 11-8.485-8.485 6 6 0 018.485 8.485zm0 0l3 3m0 0h3v3h3l3.5 3.5M21 21v-3h-3v-3h-3" /></svg>,
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { x: -15, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 120, damping: 14 }
  }
}

// Stable subcomponent declared OUTSIDE of the Sidebar render loop
// to prevent React from unmounting & recreating DOM nodes on parent state changes.
const SidebarContent = ({ user, activeTab, handleNav, onSignOut, navItems = [], isAdmin, onClose, isMounted }) => (
  <div className="flex flex-col h-full bg-white dark:bg-slate-800 transition-colors">
    {/* Logo */}
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <motion.div
          initial={isMounted ? false : { rotate: -15, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow shrink-0"
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.518-5.16-1.416l-.37-.22-3.762.981.999-3.667-.241-.378A9.959 9.959 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
        </motion.div>
        <div>
          <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-none">WhatsScrape</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">{isAdmin ? 'Admin Panel' : 'User Portal'}</p>
        </div>
      </div>
      {/* Close btn (mobile only) */}
      <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors">
        <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {/* Role badge */}
    {isAdmin && (
      <div className="mx-4 mt-3">
        <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
          ⚡ Administrator
        </span>
      </div>
    )}

    {/* Nav */}
    <motion.nav 
      variants={listVariants}
      initial={isMounted ? false : "hidden"}
      animate="visible"
      className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto"
    >
      {navItems.map(item => (
        <motion.button
          key={item.id}
          variants={itemVariants}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleNav(item.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer text-left ${
            activeTab === item.id
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className={`shrink-0 ${activeTab === item.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
            {IconMap[item.icon]}
          </span>
          {item.label}
        </motion.button>
      ))}
    </motion.nav>

    {/* User + Sign Out */}
    <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-sm shrink-0">
          {user?.fullName?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.fullName}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={onSignOut}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign Out
      </button>
    </div>
  </div>
)

const Sidebar = ({ user, activeTab, setActiveTab, onSignOut, navItems = [], isAdmin, isOpen, onClose }) => {
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleNav = (id) => {
    setActiveTab(id)
    onClose?.()
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 h-screen sticky top-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col shadow-sm shrink-0 transition-colors">
        <SidebarContent 
          user={user}
          activeTab={activeTab}
          handleNav={handleNav}
          onSignOut={onSignOut}
          navItems={navItems}
          isAdmin={isAdmin}
          onClose={onClose}
          isMounted={isMounted}
        />
      </aside>

      {/* Mobile Drawer (with AnimatePresence) */}
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            {/* Overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" 
              onClick={onClose} 
            />
            {/* Drawer side panel */}
            <motion.aside 
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative z-50 w-64 bg-white dark:bg-slate-800 h-full flex flex-col shadow-xl transition-colors"
            >
              <SidebarContent 
                user={user}
                activeTab={activeTab}
                handleNav={handleNav}
                onSignOut={onSignOut}
                navItems={navItems}
                isAdmin={isAdmin}
                onClose={onClose}
                isMounted={isMounted}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Sidebar
