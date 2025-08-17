import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import './QuickStatsPage.css'

const QuickStatsPage = () => {
  const [timeframe, setTimeframe] = useState('week')
  
  // Calculate date ranges
  const getDateRange = (period) => {
    const now = new Date()
    switch (period) {
      case 'week':
        return {
          start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        }
      case 'month':
        return {
          start: format(subDays(now, 30), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        }
      case 'year':
        return {
          start: format(subDays(now, 365), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        }
      default:
        return {
          start: format(subDays(now, 7), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        }
    }
  }

  const dateRange = getDateRange(timeframe)

  // Fetch quick stats
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['quickStats', timeframe, dateRange],
    queryFn: () => api.getQuickStats(dateRange),
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return <LoadingSpinner text="Loading your stats..." />
  }

  if (error) {
    return (
      <div className="quick-stats-page">
        <div className="container">
          <div className="error-state">
            <h2>Unable to load stats</h2>
            <p>Make sure you're connected to Strava and have recent activities.</p>
          </div>
        </div>
      </div>
    )
  }

  const {
    totalActivities = 0,
    totalTime = 0,
    totalDistance = 0,
    totalElevation = 0,
    totalTSS = 0,
    avgPower = 0,
    maxPower = 0,
    avgHeartRate = 0,
    maxHeartRate = 0,
    avgSpeed = 0,
    maxSpeed = 0,
    recentActivities = [],
    powerZoneDistribution = {},
    hrZoneDistribution = {}
  } = stats || {}

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatSpeed = (metersPerSecond) => {
    return (metersPerSecond * 3.6).toFixed(1) // Convert to km/h
  }

  return (
    <div className="quick-stats-page">
      <div className="container">
        <div className="header">
          <h1>📊 Quick Stats</h1>
          <p className="subtitle">Your cycling performance at a glance</p>
          
          <div className="timeframe-selector">
            <button 
              className={`timeframe-btn ${timeframe === 'week' ? 'active' : ''}`}
              onClick={() => setTimeframe('week')}
            >
              This Week
            </button>
            <button 
              className={`timeframe-btn ${timeframe === 'month' ? 'active' : ''}`}
              onClick={() => setTimeframe('month')}
            >
              Last 30 Days
            </button>
            <button 
              className={`timeframe-btn ${timeframe === 'year' ? 'active' : ''}`}
              onClick={() => setTimeframe('year')}
            >
              Last Year
            </button>
          </div>
        </div>

        <div className="stats-grid">
          {/* Overview Cards */}
          <div className="stat-card overview">
            <div className="stat-icon">🚴</div>
            <div className="stat-content">
              <h3>Rides</h3>
              <div className="stat-value">{totalActivities}</div>
              <div className="stat-label">activities</div>
            </div>
          </div>

          <div className="stat-card overview">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <h3>Time</h3>
              <div className="stat-value">{formatTime(totalTime)}</div>
              <div className="stat-label">total time</div>
            </div>
          </div>

          <div className="stat-card overview">
            <div className="stat-icon">📏</div>
            <div className="stat-content">
              <h3>Distance</h3>
              <div className="stat-value">{totalDistance.toFixed(1)}</div>
              <div className="stat-label">km</div>
            </div>
          </div>

          <div className="stat-card overview">
            <div className="stat-icon">⛰️</div>
            <div className="stat-content">
              <h3>Elevation</h3>
              <div className="stat-value">{Math.round(totalElevation)}</div>
              <div className="stat-label">meters</div>
            </div>
          </div>

          {/* Power Stats */}
          <div className="stat-card power">
            <h3>💪 Power</h3>
            <div className="stat-row">
              <span>Average Power:</span>
              <span className="value">{Math.round(avgPower)}W</span>
            </div>
            <div className="stat-row">
              <span>Max Power:</span>
              <span className="value">{Math.round(maxPower)}W</span>
            </div>
            <div className="stat-row">
              <span>Total TSS:</span>
              <span className="value">{Math.round(totalTSS)}</span>
            </div>
          </div>

          {/* Heart Rate Stats */}
          <div className="stat-card heartrate">
            <h3>❤️ Heart Rate</h3>
            <div className="stat-row">
              <span>Average HR:</span>
              <span className="value">{Math.round(avgHeartRate)} bpm</span>
            </div>
            <div className="stat-row">
              <span>Max HR:</span>
              <span className="value">{Math.round(maxHeartRate)} bpm</span>
            </div>
          </div>

          {/* Speed Stats */}
          <div className="stat-card speed">
            <h3>🏃 Speed</h3>
            <div className="stat-row">
              <span>Average Speed:</span>
              <span className="value">{formatSpeed(avgSpeed)} km/h</span>
            </div>
            <div className="stat-row">
              <span>Max Speed:</span>
              <span className="value">{formatSpeed(maxSpeed)} km/h</span>
            </div>
          </div>

          {/* Power Zones */}
          {Object.keys(powerZoneDistribution).length > 0 && (
            <div className="stat-card zones power-zones">
              <h3>⚡ Power Zone Distribution</h3>
              <div className="zone-bars">
                {Object.entries(powerZoneDistribution).map(([zone, time]) => (
                  <div key={zone} className="zone-bar">
                    <div className="zone-label">{zone}</div>
                    <div className="zone-progress">
                      <div 
                        className="zone-fill" 
                        style={{ 
                          width: `${Math.min((time / Math.max(...Object.values(powerZoneDistribution))) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <div className="zone-time">{time.toFixed(1)}min</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HR Zones */}
          {Object.keys(hrZoneDistribution).length > 0 && (
            <div className="stat-card zones hr-zones">
              <h3>💓 HR Zone Distribution</h3>
              <div className="zone-bars">
                {Object.entries(hrZoneDistribution).map(([zone, time]) => (
                  <div key={zone} className="zone-bar">
                    <div className="zone-label">{zone}</div>
                    <div className="zone-progress">
                      <div 
                        className="zone-fill hr" 
                        style={{ 
                          width: `${Math.min((time / Math.max(...Object.values(hrZoneDistribution))) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <div className="zone-time">{time.toFixed(1)}min</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activities */}
          {recentActivities.length > 0 && (
            <div className="stat-card recent-activities">
              <h3>🕒 Recent Activities</h3>
              <div className="activity-list">
                {recentActivities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-name">{activity.name}</div>
                    <div className="activity-details">
                      <span>{new Date(activity.startDate).toLocaleDateString()}</span>
                      <span>{activity.distanceKm?.toFixed(1)}km</span>
                      <span>{Math.round(activity.durationSec / 60)}min</span>
                      {activity.avgPower && <span>{Math.round(activity.avgPower)}W</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {totalActivities === 0 && (
          <div className="empty-state">
            <h2>No activities found</h2>
            <p>No cycling activities found for the selected time period. Try selecting a different timeframe or make sure your Strava account has recent rides.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuickStatsPage