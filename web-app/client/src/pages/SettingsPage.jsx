import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import './SettingsPage.css'

const SettingsPage = ({ user }) => {
  const [zones, setZones] = useState({ power: [], hr: [] })
  const queryClient = useQueryClient()
  
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      ftp: user?.ftp || 250,
      hrmax: user?.hrmax || 180
    }
  })

  const ftp = watch('ftp')
  const hrmax = watch('hrmax')

  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user)
      toast.success('Settings updated successfully!')
    },
    onError: (error) => {
      toast.error('Failed to update settings')
      console.error('Settings error:', error)
    }
  })

  const calculateZones = (ftpValue, hrmaxValue) => {
    const powerZones = [
      { name: 'Z1 Recovery', range: `< ${Math.round(ftpValue * 0.55)}W`, percent: '< 55%' },
      { name: 'Z2 Endurance', range: `${Math.round(ftpValue * 0.55)}-${Math.round(ftpValue * 0.75)}W`, percent: '55-75%' },
      { name: 'Z3 Tempo', range: `${Math.round(ftpValue * 0.76)}-${Math.round(ftpValue * 0.90)}W`, percent: '76-90%' },
      { name: 'Z4 Threshold', range: `${Math.round(ftpValue * 0.91)}-${Math.round(ftpValue * 1.05)}W`, percent: '91-105%' },
      { name: 'Z5 VO2Max', range: `${Math.round(ftpValue * 1.06)}-${Math.round(ftpValue * 1.20)}W`, percent: '106-120%' },
      { name: 'Z6+ Neuromuscular', range: `> ${Math.round(ftpValue * 1.20)}W`, percent: '> 120%' }
    ]

    const hrZones = [
      { name: 'Z1 Recovery', range: `< ${Math.round(hrmaxValue * 0.6)} BPM`, percent: '< 60%' },
      { name: 'Z2 Aerobic', range: `${Math.round(hrmaxValue * 0.6)}-${Math.round(hrmaxValue * 0.7)} BPM`, percent: '60-70%' },
      { name: 'Z3 Aerobic', range: `${Math.round(hrmaxValue * 0.7)}-${Math.round(hrmaxValue * 0.8)} BPM`, percent: '70-80%' },
      { name: 'Z4 Threshold', range: `${Math.round(hrmaxValue * 0.8)}-${Math.round(hrmaxValue * 0.9)} BPM`, percent: '80-90%' },
      { name: 'Z5 VO2Max', range: `${Math.round(hrmaxValue * 0.9)}-${hrmaxValue} BPM`, percent: '90-100%' }
    ]

    setZones({ power: powerZones, hr: hrZones })
  }

  useEffect(() => {
    calculateZones(ftp || 250, hrmax || 180)
  }, [ftp, hrmax])

  const onSubmit = (data) => {
    updateMutation.mutate({
      ftp: parseInt(data.ftp),
      hrmax: parseInt(data.hrmax)
    })
  }

  return (
    <div className="settings-page">
      <div className="main">
        <div className="settings-card">
          <h1>⚙️ Training Settings</h1>
          <p className="subtitle">
            Configure your personal training parameters. These values are used to calculate 
            power zones, training stress score (TSS), and intensity factors.
          </p>
          
          <div className="current-values">
            <h3>Current Values</h3>
            <div className="value-display">
              <div className="value-item">
                <div className="value-number">{user?.ftp || 250}</div>
                <div className="value-label">Watts (FTP)</div>
              </div>
              <div className="value-item">
                <div className="value-number">{user?.hrmax || 180}</div>
                <div className="value-label">BPM (HR Max)</div>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-section">
              <div className="section-title">🚴 Power Settings</div>
              
              <div className="info-box">
                <h3>Functional Threshold Power (FTP)</h3>
                <p>
                  Your FTP is the highest power you can sustain for one hour. This is used to 
                  calculate power zones and training intensity. If you're unsure, use a recent 
                  20-minute test result × 0.95, or your best 1-hour power.
                </p>
              </div>
              
              <div className="form-group">
                <label htmlFor="ftp">⚡ Functional Threshold Power</label>
                <p className="help-text">Your sustained power for 1 hour</p>
                <div className="input-container">
                  <input 
                    type="number" 
                    id="ftp" 
                    {...register('ftp', { required: true, min: 50, max: 600 })}
                  />
                  <span className="input-unit">W</span>
                </div>
              </div>
              
              <div className="zone-reference">
                <h4>Power Zones (based on current FTP)</h4>
                <div className="zones">
                  {zones.power.map((zone, i) => (
                    <div key={i} className="zone-item">
                      <span className="zone-name">{zone.name}</span>
                      <span>{zone.range} ({zone.percent})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="form-section">
              <div className="section-title">❤️ Heart Rate Settings</div>
              
              <div className="info-box">
                <h3>Maximum Heart Rate (HR Max)</h3>
                <p>
                  Your maximum heart rate is used to calculate heart rate zones. Use your 
                  highest recorded heart rate from recent hard efforts, or estimate using 
                  220 - your age (less accurate but acceptable).
                </p>
              </div>
              
              <div className="form-group">
                <label htmlFor="hrmax">💗 Maximum Heart Rate</label>
                <p className="help-text">Your highest recorded heart rate</p>
                <div className="input-container">
                  <input 
                    type="number" 
                    id="hrmax" 
                    {...register('hrmax', { required: true, min: 120, max: 220 })}
                  />
                  <span className="input-unit">BPM</span>
                </div>
              </div>
              
              <div className="zone-reference">
                <h4>Heart Rate Zones (based on current HR Max)</h4>
                <div className="zones">
                  {zones.hr.map((zone, i) => (
                    <div key={i} className="zone-item">
                      <span className="zone-name">{zone.name}</span>
                      <span>{zone.range} ({zone.percent})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="submit-section">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={updateMutation.isLoading}
              >
                {updateMutation.isLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage