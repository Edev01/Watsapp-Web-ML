import { useNavigate } from 'react-router-dom'
import AdminDashboard from './AdminDashboard/AdminDashboard'
import UserDashboard from './UserDashboard/UserDashboard'

const Dashboard = ({ user, onSignOut, setToast, theme, setTheme }) => {
  const navigate = useNavigate()

  const handleSignOut = () => {
    onSignOut()
    navigate('/signin')
  }

  // Role check: admin role
  const isAdmin = user?.role === 'admin'

  if (isAdmin) {
    return (
      <AdminDashboard 
        user={user} 
        onSignOut={handleSignOut} 
        setToast={setToast} 
        theme={theme} 
        setTheme={setTheme} 
      />
    )
  }

  return (
    <UserDashboard 
      user={user} 
      onSignOut={handleSignOut} 
      setToast={setToast} 
      theme={theme} 
      setTheme={setTheme} 
    />
  )
}

export default Dashboard
