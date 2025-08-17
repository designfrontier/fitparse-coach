import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5555',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth
export const getCurrentUser = async () => {
  const response = await api.get('/api/user')
  return response.data
}

export const logout = async () => {
  await api.post('/api/logout')
}

// Activities
export const analyzeActivities = async (dateRange) => {
  const response = await api.post('/api/analyze', dateRange)
  return response.data
}

export const submitInterview = async (responses) => {
  const response = await api.post('/api/interview', responses)
  return response.data
}

// Settings
export const updateSettings = async (settings) => {
  const response = await api.put('/api/settings', settings)
  return response.data
}

// Config
export const getConfig = async () => {
  const response = await api.get('/api/config')
  return response.data
}

export const setConfig = async (config) => {
  const response = await api.post('/api/config', config)
  return response.data
}

// Goals
export const getGoals = async () => {
  const response = await api.get('/api/goals')
  return response.data
}

export const saveGoals = async (goal) => {
  const response = await api.post('/api/goals', goal)
  return response.data
}

// Quick Stats
export const getQuickStats = async (dateRange) => {
  const response = await api.post('/api/quick-stats', dateRange)
  return response.data
}

export default {
  getCurrentUser,
  logout,
  analyzeActivities,
  submitInterview,
  updateSettings,
  getConfig,
  setConfig,
  getGoals,
  saveGoals,
  getQuickStats,
}