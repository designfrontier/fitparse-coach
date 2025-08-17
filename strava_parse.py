#!/usr/bin/env python3
"""
Strava API version of parse script
Fetches activity data from Strava API and calculates same metrics
"""

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import json
from config import FTP, HRMAX

class StravaParser:
    def __init__(self, access_token):
        self.access_token = access_token
        self.base_url = "https://www.strava.com/api/v3"
        self.headers = {'Authorization': f'Bearer {access_token}'}
    
    def get_activity_details(self, activity_id):
        """Get activity summary data"""
        url = f"{self.base_url}/activities/{activity_id}"
        response = requests.get(url, headers=self.headers)
        return response.json()
    
    def get_activity_streams(self, activity_id):
        """Get detailed second-by-second streams"""
        url = f"{self.base_url}/activities/{activity_id}/streams"
        
        # Request all available streams
        params = {
            'keys': 'time,heartrate,cadence,watts,temp,velocity_smooth',
            'key_by_type': True
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        return response.json()
    
    def get_activity_laps(self, activity_id):
        """Get lap/interval data"""
        url = f"{self.base_url}/activities/{activity_id}/laps"
        response = requests.get(url, headers=self.headers)
        return response.json()
    
    def process_activity_data(self, activity_id):
        """Process activity data similar to parse script"""
        
        # Get activity details
        details = self.get_activity_details(activity_id)
        
        # Get streams for detailed analysis
        streams = self.get_activity_streams(activity_id)
        
        # Create DataFrame from streams
        df_data = {}
        if 'time' in streams:
            df_data['time'] = streams['time']['data']
        if 'watts' in streams:
            df_data['power'] = streams['watts']['data']
        if 'heartrate' in streams:
            df_data['heart_rate'] = streams['heartrate']['data']
        if 'cadence' in streams:
            df_data['cadence'] = streams['cadence']['data']
        
        if not df_data:
            print("No stream data available for this activity")
            return None
        
        df = pd.DataFrame(df_data)
        
        # Duration (from details or calculate)
        duration_sec = details['elapsed_time']
        duration_min = duration_sec / 60
        
        # Core metrics from API details (when available)
        avg_power = details.get('average_watts', df['power'].mean() if 'power' in df else None)
        max_power = details.get('max_watts', df['power'].max() if 'power' in df else None)
        weighted_avg_power = details.get('weighted_average_watts')  # Similar to NP
        
        # Calculate normalized power if not provided
        if 'power' in df and not weighted_avg_power:
            np_power = (df['power'] ** 4).mean() ** 0.25
        else:
            np_power = weighted_avg_power
        
        # Training metrics
        if_val = np_power / FTP if np_power else None
        
        # TSS calculation (if not provided by Strava)
        if details.get('suffer_score'):  # Strava's relative effort
            tss = details['suffer_score']
        elif np_power and 'power' in df:
            tss = (len(df) * (np_power ** 2)) / (FTP ** 2 * 3600) * 100
        else:
            tss = None
        
        # Heart rate metrics
        avg_hr = details.get('average_heartrate', df['heart_rate'].mean() if 'heart_rate' in df else None)
        max_hr = details.get('max_heartrate', df['heart_rate'].max() if 'heart_rate' in df else None)
        
        # Cadence metrics
        avg_cad = details.get('average_cadence', df['cadence'].mean() if 'cadence' in df else None)
        max_cad = df['cadence'].max() if 'cadence' in df and not df['cadence'].empty else None
        
        # Calculate zones if we have stream data
        results = {
            "activity_name": details['name'],
            "activity_type": details['type'],
            "start_date": details['start_date'],
            "duration_min": round(duration_min, 2),
            "distance_km": round(details.get('distance', 0) / 1000, 2),
            "elevation_gain_m": details.get('total_elevation_gain', 0),
            "avg_power": round(avg_power, 1) if avg_power else None,
            "max_power": round(max_power, 1) if max_power else None,
            "normalized_power": round(np_power, 1) if np_power else None,
            "intensity_factor": round(if_val, 2) if if_val else None,
            "tss": round(tss, 1) if tss else None,
            "avg_hr": round(avg_hr, 1) if avg_hr else None,
            "max_hr": round(max_hr, 1) if max_hr else None,
            "avg_cadence": round(avg_cad, 1) if avg_cad else None,
            "max_cadence": round(max_cad, 1) if max_cad else None,
            "kilojoules": details.get('kilojoules')
        }
        
        # Calculate HR zones if we have stream data
        if 'heart_rate' in df and not df['heart_rate'].empty:
            df['hr_pct'] = df['heart_rate'] / HRMAX
            hr_zones = {
                'Z1 (<60%)': (0.0, 0.6),
                'Z2 (60-70%)': (0.6, 0.7),
                'Z3 (70-80%)': (0.7, 0.8),
                'Z4 (80-90%)': (0.8, 0.9),
                'Z5 (90-100%)': (0.9, 1.0),
            }
            hr_time = {
                label: round(((df['hr_pct'] >= low) & (df['hr_pct'] < high)).sum() / 60, 1)
                for label, (low, high) in hr_zones.items()
            }
            results['hr_zones'] = hr_time
            
            # HR drift
            half = len(df) // 2
            if half > 0:
                hr_drift = round((df['heart_rate'].iloc[half:].mean() - 
                                df['heart_rate'].iloc[:half].mean()) / 
                               df['heart_rate'].iloc[:half].mean() * 100, 2)
                results['hr_drift_pct'] = hr_drift
        
        # Calculate power zones if we have stream data
        if 'power' in df and not df['power'].empty:
            df['power_pct'] = df['power'] / FTP
            power_zones = {
                'Z1 (<55%)': (0.0, 0.55),
                'Z2 (55-75%)': (0.55, 0.75),
                'Z3 (76-90%)': (0.76, 0.90),
                'Z4 (91-105%)': (0.91, 1.05),
                'Z5 (106-120%)': (1.06, 1.20),
                'Z6+ (>120%)': (1.20, float('inf')),
            }
            zone_time = {
                label: round(((df['power_pct'] >= low) & (df['power_pct'] < high)).sum() / 60, 1)
                for label, (low, high) in power_zones.items()
            }
            results['power_zone_time'] = zone_time
            
            # Power duration curve
            durations = [5, 10, 15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 2400, 3600]
            power_curve = {}
            for d in durations:
                if len(df) >= d:
                    power_curve[f"{d}s"] = round(df['power'].rolling(d).mean().max(), 1)
            if power_curve:
                results['power_curve'] = power_curve
            
            # Efficiency Factor
            if avg_hr:
                results['efficiency_factor'] = round(np_power / avg_hr, 2) if np_power else None
        
        return results
    
    def process_laps(self, activity_id):
        """Process lap/interval data similar to intervals script"""
        laps = self.get_activity_laps(activity_id)
        
        lap_summaries = []
        for i, lap in enumerate(laps, 1):
            lap_summary = {
                'lap': i,
                'duration_sec': lap['elapsed_time'],
                'distance_m': round(lap.get('distance', 0), 1),
                'avg_power': round(lap.get('average_watts', 0), 1),
                'max_power': round(lap.get('max_watts', 0), 1),
                'avg_hr': round(lap.get('average_heartrate', 0), 1),
                'max_hr': round(lap.get('max_heartrate', 0), 1),
                'avg_cadence': round(lap.get('average_cadence', 0), 1),
                'avg_speed_kph': round(lap.get('average_speed', 0) * 3.6, 1),
            }
            lap_summaries.append(lap_summary)
        
        return lap_summaries

def main():
    if len(sys.argv) < 3:
        print("Usage: python strava_parse.py <access_token> <activity_id>")
        print("\nTo get an access token:")
        print("1. Go to https://www.strava.com/settings/api")
        print("2. Create an app and get your access token")
        sys.exit(1)
    
    access_token = sys.argv[1]
    activity_id = sys.argv[2]
    
    parser = StravaParser(access_token)
    
    # Get activity data
    print("\n--- Fetching from Strava API ---")
    results = parser.process_activity_data(activity_id)
    
    if results:
        print("\n--- Ride Summary ---")
        for k, v in results.items():
            if isinstance(v, dict):
                print(f"\n{k.replace('_', ' ').title()}:")
                for subk, subv in v.items():
                    print(f"  {subk}: {subv}")
            else:
                if v is not None:
                    print(f"{k.replace('_', ' ').title()}: {v}")
        
        # Get lap data
        laps = parser.process_laps(activity_id)
        if laps:
            print(f"\n--- Detected Laps ({len(laps)} total) ---")
            for lap in laps:
                print(f"Lap {lap['lap']}: {lap}")

if __name__ == "__main__":
    main()