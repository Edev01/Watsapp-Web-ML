import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { API_ENDPOINTS } from '../../api'

const SignIn = ({ setAuthUser, setToast }) => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})

  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setSignInData(prev => ({ ...prev, [name]: value }))
    // Clear field error on type
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}

    // Basic empty-field validation
    if (!signInData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(signInData.email)) {
      newErrors.email = 'Invalid email address'
    }

    if (!signInData.password) {
      newErrors.password = 'Password is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setToast({ type: 'error', message: 'Please fill in all required fields' })
      return
    }

    setIsLoading(true)

    const callLoginApi = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.login, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true'
          },
          body: JSON.stringify({
            email: signInData.email,
            password: signInData.password
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          const token = resJson.token || 
                        resJson.accessToken || 
                        resJson.data?.token || 
                        resJson.data?.accessToken || 
                        '';
          if (token) {
            localStorage.setItem('authToken', token);
          }

          const userObj = resJson.user || resJson.data?.user || resJson;
          const email = userObj.email || signInData.email;
          const role = userObj.role || (email.toLowerCase().includes('admin') ? 'admin' : 'user');
          const fullName = userObj.fullName || userObj.name || (role === 'admin' ? 'Admin User' : 'Standard User');

          const loggedInUser = {
            fullName,
            email,
            role,
            token
          };

          setAuthUser(loggedInUser);
          setToast({ type: 'success', message: `Welcome back, ${fullName}!` });
          navigate('/dashboard');
          setIsLoading(false);
        } else {
          // Check local_users fallback for demo accounts
          const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
          const foundLocal = localUsers.find(u => u.email?.toLowerCase() === signInData.email.toLowerCase() && u.password === signInData.password)
          if (foundLocal) {
            const loggedInUser = {
              fullName: foundLocal.fullName,
              email: foundLocal.email,
              role: foundLocal.role || 'user',
              subscriptionEndDate: foundLocal.subscriptionEndDate,
              subscriptionStatus: foundLocal.subscriptionStatus,
              token: 'demo-local-token'
            }
            localStorage.setItem('authToken', 'demo-local-token')
            setAuthUser(loggedInUser)
            setToast({ type: 'success', message: `Welcome back, ${foundLocal.fullName}!` })
            navigate('/dashboard')
            setIsLoading(false)
            return
          }

          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.message || errData.error || 'Invalid credentials';
          throw new Error(errMsg);
        }
      } catch (apiError) {
        console.error("API login failed, checking local users:", apiError);
        const localUsers = JSON.parse(localStorage.getItem('local_users') || '[]')
        const foundLocal = localUsers.find(u => u.email?.toLowerCase() === signInData.email.toLowerCase() && u.password === signInData.password)
        if (foundLocal) {
          const loggedInUser = {
            fullName: foundLocal.fullName,
            email: foundLocal.email,
            role: foundLocal.role || 'user',
            subscriptionEndDate: foundLocal.subscriptionEndDate,
            subscriptionStatus: foundLocal.subscriptionStatus,
            token: 'demo-local-token'
          }
          localStorage.setItem('authToken', 'demo-local-token')
          setAuthUser(loggedInUser)
          setToast({ type: 'success', message: `Welcome back, ${foundLocal.fullName}!` })
          navigate('/dashboard')
          setIsLoading(false)
          return
        }

        setToast({ type: 'error', message: apiError.message || 'API connection failed. Please check backend.' });
        setIsLoading(false);
      }
    };

    callLoginApi();
  }

  const formVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 text-left"
    >
      <motion.div variants={itemVariants}>
        <h3 className="text-3xl font-black tracking-tight mb-2 text-slate-900">Sign In</h3>
        <p className="text-xs text-slate-500">Enter your credentials to access your account.</p>
      </motion.div>

      <motion.div className="space-y-5" variants={itemVariants}>
        {/* Email Input */}
        <div>
          <div className="floating-group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 z-10 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
              </svg>
            </span>
            <input
              type="email"
              id="signin-email"
              name="email"
              value={signInData.email}
              onChange={handleChange}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border glass-input focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 floating-input ${
                errors.email ? 'border-rose-500 ring-rose-500/20 floating-input-error' : 'border-slate-200'
              }`}
              placeholder=" "
            />
            <label htmlFor="signin-email" className="floating-label">Email Address</label>
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

        {/* Password Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span />
            <a
              href="#forgot"
              onClick={(e) => { e.preventDefault(); setToast({ type: 'success', message: 'Password recovery feature coming soon!' }) }}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-500"
            >
              Forgot Password?
            </a>
          </div>
          <div className="floating-group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 z-10 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              id="signin-password"
              name="password"
              value={signInData.password}
              onChange={handleChange}
              className={`w-full pl-11 pr-11 py-3 rounded-xl border glass-input focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 floating-input ${
                errors.password ? 'border-rose-500 ring-rose-500/20 floating-input-error' : 'border-slate-200'
              }`}
              placeholder=" "
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer z-10"
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
            <label htmlFor="signin-password" className="floating-label">Password</label>
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
      </motion.div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading}
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Verifying...
          </>
        ) : (
          <>
            Sign In
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </>
        )}
      </motion.button>
    </motion.form>
  )
}

export default SignIn
