import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import './ResultsPage.css'

const ResultsPage = () => {
  const location = useLocation()
  const [copyText, setCopyText] = useState('Copy to Clipboard')
  const [copyIcon, setCopyIcon] = useState('📋')
  
  const output = location.state?.output || 'No report available. Please complete the analysis process.'

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
            <button onClick={downloadReport} className="btn btn-primary">
              💾 Download Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultsPage