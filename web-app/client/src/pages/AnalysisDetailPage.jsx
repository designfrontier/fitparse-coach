import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'
import './AnalysisDetailPage.css'

const AnalysisDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAnalysis()
  }, [id])

  const fetchAnalysis = async () => {
    try {
      const response = await fetch(`/api/ai-analysis/${id}`, {
        credentials: 'include'
      })

      if (response.status === 404) {
        setError('Analysis not found')
      } else if (response.ok) {
        const data = await response.json()
        setAnalysis(data)
      } else {
        setError('Failed to load analysis')
      }
    } catch (error) {
      console.error('Failed to fetch analysis:', error)
      setError('Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }

  const deleteAnalysis = async () => {
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
        navigate('/analysis')
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
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="analysis-detail-page">
        <div className="main">
          <LoadingSpinner size="large" text="Loading analysis..." />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="analysis-detail-page">
        <div className="main">
          <div className="error-container">
            <h1>⚠️ {error}</h1>
            <p>The analysis you're looking for could not be found.</p>
            <Link to="/analysis" className="btn-primary">Back to All Analyses</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  return (
    <div className="analysis-detail-page">
      <div className="main">
        <div className="analysis-header">
          <Link to="/analysis" className="back-link">← Back to All Analyses</Link>
          <button onClick={deleteAnalysis} className="btn-delete">
            Delete Analysis
          </button>
        </div>

        <div className="analysis-detail-card">
          <div className="analysis-meta">
            <h1>Week of {formatDate(analysis.weekStartDate)}</h1>
            <p className="date-range">
              {formatDate(analysis.weekStartDate)} - {formatDate(analysis.weekEndDate)}
            </p>
            {analysis.createdAt && (
              <p className="created-date">
                Created on {formatDate(analysis.createdAt)}
              </p>
            )}
          </div>

          <div className="analysis-content">
            <h2>AI Analysis</h2>
            <div className="markdown-content">
              <ReactMarkdown>{analysis.aiResponse}</ReactMarkdown>
            </div>
          </div>

          {analysis.weekData && (
            <details className="week-data-section">
              <summary>View Original Week Data</summary>
              <div className="week-data-content">
                <pre>{typeof analysis.weekData === 'string' ? analysis.weekData : JSON.stringify(analysis.weekData, null, 2)}</pre>
              </div>
            </details>
          )}
        </div>

        <div className="analysis-footer">
          <Link to="/analysis" className="btn-secondary">Back to All Analyses</Link>
          <Link to="/analyze" className="btn-primary">New Analysis</Link>
        </div>
      </div>
    </div>
  )
}

export default AnalysisDetailPage