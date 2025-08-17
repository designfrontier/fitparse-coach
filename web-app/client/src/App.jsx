import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from './services/api'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import AnalyzePage from './pages/AnalyzePage'
import InterviewPage from './pages/InterviewPage'
import ResultsPage from './pages/ResultsPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user'],
    queryFn: api.getCurrentUser,
    retry: false,
    refetchOnMount: true
  })

  if (isLoading) {
    return <LoadingSpinner />
  }

  // Check if setup is needed (no Strava config)
  if (error?.response?.status === 503) {
    return <SetupPage />
  }

  const isAuthenticated = !!user

  return (
    <Routes>
      <Route path="/" element={<Layout user={user} />}>
        <Route 
          index 
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <HomePage />} 
        />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <DashboardPage user={user} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/analyze" 
          element={isAuthenticated ? <AnalyzePage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/interview" 
          element={isAuthenticated ? <InterviewPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/results" 
          element={isAuthenticated ? <ResultsPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/settings" 
          element={isAuthenticated ? <SettingsPage user={user} /> : <Navigate to="/" />} 
        />
      </Route>
    </Routes>
  )
}

export default App