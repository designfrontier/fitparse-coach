import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import './Header.css'

const Header = ({ user }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(['user'], null)
      navigate('/')
    }
  })

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  if (!user) return null

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/dashboard" className="logo">
          🚴 Strava Coach
        </Link>
        
        <nav className="nav-links">
          <Link 
            to="/dashboard" 
            className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link 
            to="/analyze" 
            className={`nav-link ${location.pathname === '/analyze' ? 'active' : ''}`}
          >
            Analyze
          </Link>
          <Link 
            to="/settings" 
            className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
          >
            Settings
          </Link>
        </nav>

        <div className="user-info">
          <span className="user-name">
            👤 {user.firstname} {user.lastname}
          </span>
          <button 
            onClick={handleLogout}
            className="btn-logout"
            disabled={logoutMutation.isLoading}
          >
            {logoutMutation.isLoading ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header