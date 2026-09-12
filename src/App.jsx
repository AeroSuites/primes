import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'

function AppContent() {
  const { agent } = useAuth()
  const [view, setView] = useState('login')

  if (agent) return <Dashboard />
  if (view === 'register') return <Register onGoBack={() => setView('login')} />
  return <Login onGoRegister={() => setView('register')} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}