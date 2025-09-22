import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'
import './AnalysisHistoryPage.css'

const AnalysisHistoryPage = () => {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalyses()
  }, [])

  const fetchAnalyses = async () => {
    try {
      const response = await fetch('/api/ai-analysis', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setAnalyses(data)
      } else {
        toast.error('Failed to fetch analyses')
      }
    } catch (error) {
      console.error('Failed to fetch analyses:', error)
      toast.error('Failed to fetch analyses')
    } finally {
      setLoading(false)
    }
  }

  const deleteAnalysis = async (id) => {
    if (!window.confirm('Are you sure you want to delete this analysis?')) {
      return
    }

    try {
      const response = await fetch(`/api/ai-analysis/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (response.ok) {
        toast.success('Analysis deleted successfully')
        setAnalyses(analyses.filter(a => a.id !== id))
      } else {
        toast.error('Failed to delete analysis')
      }
    } catch (error) {
      console.error('Failed to delete analysis:', error)
      toast.error('Failed to delete analysis')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }


  if (loading) {
    return (
      <div className="analysis-history-page">
        <div className="main">
          <LoadingSpinner size="large" text="Loading analyses..." />
        </div>
      </div>
    )
  }

  return (
    <div className="analysis-history-page">
      <div className="main">
        <div className="page-header">
          <h1>AI Analysis History</h1>
          <Link to="/analyze" className="btn-primary">New Analysis</Link>
        </div>

        {analyses.length === 0 ? (
          <div className="empty-state">
            <h2>No analyses yet</h2>
            <p>Run your first weekly analysis to see AI coaching insights here.</p>
            <Link to="/analyze" className="btn-primary">Start Analysis</Link>
          </div>
        ) : (
          <div className="analyses-grid">
            {analyses.map((analysis) => (
              <div key={analysis.id} className="analysis-card">
                <div className="analysis-card-header">
                  <h3>Week of {formatDate(analysis.weekStartDate)}</h3>
                  <span className="analysis-date">
                    {formatDate(analysis.weekStartDate)} - {formatDate(analysis.weekEndDate)}
                  </span>
                </div>
                <div className="analysis-card-content">
                  <p className="analysis-preview">
                    {analysis.aiResponse.substring(0, 200)}...
                  </p>
                </div>
                <div className="analysis-card-footer">
                  <Link
                    to={`/analysis/${analysis.id}`}
                    className="btn-view"
                  >
                    View Full Analysis
                  </Link>
                  <button
                    onClick={() => deleteAnalysis(analysis.id)}
                    className="btn-delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalysisHistoryPage