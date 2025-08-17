import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import './InterviewPage.css'

const InterviewPage = () => {
  const navigate = useNavigate()
  
  const { data: interviewData, isLoading } = useQuery({
    queryKey: ['interview'],
    queryFn: () => api.getCurrentUser().then(() => 
      fetch('/api/interview', { credentials: 'include' }).then(r => r.json())
    )
  })

  const { register, handleSubmit } = useForm()

  const submitMutation = useMutation({
    mutationFn: api.submitInterview,
    onSuccess: (data) => {
      navigate('/results', { state: { output: data.output } })
    },
    onError: (error) => {
      toast.error('Failed to generate report')
      console.error('Interview error:', error)
    }
  })

  const onSubmit = (data) => {
    submitMutation.mutate(data)
  }

  if (isLoading) {
    return <LoadingSpinner text="Loading interview..." />
  }

  if (!interviewData?.activities) {
    return (
      <div className="interview-page">
        <div className="main">
          <div className="error-card">
            <h2>No Activities Found</h2>
            <p>Please go back and analyze some activities first.</p>
            <button onClick={() => navigate('/analyze')} className="btn-primary">
              ← Back to Analysis
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="interview-page">
      <div className="main">
        <div className="activities-summary">
          <h3>📊 Activities Found: {interviewData.activities.length}</h3>
          <div className="activities-list">
            {interviewData.activities.slice(0, 5).map(activity => activity.name).join(' • ')}
            {interviewData.activities.length > 5 && ` and ${interviewData.activities.length - 5} more...`}
          </div>
        </div>
        
        <div className="form-card">
          <h1>Training Interview</h1>
          <p className="subtitle">Help us understand your training week better</p>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="section-title">Training Context</div>
            
            <div className="question-group">
              <label htmlFor="goals">What were your main training goals this week?</label>
              <p className="question-help">Describe what you were trying to achieve</p>
              <textarea 
                id="goals" 
                {...register('goals')}
                placeholder="e.g., Build endurance base, work on FTP, recovery week, prepare for event..."
              />
            </div>
            
            <div className="question-group">
              <label htmlFor="feel">How did you feel during your rides?</label>
              <p className="question-help">Describe your overall sensations and energy levels</p>
              <textarea 
                id="feel" 
                {...register('feel')}
                placeholder="e.g., Strong and powerful, tired but pushing through, legs felt heavy..."
              />
            </div>
            
            <div className="section-title">Recovery & Lifestyle</div>
            
            <div className="question-group">
              <label htmlFor="fatigue">Rate your overall fatigue level (1-10)</label>
              <p className="question-help">1 = Fresh, 10 = Exhausted</p>
              <div className="radio-group">
                {[1,2,3,4,5,6,7,8,9,10].map(i => (
                  <div key={i} className="radio-option">
                    <input 
                      type="radio" 
                      id={`fatigue${i}`} 
                      value={i} 
                      {...register('fatigue')}
                      defaultChecked={i === 5}
                    />
                    <label htmlFor={`fatigue${i}`}>{i}</label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="question-group">
              <label htmlFor="sleep">How was your sleep quality?</label>
              <textarea 
                id="sleep" 
                {...register('sleep')}
                placeholder="e.g., 7-8 hours per night, restless, very good..."
              />
            </div>
            
            <div className="question-group">
              <label htmlFor="nutrition">How was your nutrition and hydration?</label>
              <textarea 
                id="nutrition" 
                {...register('nutrition')}
                placeholder="e.g., Ate well, struggled with fueling, stayed hydrated..."
              />
            </div>
            
            <div className="question-group">
              <label htmlFor="stress">Any significant life stress or events?</label>
              <textarea 
                id="stress" 
                {...register('stress')}
                placeholder="e.g., Work was busy, family commitments, feeling relaxed..."
              />
            </div>
            
            <div className="section-title">Conditions & Performance</div>
            
            <div className="question-group">
              <label htmlFor="weather">Weather conditions during rides?</label>
              <textarea 
                id="weather" 
                {...register('weather')}
                placeholder="e.g., Hot and humid, perfect conditions, windy, indoor trainer..."
              />
            </div>
            
            <div className="question-group">
              <label htmlFor="achievements">Key achievements or breakthroughs?</label>
              <p className="question-help">What went particularly well?</p>
              <textarea 
                id="achievements" 
                {...register('achievements')}
                placeholder="e.g., New power PR, completed all intervals, felt strong on climbs..."
              />
            </div>
            
            <div className="question-group">
              <label htmlFor="challenges">Challenges or issues faced?</label>
              <p className="question-help">What didn't go as planned?</p>
              <textarea 
                id="challenges" 
                {...register('challenges')}
                placeholder="e.g., Couldn't complete workout, knee pain, missed sessions..."
              />
            </div>
            
            <div className="section-title">Looking Forward</div>
            
            <div className="question-group">
              <label htmlFor="nextWeek">What's your focus for next week?</label>
              <textarea 
                id="nextWeek" 
                {...register('nextWeek')}
                placeholder="e.g., Increase volume, recovery, specific workouts, race preparation..."
              />
            </div>
            
            <div className="submit-section">
              <button 
                type="button" 
                onClick={() => navigate('/analyze')} 
                className="btn-secondary"
              >
                ← Back
              </button>
              <button 
                type="submit" 
                className="btn-submit"
                disabled={submitMutation.isLoading}
              >
                {submitMutation.isLoading ? 'Generating Report...' : 'Generate Report →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default InterviewPage