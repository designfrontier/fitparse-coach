import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import './DashboardPage.css'

const DashboardPage = ({ user }) => {
  const [latestAnalysis, setLatestAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestAnalysis()
  }, [])

  const fetchLatestAnalysis = async () => {
    try {
      const response = await fetch('/api/ai-analysis/latest', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setLatestAnalysis(data)
      }
    } catch (error) {
      console.error('Failed to fetch latest analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="dashboard-page">
      <div className="main">
        <div className="welcome-card">
          <h1>Welcome back, {user.firstname}!</h1>
          <p>
            Strava Coach helps you analyze your cycling training data and generate
            comprehensive reports for AI coaching analysis. Select an option below to get started.
          </p>
        </div>

        {latestAnalysis && (
          <div className="latest-analysis-card">
            <h2>📝 Latest AI Analysis</h2>
            <div className="analysis-header">
              <span className="analysis-date">
                Week of {formatDate(latestAnalysis.weekStartDate)} - {formatDate(latestAnalysis.weekEndDate)}
              </span>
              <Link to="/analysis" className="view-all-link">View All Analyses →</Link>
            </div>
            <div className="analysis-content">
              <ReactMarkdown>
                {latestAnalysis.aiResponse.substring(0, 300) + '...'}
              </ReactMarkdown>
            </div>
            <Link to={`/analysis/${latestAnalysis.id}`} className="btn-secondary">
              Read Full Analysis
            </Link>
          </div>
        )}
        
        <div className="action-cards">
          <div className="action-card">
            <h2>📊 Weekly Analysis</h2>
            <p>
              Analyze your rides from a specific date range. Get detailed metrics including 
              power zones, heart rate analysis, TSS, and interval breakdowns.
            </p>
            <Link to="/analyze" className="btn-primary">Start Analysis</Link>
          </div>
          
          <div className="action-card">
            <h2>📈 Quick Stats</h2>
            <p>
              View a quick summary of your recent training including last week's totals, 
              current fitness trends, and upcoming goals.
            </p>
            <Link to="/quick-stats" className="btn-primary">View Stats</Link>
          </div>
          
          <div className="action-card">
            <h2>🎯 Training Goals</h2>
            <p>
              Set and track your training goals. Monitor progress towards your target 
              TSS, distance, or time objectives.
            </p>
            <Link to="/training-goals" className="btn-primary">Set Goals</Link>
          </div>
        </div>
        
        <div className="settings-info">
          <h3>Current Training Parameters</h3>
          <div className="settings-values">
            <div className="setting-item">
              <strong>FTP:</strong> {user.ftp || 250}W
            </div>
            <div className="setting-item">
              <strong>Max HR:</strong> {user.hrmax || 180} bpm
            </div>
            <div className="setting-item">
              <strong>Zones:</strong> 6 Power / 5 Heart Rate
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage