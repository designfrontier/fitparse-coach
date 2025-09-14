import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAPIConfig } from '../../config';

// Get API configuration based on environment
const apiConfig = getAPIConfig();

const api = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeout,
});

// Log the API URL for debugging
if (__DEV__) {
  console.log('API Base URL:', apiConfig.baseURL);
}

// Request interceptor to add auth headers
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const getCurrentUser = async () => {
  const response = await api.get('/api/user');
  return response.data;
};

export const checkAuthStatus = async () => {
  const response = await api.get('/api/auth/status');
  return response.data;
};

export const authenticateWithToken = async (token) => {
  const response = await api.post('/api/auth/mobile', { token });
  return response.data;
};

export const logout = async () => {
  await api.post('/api/logout');
  await AsyncStorage.removeItem('authToken');
  await AsyncStorage.removeItem('user');
};

// Activity Analysis API
export const analyzeActivities = async (data) => {
  const response = await api.post('/api/analyze', data);
  return response.data;
};

export const submitInterview = async (answers) => {
  const response = await api.post('/api/interview', answers);
  return response.data;
};

// Settings API
export const updateSettings = async (settings) => {
  const response = await api.put('/api/settings', settings);
  return response.data;
};

// Config API
export const getConfig = async () => {
  const response = await api.get('/api/config');
  return response.data;
};

export const setConfig = async (config) => {
  const response = await api.post('/api/config', config);
  return response.data;
};

// Goals API
export const getGoals = async () => {
  const response = await api.get('/api/goals');
  return response.data;
};

export const createGoal = async (goal) => {
  const response = await api.post('/api/goals', goal);
  return response.data;
};

export const updateGoal = async (id, goal) => {
  const response = await api.put(`/api/goals/${id}`, goal);
  return response.data;
};

export const deleteGoal = async (id) => {
  const response = await api.delete(`/api/goals/${id}`);
  return response.data;
};

// Quick Stats API
export const getStats = async (period) => {
  const response = await api.get(`/api/stats/${period}`);
  return response.data;
};

export const getQuickStats = async (dateRange) => {
  const response = await api.post('/api/quick-stats', dateRange);
  return response.data;
};

// Send to AI API
export const sendToAI = async (data) => {
  const response = await api.post('/api/send-to-ai', data);
  return response.data;
};

// AI Coaching API
export const sendCoachingMessage = async (data) => {
  const response = await api.post('/api/coach/message', data);
  return response.data;
};

export const analyzeWorkout = async (activityId) => {
  const response = await api.post('/api/coach/analyze-workout', { activityId });
  return response.data;
};

export const clearCoachingHistory = async () => {
  const response = await api.post('/api/coach/clear-history');
  return response.data;
};

export const updateCoachingSettings = async (settings) => {
  const response = await api.put('/api/coach/settings', settings);
  return response.data;
};

// Utility function to handle Strava OAuth
export const initiateStravaAuth = () => {
  // Check if this is a development build (not Expo Go)
  const isDevBuild = !__DEV__ || (typeof expo !== 'undefined' && expo.modules?.ExpoDevClient);
  const devParam = isDevBuild ? '&dev=true' : '';
  return `${apiConfig.baseURL}/auth/strava?source=mobile${devParam}`;
};

export default {
  getCurrentUser,
  checkAuthStatus,
  authenticateWithToken,
  logout,
  analyzeActivities,
  submitInterview,
  updateSettings,
  getConfig,
  setConfig,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getStats,
  getQuickStats,
  sendToAI,
  sendCoachingMessage,
  analyzeWorkout,
  clearCoachingHistory,
  updateCoachingSettings,
  initiateStravaAuth,
};