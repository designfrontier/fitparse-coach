import React from 'react'
import './HomePage.css'

const HomePage = () => {
  const handleConnectStrava = () => {
    window.location.href = '/auth/strava'
  }

  return (
    <div className="home-page">
      <div className="container">
        <h1>🚴 Strava Coach</h1>
        <p className="subtitle">AI-Powered Training Analysis</p>
        
        <div className="features">
          <h3>What this app does:</h3>
          <ul>
            <li>Connects to your Strava account</li>
            <li>Analyzes your cycling activities</li>
            <li>Calculates power zones & training stress</li>
            <li>Tracks heart rate zones & drift</li>
            <li>Generates weekly training summaries</li>
            <li>Formats data for AI coaching analysis</li>
          </ul>
        </div>
        
        <button onClick={handleConnectStrava} className="btn-strava">
          Connect with Strava
        </button>
        
        <div className="settings">
          <p className="settings-note">Default Training Settings:</p>
          <div className="config-values">
            FTP: 250W | HR Max: 180bpm (customizable after login)
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage