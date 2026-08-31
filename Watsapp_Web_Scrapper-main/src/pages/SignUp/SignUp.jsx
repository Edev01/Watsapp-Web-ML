import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: 'Empty', color: 'bg-slate-200' }
  let score = 0
  if (pwd.length >= 6) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  switch (score) {
    case 1: return { score: 25, label: 'Weak', color: 'bg-rose-500' }
    case 2: return { score: 50, label: 'Fair', color: 'bg-amber-500' }
    case 3: return { score: 75, label: 'Good', color: 'bg-teal-500' }
    case 4: return { score: 100, label: 'Strong', color: 'bg-emerald-500' }
    default: return { score: 10, label: 'Too Short', color: 'bg-rose-600' }
  }
}

const SignUp = ({ setToast }) => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})

  const [signUpData, setSignUpData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const strengthInfo = getPasswordStrength(signUpData.password)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSignUpData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!signUpData.fullName.trim()) newErrors.fullName = 'Full Name is required'

    if (!signUpData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(signUpData.email)) {
      newErrors.email = 'Invalid email address'
    }

    if (!signUpData.password) {
      newErrors.password = 'Password is required'
    } else if (signUpData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }


    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setToast({ type: 'error', message: 'Please correct registration details' })
      return
    }

    setIsLoading(true)
    setTimeout(() => {
      // 1. Read existing users
      const stored = localStorage.getItem('registeredUsers')
      const users = stored ? JSON.parse(stored) : []

      // 2. Check if email already exists
      const emailExists = users.some(u => u.email === signUpData.email)
      if (emailExists) {
        setIsLoading(false)
        setErrors({ email: 'An account with this email already exists.' })
        setToast({ type: 'error', message: 'Email address already registered' })
        return
      }

      // 3. Add new user
      const newUser = {
        fullName: signUpData.fullName,
        email: signUpData.email,
        password: signUpData.password,
        role: 'user',
        joinedAt: new Date().toISOString()
      }
      users.push(newUser)
      localStorage.setItem('registeredUsers', JSON.stringify(users))

      setIsLoading(false)
      // Notify parent (App) + show toast
      setToast({ type: 'success', message: `Account created! Welcome, ${signUpData.fullName}` })
      navigate('/signin')
    }, 1500)
  }

  const ErrorMsg = ({ msg }) =>
    msg ? (
      <p className="text-xs text-rose-500 font-medium mt-1 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {msg}
      </p>
    ) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
      <div>
        <h3 className="text-2xl font-black tracking-tight mb-1 text-slate-900">Sign Up</h3>
        <p className="text-xs text-slate-500">Get set up and start extracting contacts in seconds.</p>
      </div>

      <div className="space-y-3">
        {/* Full Name */}
        <div>
          <div className="floating-group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 z-10 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <input
              type="text"
              id="signup-name"
              name="fullName"
              value={signUpData.fullName}
              onChange={handleChange}
              className={`w-full pl-11 pr-4 py-2 rounded-xl border glass-input focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 floating-input ${
                errors.fullName ? 'border-rose-500 ring-rose-500/20 floating-input-error' : 'border-slate-200'
              }`}
              placeholder=" "
            />
            <label htmlFor="signup-name" className="floating-label">Full Name</label>
          </div>
          <ErrorMsg msg={errors.fullName} />
        </div>

        {/* Email */}
        <div>
          <div className="floating-group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 z-10 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
              </svg>
            </span>
            <input
              type="email"
              id="signup-email"
              name="email"
              value={signUpData.email}
              onChange={handleChange}
              className={`w-full pl-11 pr-4 py-2 rounded-xl border glass-input focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 floating-input ${
                errors.email ? 'border-rose-500 ring-rose-500/20 floating-input-error' : 'border-slate-200'
              }`}
              placeholder=" "
            />
            <label htmlFor="signup-email" className="floating-label">Email Address</label>
          </div>
          <ErrorMsg msg={errors.email} />
        </div>

        {/* Password */}
        <div>
          <div className="floating-group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 z-10 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              id="signup-password"
              name="password"
              value={signUpData.password}
              onChange={handleChange}
              className={`w-full pl-11 pr-11 py-2 rounded-xl border glass-input focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 floating-input ${
                errors.password ? 'border-rose-500 ring-rose-500/20' : 'border-slate-200'
              }`}
              placeholder=" "
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer z-10">
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
            <label htmlFor="signup-password" className="floating-label">Create Password</label>
          </div>

          {/* Password Strength Bar */}
          {signUpData.password && (
            <div className="mt-2.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                <span>Password Strength:</span>
                <span className="font-extrabold uppercase">{strengthInfo.label}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full ${strengthInfo.color} transition-all duration-500`} style={{ width: `${strengthInfo.score}%` }} />
              </div>
            </div>
          )}
          <ErrorMsg msg={errors.password} />
        </div>

        {/* Confirm Password */}
        <div>
          <div className="floating-group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 z-10 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="signup-confirm"
              name="confirmPassword"
              value={signUpData.confirmPassword}
              onChange={handleChange}
              className={`w-full pl-11 pr-11 py-2 rounded-xl border glass-input focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm transition-all text-slate-900 floating-input ${
                errors.confirmPassword ? 'border-rose-500 ring-rose-500/20 floating-input-error' : 'border-slate-200'
              }`}
              placeholder=" "
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer z-10">
              {showConfirmPassword ? (
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
            <label htmlFor="signup-confirm" className="floating-label">Confirm Password</label>
          </div>
          <ErrorMsg msg={errors.confirmPassword} />
        </div>
      </div>


      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md mt-4"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Registering Account...
          </>
        ) : (
          <>
            Sign Up
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </>
        )}
      </button>

      {/* Link to Sign In */}
      <div className="text-center text-xs text-slate-500 mt-4 border-t border-slate-100 pt-3">
        Already have an account?{' '}
        <Link to="/signin" className="text-emerald-600 hover:text-emerald-500 font-bold hover:underline transition-colors">
          Sign In
        </Link>
      </div>
    </form>
  )
}

export default SignUp
