import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import './TrainingGoalsPage.css'

const TrainingGoalsPage = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('weekly')
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  // Fetch current goals
  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: api.getGoals,
  })

  // Save goals mutation
  const saveGoalsMutation = useMutation({
    mutationFn: api.saveGoals,
    onSuccess: () => {
      toast.success('Goals saved successfully!')
      queryClient.invalidateQueries(['goals'])
    },
    onError: (error) => {
      toast.error('Failed to save goals')
      console.error('Save goals error:', error)
    }
  })

  const onSubmit = (data) => {
    const goalData = {
      ...data,
      type: activeTab,
      createdAt: new Date().toISOString()
    }
    saveGoalsMutation.mutate(goalData)
    reset()
  }

  if (isLoading) {
    return <LoadingSpinner text="Loading goals..." />
  }

  const weeklyGoals = goals?.filter(g => g.type === 'weekly') || []
  const monthlyGoals = goals?.filter(g => g.type === 'monthly') || []
  const seasonGoals = goals?.filter(g => g.type === 'season') || []

  return (
    <div className="training-goals-page">
      <div className="container">
        <h1>🎯 Training Goals</h1>
        <p className="subtitle">Set and track your cycling training objectives</p>

        <div className="goals-tabs">
          <button 
            className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            Weekly Goals
          </button>
          <button 
            className={`tab ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            Monthly Goals
          </button>
          <button 
            className={`tab ${activeTab === 'season' ? 'active' : ''}`}
            onClick={() => setActiveTab('season')}
          >
            Season Goals
          </button>
        </div>

        <div className="goals-content">
          <div className="add-goal-section">
            <h3>Add New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Goal</h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="goal-form">
              <div className="form-group">
                <label htmlFor="title">Goal Title</label>
                <input 
                  type="text" 
                  id="title"
                  {...register('title', { required: 'Goal title is required' })}
                  placeholder="e.g., Increase FTP by 10 watts"
                />
                {errors.title && <span className="error">{errors.title.message}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea 
                  id="description"
                  {...register('description')}
                  placeholder="Describe your goal in detail..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <select 
                    id="category"
                    {...register('category', { required: 'Please select a category' })}
                  >
                    <option value="">Select category...</option>
                    <option value="power">Power/FTP</option>
                    <option value="endurance">Endurance</option>
                    <option value="speed">Speed</option>
                    <option value="climbing">Climbing</option>
                    <option value="recovery">Recovery</option>
                    <option value="weight">Weight Management</option>
                    <option value="race">Race Preparation</option>
                    <option value="technique">Technique</option>
                  </select>
                  {errors.category && <span className="error">{errors.category.message}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="targetValue">Target Value</label>
                  <input 
                    type="text" 
                    id="targetValue"
                    {...register('targetValue')}
                    placeholder="e.g., 250W, 5 hours, 3x/week"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="deadline">Target Date</label>
                <input 
                  type="date" 
                  id="deadline"
                  {...register('deadline')}
                />
              </div>

              <button 
                type="submit" 
                className="btn-submit"
                disabled={saveGoalsMutation.isLoading}
              >
                {saveGoalsMutation.isLoading ? 'Saving...' : 'Add Goal'}
              </button>
            </form>
          </div>

          <div className="current-goals-section">
            <h3>Current {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Goals</h3>
            
            {activeTab === 'weekly' && (
              <div className="goals-list">
                {weeklyGoals.length === 0 ? (
                  <div className="no-goals">
                    <p>No weekly goals set yet. Add your first goal above!</p>
                  </div>
                ) : (
                  weeklyGoals.map((goal, index) => (
                    <div key={index} className="goal-card">
                      <div className="goal-header">
                        <h4>{goal.title}</h4>
                        <span className={`goal-category ${goal.category}`}>{goal.category}</span>
                      </div>
                      {goal.description && <p className="goal-description">{goal.description}</p>}
                      <div className="goal-details">
                        {goal.targetValue && <span className="target">Target: {goal.targetValue}</span>}
                        {goal.deadline && <span className="deadline">Due: {new Date(goal.deadline).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'monthly' && (
              <div className="goals-list">
                {monthlyGoals.length === 0 ? (
                  <div className="no-goals">
                    <p>No monthly goals set yet. Add your first goal above!</p>
                  </div>
                ) : (
                  monthlyGoals.map((goal, index) => (
                    <div key={index} className="goal-card">
                      <div className="goal-header">
                        <h4>{goal.title}</h4>
                        <span className={`goal-category ${goal.category}`}>{goal.category}</span>
                      </div>
                      {goal.description && <p className="goal-description">{goal.description}</p>}
                      <div className="goal-details">
                        {goal.targetValue && <span className="target">Target: {goal.targetValue}</span>}
                        {goal.deadline && <span className="deadline">Due: {new Date(goal.deadline).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'season' && (
              <div className="goals-list">
                {seasonGoals.length === 0 ? (
                  <div className="no-goals">
                    <p>No season goals set yet. Add your first goal above!</p>
                  </div>
                ) : (
                  seasonGoals.map((goal, index) => (
                    <div key={index} className="goal-card">
                      <div className="goal-header">
                        <h4>{goal.title}</h4>
                        <span className={`goal-category ${goal.category}`}>{goal.category}</span>
                      </div>
                      {goal.description && <p className="goal-description">{goal.description}</p>}
                      <div className="goal-details">
                        {goal.targetValue && <span className="target">Target: {goal.targetValue}</span>}
                        {goal.deadline && <span className="deadline">Due: {new Date(goal.deadline).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingGoalsPage