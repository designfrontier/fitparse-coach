import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import api from '../services/api'
import './ResultsPage.css'

const ResultsPage = () => {
  const location = useLocation()
  const [copyText, setCopyText] = useState('Copy to Clipboard')
  const [copyIcon, setCopyIcon] = useState('📋')
  const [aiResponse, setAiResponse] = useState(null)
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const output = location.state?.output || 'No report available. Please complete the analysis process.'
  const weekData = location.state?.weekData || null

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopyText('Copied!')
      setCopyIcon('✓')
      toast.success('Report copied to clipboard!')
      
      setTimeout(() => {
        setCopyText('Copy to Clipboard')
        setCopyIcon('📋')
      }, 2000)
    } catch (err) {
      toast.error('Failed to copy. Please select the text manually.')
    }
  }

  const downloadReport = () => {
    const blob = new Blob([output], { type: 'text/markdown' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-report-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Report downloaded!')
  }

  const sendToAICoach = async () => {
    setIsLoadingAI(true)
    try {
      const response = await api.sendCoachingMessage({
        message: `Please analyze this training report and provide coaching feedback:\n\n${output}`,
        includeRecentData: false
      })
      setAiResponse(response.response)
      toast.success('AI coaching analysis complete!')
    } catch (error) {
      console.error('AI coaching error:', error)
      toast.error('Failed to get AI coaching analysis. Please check your API key settings.')
    } finally {
      setIsLoadingAI(false)
    }
  }

  const saveAIAnalysis = async () => {
    if (!aiResponse) {
      toast.error('No AI analysis to save')
      return
    }

    setIsSaving(true)
    try {
      // Extract week dates from the output or use defaults
      const today = new Date()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - 7)

      const payload = {
        weekStartDate: weekStart.toISOString(),
        weekEndDate: today.toISOString(),
        weekData: output,
        aiResponse: aiResponse
      }

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success('Analysis saved successfully!')
      } else {
        throw new Error('Failed to save analysis')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save AI analysis')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="results-page">
      <div className="main">
        <div className="results-card">
          <h1>🎉 Analysis Complete!</h1>
          <p className="subtitle">Your training data has been analyzed and formatted for AI coaching</p>
          
          <div className="success-message">
            <span>✅</span>
            <span>Your training report is ready to copy and paste into ChatGPT or Claude</span>
          </div>
          
          <div className="copy-instructions">
            <h3>📋 How to use this report:</h3>
            <ol>
              <li>Click the "Copy to Clipboard" button below</li>
              <li>Open ChatGPT, Claude, or your preferred AI assistant</li>
              <li>Paste the report and ask for coaching feedback</li>
              <li>Consider asking specific questions about your training</li>
            </ol>
          </div>
          
          <div className="output-container">
            <button className="copy-button" onClick={copyToClipboard}>
              <span>{copyIcon}</span>
              <span>{copyText}</span>
            </button>
            <pre className="output-content">{output}</pre>
          </div>
          
          <div className="action-buttons">
            <div className="btn-group">
              <Link to="/analyze" className="btn btn-secondary">← New Analysis</Link>
              <Link to="/dashboard" className="btn btn-secondary">Dashboard</Link>
            </div>
            <div className="btn-group">
              <button onClick={downloadReport} className="btn btn-primary">
                💾 Download Report
              </button>
              <button 
                onClick={sendToAICoach} 
                className="btn btn-ai"
                disabled={isLoadingAI}
              >
                {isLoadingAI ? '🔄 Analyzing...' : '🤖 Send to AI Coach'}
              </button>
            </div>
          </div>
          
          {aiResponse && (
            <div className="ai-response">
              <h3>🤖 AI Coaching Analysis</h3>
              <div className="ai-content markdown-content">
                <ReactMarkdown>{aiResponse}</ReactMarkdown>
              </div>
              <div className="ai-actions">
                <button
                  className="copy-button-small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(aiResponse)
                      toast.success('AI response copied!')
                    } catch (err) {
                      toast.error('Failed to copy')
                    }
                  }}
                >
                  📋 Copy AI Response
                </button>
                <button
                  className="save-button-small"
                  onClick={saveAIAnalysis}
                  disabled={isSaving}
                >
                  {isSaving ? '💾 Saving...' : '💾 Save Analysis'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResultsPage