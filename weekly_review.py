#!/usr/bin/env python3
"""
Weekly Cycling Review Data Extractor
Parses all .fit files for a given week and collects qualitative context via interview.
Outputs structured data for ChatGPT coaching review.
"""

from fitparse import FitFile
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
import sys
import os
import argparse
from pathlib import Path
from config import FTP, HRMAX
import json


def parse_arguments():
    parser = argparse.ArgumentParser(
        description='Extract weekly cycling data from .fit files for coaching review'
    )
    parser.add_argument(
        'folder_path',
        type=str,
        help='Path to folder containing .fit files'
    )
    parser.add_argument(
        '--start',
        type=str,
        help='Start date (YYYY-MM-DD). Default: last Monday',
        default=None
    )
    parser.add_argument(
        '--end',
        type=str,
        help='End date (YYYY-MM-DD). Default: last Sunday',
        default=None
    )
    return parser.parse_args()


def get_week_dates(start_date=None, end_date=None):
    """Get start and end dates for the week."""
    if start_date and end_date:
        return datetime.strptime(start_date, '%Y-%m-%d'), datetime.strptime(end_date, '%Y-%m-%d')
    
    # Default to last complete week (Mon-Sun)
    today = date.today()
    last_monday = today - timedelta(days=today.weekday() + 7)
    last_sunday = last_monday + timedelta(days=6)
    
    return datetime.combine(last_monday, datetime.min.time()), \
           datetime.combine(last_sunday, datetime.max.time())


def find_fit_files(folder_path, start_date, end_date):
    """Find all .fit files in folder within date range."""
    folder = Path(folder_path)
    if not folder.exists():
        print(f"Error: Folder {folder_path} does not exist")
        sys.exit(1)
    
    fit_files = []
    for file in folder.glob('*.fit'):
        try:
            fitfile = FitFile(str(file))
            # Get file timestamp from first record
            for record in fitfile.get_messages('file_id'):
                time_created = record.get_value('time_created')
                if time_created:
                    if start_date <= time_created <= end_date:
                        fit_files.append(str(file))
                    break
        except Exception as e:
            print(f"Warning: Could not read {file}: {e}")
            continue
    
    return sorted(fit_files)


def extract_ride_data(filepath):
    """Extract comprehensive ride-level metrics from a .fit file."""
    fitfile = FitFile(filepath)
    
    # Get session data
    session_data = {}
    for session in fitfile.get_messages('session'):
        vals = session.get_values()
        session_data = {
            'start_time': vals.get('start_time'),
            'total_elapsed_time': vals.get('total_elapsed_time', 0),
            'total_timer_time': vals.get('total_timer_time', 0),
            'total_distance': vals.get('total_distance', 0),
            'total_calories': vals.get('total_calories', 0),
            'total_ascent': vals.get('total_ascent', 0),
            'sport': vals.get('sport', 'cycling'),
        }
        break
    
    # Get record data for detailed metrics
    records = []
    for record in fitfile.get_messages('record'):
        vals = record.get_values()
        records.append({
            'timestamp': vals.get('timestamp'),
            'power': vals.get('power'),
            'heart_rate': vals.get('heart_rate'),
            'cadence': vals.get('cadence'),
            'speed': vals.get('speed'),
            'altitude': vals.get('altitude'),
            'temperature': vals.get('temperature'),
        })
    
    if not records:
        return None
    
    df = pd.DataFrame(records)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.set_index('timestamp')
    
    # Clean data
    for col in ['power', 'heart_rate', 'cadence', 'speed']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    df = df.dropna(subset=['power'])
    
    if df.empty:
        return None
    
    # Calculate metrics
    ride_data = {
        'date': session_data['start_time'].date() if session_data.get('start_time') else df.index[0].date(),
        'start_time': session_data.get('start_time', df.index[0]).strftime('%Y-%m-%d %H:%M'),
        'duration_seconds': session_data.get('total_timer_time', 0),
        'distance_m': session_data.get('total_distance', 0),
        'elevation_gain_m': session_data.get('total_ascent', 0),
        'calories': session_data.get('total_calories', 0),
    }
    
    # Power metrics
    if 'power' in df.columns and not df['power'].isna().all():
        ride_data['avg_power'] = df['power'].mean()
        ride_data['max_power'] = df['power'].max()
        ride_data['normalized_power'] = (df['power'] ** 4).mean() ** 0.25
        ride_data['intensity_factor'] = ride_data['normalized_power'] / FTP
        ride_data['tss'] = (ride_data['duration_seconds'] * (ride_data['normalized_power'] ** 2)) / (FTP ** 2 * 3600) * 100
    else:
        ride_data['avg_power'] = 0
        ride_data['max_power'] = 0
        ride_data['normalized_power'] = 0
        ride_data['intensity_factor'] = 0
        ride_data['tss'] = 0
    
    # Heart rate metrics
    if 'heart_rate' in df.columns and not df['heart_rate'].isna().all():
        ride_data['avg_hr'] = df['heart_rate'].mean()
        ride_data['max_hr'] = df['heart_rate'].max()
        
        # Calculate HR drift
        midpoint = len(df) // 2
        first_half_hr = df['heart_rate'].iloc[:midpoint].mean()
        second_half_hr = df['heart_rate'].iloc[midpoint:].mean()
        if first_half_hr > 0:
            ride_data['hr_drift'] = ((second_half_hr - first_half_hr) / first_half_hr) * 100
        else:
            ride_data['hr_drift'] = 0
    else:
        ride_data['avg_hr'] = 0
        ride_data['max_hr'] = 0
        ride_data['hr_drift'] = 0
    
    # Speed and cadence
    if 'speed' in df.columns and not df['speed'].isna().all():
        ride_data['avg_speed_mps'] = df['speed'].mean()
    else:
        ride_data['avg_speed_mps'] = 0
    
    if 'cadence' in df.columns and not df['cadence'].isna().all():
        ride_data['avg_cadence'] = df['cadence'].mean()
        ride_data['max_cadence'] = df['cadence'].max()
    else:
        ride_data['avg_cadence'] = 0
        ride_data['max_cadence'] = 0
    
    # Get ride name if available
    ride_data['name'] = os.path.basename(filepath).replace('.fit', '')
    
    return ride_data


def extract_lap_data(filepath):
    """Extract lap-level metrics from a .fit file."""
    fitfile = FitFile(filepath)
    
    # Get lap messages
    laps = []
    for lap in fitfile.get_messages('lap'):
        vals = lap.get_values()
        lap_data = {
            'start_time': vals.get('start_time'),
            'total_elapsed_time': vals.get('total_elapsed_time', 0),
            'total_timer_time': vals.get('total_timer_time', 0),
            'total_distance': vals.get('total_distance', 0),
            'avg_power': vals.get('avg_power', 0),
            'max_power': vals.get('max_power', 0),
            'normalized_power': vals.get('normalized_power', 0),
            'avg_heart_rate': vals.get('avg_heart_rate', 0),
            'max_heart_rate': vals.get('max_heart_rate', 0),
            'avg_cadence': vals.get('avg_cadence', 0),
            'avg_speed': vals.get('avg_speed', 0),
            'total_ascent': vals.get('total_ascent', 0),
            'lap_trigger': vals.get('lap_trigger', 'manual'),
            'intensity': vals.get('intensity', 'active'),
        }
        
        # Calculate IF and TSS for lap
        if lap_data['normalized_power'] > 0:
            lap_data['intensity_factor'] = lap_data['normalized_power'] / FTP
            lap_data['tss'] = (lap_data['total_timer_time'] * (lap_data['normalized_power'] ** 2)) / (FTP ** 2 * 3600) * 100
        else:
            lap_data['intensity_factor'] = 0
            lap_data['tss'] = 0
        
        laps.append(lap_data)
    
    # If no normalized power in lap data, calculate from records
    if laps and all(lap['normalized_power'] == 0 for lap in laps):
        records = []
        for record in fitfile.get_messages('record'):
            vals = record.get_values()
            records.append({
                'timestamp': vals.get('timestamp'),
                'power': vals.get('power'),
            })
        
        if records:
            df = pd.DataFrame(records)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.set_index('timestamp')
            df['power'] = pd.to_numeric(df['power'], errors='coerce')
            
            for i, lap in enumerate(laps):
                start_time = pd.to_datetime(lap['start_time'])
                end_time = start_time + timedelta(seconds=lap['total_elapsed_time'])
                
                lap_df = df[(df.index >= start_time) & (df.index <= end_time)]
                if not lap_df.empty and not lap_df['power'].isna().all():
                    lap['normalized_power'] = (lap_df['power'] ** 4).mean() ** 0.25
                    lap['intensity_factor'] = lap['normalized_power'] / FTP
                    lap['tss'] = (lap['total_timer_time'] * (lap['normalized_power'] ** 2)) / (FTP ** 2 * 3600) * 100
    
    return laps


def calculate_weekly_aggregates(rides):
    """Calculate weekly aggregate metrics."""
    if not rides:
        return {}
    
    aggregates = {
        'total_rides': len(rides),
        'total_time_seconds': sum(r['duration_seconds'] for r in rides),
        'total_distance_m': sum(r['distance_m'] for r in rides),
        'total_tss': sum(r['tss'] for r in rides),
        'total_elevation_m': sum(r['elevation_gain_m'] for r in rides),
        'avg_intensity_factor': np.mean([r['intensity_factor'] for r in rides if r['intensity_factor'] > 0]),
    }
    
    # Find longest and hardest rides
    longest_ride = max(rides, key=lambda x: x['duration_seconds'])
    aggregates['longest_ride_duration'] = longest_ride['duration_seconds']
    aggregates['longest_ride_distance'] = longest_ride['distance_m']
    aggregates['longest_ride_date'] = longest_ride['date']
    
    hardest_ride = max(rides, key=lambda x: x['tss'])
    aggregates['hardest_ride_tss'] = hardest_ride['tss']
    aggregates['hardest_ride_date'] = hardest_ride['date']
    
    return aggregates


def conduct_interview():
    """Conduct the weekly review interview."""
    print("\n" + "="*60)
    print("WEEKLY REVIEW INTERVIEW")
    print("="*60)
    print("Please answer the following questions about your training week:")
    print()
    
    interview = {}
    
    questions = [
        ("overall_feel", "How did you feel about your training week?"),
        ("fatigue", "How would you rate your fatigue (1-10)?"),
        ("form_fitness", "Did you feel stronger or weaker compared to last week?"),
        ("highlights", "What was your best ride or workout and why?"),
        ("struggles", "Any rides you found unexpectedly hard? Why?"),
        ("recovery", "How was your sleep, nutrition, and recovery?"),
        ("external_factors", "Any stress, illness, travel, or life events affecting training?"),
        ("weather_conditions", "Did weather or environment play a role in performance?"),
        ("equipment_notes", "Any bike, gear, or tech issues this week?"),
        ("goals_checkin", "Did this week move you toward your long-term goals? Why or why not?"),
    ]
    
    for key, question in questions:
        print(f"\n{question}")
        answer = input("> ").strip()
        interview[key] = answer if answer else "No response"
    
    return interview


def format_duration(seconds):
    """Format duration in seconds to hh:mm:ss or mm:ss."""
    if seconds < 3600:
        return f"{int(seconds // 60)}:{int(seconds % 60):02d}"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours}h {minutes:02d}m {secs:02d}s"


def format_output(rides, laps_by_ride, aggregates, interview):
    """Format all data as markdown for ChatGPT."""
    output = []
    output.append("```markdown")
    output.append("# Weekly Cycling Review")
    output.append("")
    
    # Weekly Summary
    output.append("## Weekly Summary")
    output.append(f"- Total Rides: {aggregates.get('total_rides', 0)}")
    output.append(f"- Total Time: {format_duration(aggregates.get('total_time_seconds', 0))}")
    
    dist_km = aggregates.get('total_distance_m', 0) / 1000
    dist_mi = dist_km * 0.621371
    output.append(f"- Total Distance: {dist_km:.1f} km ({dist_mi:.1f} mi)")
    
    output.append(f"- Total TSS: {aggregates.get('total_tss', 0):.0f}")
    
    elev_m = aggregates.get('total_elevation_m', 0)
    elev_ft = elev_m * 3.28084
    output.append(f"- Elevation Gain: {elev_m:.0f} m ({elev_ft:.0f} ft)")
    
    output.append(f"- Average IF: {aggregates.get('avg_intensity_factor', 0):.2f}")
    
    if aggregates.get('longest_ride_duration'):
        output.append(f"- Longest Ride: {format_duration(aggregates['longest_ride_duration'])}, "
                     f"{aggregates['longest_ride_distance']/1000:.1f} km "
                     f"({aggregates['longest_ride_date']})")
    
    if aggregates.get('hardest_ride_tss'):
        output.append(f"- Hardest Ride: {aggregates['hardest_ride_tss']:.0f} TSS "
                     f"({aggregates['hardest_ride_date']})")
    
    output.append("")
    
    # Ride Details
    output.append("## Ride Details")
    
    for i, ride in enumerate(sorted(rides, key=lambda x: x['date'])):
        output.append("")
        output.append(f"### {ride['date']} – {ride['name']}")
        output.append(f"- Start Time: {ride['start_time']}")
        output.append(f"- Duration: {format_duration(ride['duration_seconds'])}")
        
        dist_km = ride['distance_m'] / 1000
        dist_mi = dist_km * 0.621371
        output.append(f"- Distance: {dist_km:.1f} km ({dist_mi:.1f} mi)")
        
        speed_kmh = ride['avg_speed_mps'] * 3.6
        speed_mph = speed_kmh * 0.621371
        output.append(f"- Avg Speed: {speed_kmh:.1f} km/h ({speed_mph:.1f} mph)")
        
        output.append(f"- Avg Power: {ride['avg_power']:.0f}W")
        output.append(f"- Normalized Power: {ride['normalized_power']:.0f}W")
        output.append(f"- IF: {ride['intensity_factor']:.2f}")
        output.append(f"- TSS: {ride['tss']:.0f}")
        output.append(f"- Avg HR: {ride['avg_hr']:.0f} bpm")
        output.append(f"- Max HR: {ride['max_hr']:.0f} bpm")
        output.append(f"- HR Drift: {ride['hr_drift']:+.1f}%")
        
        elev_m = ride['elevation_gain_m']
        elev_ft = elev_m * 3.28084
        output.append(f"- Elevation Gain: {elev_m:.0f} m ({elev_ft:.0f} ft)")
        
        output.append(f"- Calories: {ride['calories']:.0f}")
        output.append(f"- Avg Cadence: {ride['avg_cadence']:.0f} rpm")
        output.append(f"- Max Cadence: {ride['max_cadence']:.0f} rpm")
        
        # Add laps if present
        ride_key = ride['start_time']
        if ride_key in laps_by_ride and laps_by_ride[ride_key]:
            output.append("")
            output.append("**Laps:**")
            for j, lap in enumerate(laps_by_ride[ride_key], 1):
                lap_type = "Active" if lap['intensity'] == 'active' else lap['intensity'].title()
                output.append(f"{j}. {lap_type} – {format_duration(lap['total_timer_time'])}, "
                            f"{lap['avg_power']:.0f}W avg, {lap['normalized_power']:.0f}W NP, "
                            f"IF {lap['intensity_factor']:.2f}, TSS {lap['tss']:.1f}, "
                            f"{lap['avg_heart_rate']:.0f} bpm avg")
    
    output.append("")
    
    # Interview Responses
    output.append("## Rider Interview")
    output.append(f"- **Overall Feel:** {interview['overall_feel']}")
    output.append(f"- **Fatigue:** {interview['fatigue']}")
    output.append(f"- **Form & Fitness:** {interview['form_fitness']}")
    output.append(f"- **Highlights:** {interview['highlights']}")
    output.append(f"- **Struggles:** {interview['struggles']}")
    output.append(f"- **Recovery:** {interview['recovery']}")
    output.append(f"- **External Factors:** {interview['external_factors']}")
    output.append(f"- **Weather & Conditions:** {interview['weather_conditions']}")
    output.append(f"- **Equipment Notes:** {interview['equipment_notes']}")
    output.append(f"- **Goals Check-in:** {interview['goals_checkin']}")
    
    output.append("```")
    
    return "\n".join(output)


def main():
    args = parse_arguments()
    
    # Get date range
    start_date, end_date = get_week_dates(args.start, args.end)
    print(f"Analyzing rides from {start_date.date()} to {end_date.date()}")
    
    # Find .fit files
    fit_files = find_fit_files(args.folder_path, start_date, end_date)
    print(f"Found {len(fit_files)} .fit files in date range")
    
    if not fit_files:
        print("No .fit files found in the specified date range")
        sys.exit(0)
    
    # Extract data from each file
    rides = []
    laps_by_ride = {}
    
    for filepath in fit_files:
        print(f"Processing: {os.path.basename(filepath)}")
        
        # Extract ride data
        ride_data = extract_ride_data(filepath)
        if ride_data:
            rides.append(ride_data)
            
            # Extract lap data
            lap_data = extract_lap_data(filepath)
            if lap_data:
                laps_by_ride[ride_data['start_time']] = lap_data
    
    if not rides:
        print("No valid ride data found")
        sys.exit(0)
    
    # Calculate weekly aggregates
    aggregates = calculate_weekly_aggregates(rides)
    
    # Conduct interview
    interview = conduct_interview()
    
    # Format and output
    output = format_output(rides, laps_by_ride, aggregates, interview)
    
    print("\n" + "="*60)
    print("WEEKLY REVIEW DATA (copy everything below)")
    print("="*60)
    print(output)


if __name__ == "__main__":
    main()