import React from 'react'
import { Link } from 'react-router-dom'
import './DashboardPage.css'

const DashboardPage = ({ user }) => {
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
            <Link to="/analyze?quick=true" className="btn-primary">View Stats</Link>
          </div>
          
          <div className="action-card">
            <h2>🎯 Training Goals</h2>
            <p>
              Set and track your training goals. Monitor progress towards your target 
              TSS, distance, or time objectives.
            </p>
            <Link to="/analyze" className="btn-primary">Set Goals</Link>
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