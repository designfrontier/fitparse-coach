import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import './AnalyzePage.css'

const AnalyzePage = () => {
  const navigate = useNavigate()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    }
  })

  const analyzeMutation = useMutation({
    mutationFn: api.analyzeActivities,
    onSuccess: (data) => {
      toast.success(`Found ${data.activities} activities!`)
      navigate('/interview')
    },
    onError: (error) => {
      toast.error('Failed to analyze activities')
      console.error('Analysis error:', error)
    },
    onSettled: () => {
      setIsAnalyzing(false)
    }
  })

  const onSubmit = (data) => {
    setIsAnalyzing(true)
    analyzeMutation.mutate(data)
  }

  const setQuickDates = (days) => {
    const end = new Date()
    const start = subDays(end, days)
    setValue('startDate', format(start, 'yyyy-MM-dd'))
    setValue('endDate', format(end, 'yyyy-MM-dd'))
  }

  if (isAnalyzing) {
    return (
      <div className="analyze-page">
        <div className="main">
          <div className="form-card">
            <LoadingSpinner size="large" text="Fetching activities from Strava..." />
            <p style={{ textAlign: 'center', marginTop: '16px', color: '#666' }}>
              This may take a moment while we analyze your rides...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="analyze-page">
      <div className="main">
        <div className="form-card">
          <h1>Select Date Range</h1>
          <p className="subtitle">Choose the period you want to analyze</p>
          
          <div className="info-box">
            <p>
              Select your training period below. The app will fetch all your cycling activities 
              from Strava and generate a comprehensive analysis including power zones, TSS, 
              heart rate metrics, and more.
            </p>
          </div>
          
          <div className="quick-select">
            <h3>Quick Select</h3>
            <div className="quick-buttons">
              <button type="button" className="quick-btn" onClick={() => setQuickDates(7)}>
                Last 7 Days
              </button>
              <button type="button" className="quick-btn" onClick={() => setQuickDates(14)}>
                Last 14 Days
              </button>
              <button type="button" className="quick-btn" onClick={() => setQuickDates(30)}>
                Last 30 Days
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="date-selector">
              <div className="form-group">
                <label htmlFor="startDate">Start Date</label>
                <input 
                  type="date" 
                  id="startDate" 
                  {...register('startDate', { required: true })}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="endDate">End Date</label>
                <input 
                  type="date" 
                  id="endDate" 
                  {...register('endDate', { required: true })}
                />
              </div>
            </div>
            
            <div className="submit-section">
              <button 
                type="submit" 
                className="btn-submit"
                disabled={analyzeMutation.isLoading}
              >
                {analyzeMutation.isLoading ? 'Fetching Activities...' : 'Fetch Activities'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AnalyzePage