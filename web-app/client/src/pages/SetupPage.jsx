import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import './SetupPage.css'

const SetupPage = () => {
  const [isLoading, setIsLoading] = useState(false)
  
  const { register, handleSubmit, formState: { errors } } = useForm()

  const setupMutation = useMutation({
    mutationFn: api.setConfig,
    onSuccess: () => {
      toast.success('Configuration saved! Redirecting...')
      // Invalidate config query and reload page
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    },
    onError: (error) => {
      toast.error('Failed to save configuration')
      console.error('Setup error:', error)
    }
  })

  const onSubmit = (data) => {
    setupMutation.mutate({
      clientId: data.clientId,
      clientSecret: data.clientSecret
    })
  }

  return (
    <div className="setup-page">
      <div className="container">
        <h1>🚴 Strava API Setup</h1>
        
        <div className="instructions">
          <h3>How to get your Strava API credentials:</h3>
          <ol>
            <li>Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer" className="link">Strava API Settings</a></li>
            <li>Click "Create & Manage Your App"</li>
            <li>Fill in the application details:
              <ul style={{ marginTop: '8px', listStyleType: 'disc' }}>
                <li>Application Name: <code>Strava Coach</code></li>
                <li>Category: <code>Training</code></li>
                <li>Website: <code>http://localhost:5555</code></li>
                <li>Authorization Callback Domain: <code>localhost:5555</code></li>
              </ul>
            </li>
            <li>Upload any image for the logo</li>
            <li>After creating, you'll see your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
            <li>Copy and paste them below</li>
          </ol>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label htmlFor="clientId">Client ID</label>
            <input 
              type="text" 
              id="clientId" 
              {...register('clientId', { required: 'Client ID is required' })}
              placeholder="e.g., 123456"
            />
            {errors.clientId && <span className="error">{errors.clientId.message}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="clientSecret">Client Secret</label>
            <input 
              type="text" 
              id="clientSecret" 
              {...register('clientSecret', { required: 'Client Secret is required' })}
              placeholder="e.g., abc123def456..."
            />
            {errors.clientSecret && <span className="error">{errors.clientSecret.message}</span>}
          </div>
          
          <button 
            type="submit" 
            disabled={setupMutation.isLoading}
            className="btn-submit"
          >
            {setupMutation.isLoading ? 'Saving...' : 'Save and Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetupPage