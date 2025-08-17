# FitParse Coach

A comprehensive platform for analyzing cycling training data and generating AI coaching reports, available in both command-line and web application formats.

## 🚴 Web Application (Recommended)

Modern React + Node.js web app that connects to Strava API for seamless training analysis.

### Features
- 🔐 **Strava Integration**: OAuth authentication with automatic data sync
- 📊 **Comprehensive Analysis**: Power zones, TSS, heart rate metrics, power curves
- ⚙️ **Personal Settings**: User-specific FTP and HR Max configuration
- 📝 **Training Interview**: Qualitative context gathering for complete analysis
- 📋 **AI-Ready Reports**: Formatted output for ChatGPT/Claude coaching
- 📱 **Modern UI**: Responsive React interface with real-time updates

### Quick Start
```bash
cd web-app
npm install

# Start backend API
npm run dev

# In another terminal, start React frontend
cd client
npm install
npm run dev
```

Visit http://localhost:3333 and follow the setup wizard to connect your Strava account.

📖 **[Full Web App Documentation →](web-app/README.md)**

---

## 🖥️ Command Line Scripts

Python scripts for analyzing local .fit files directly.

### Individual Ride Analysis
For analyzing a single ride, run both scripts on the same file:
- `python parse {filepath.fit}` - Overall workout statistics  
- `python intervals {filepath.fit}` - Lap/interval breakdown

Paste the combined output to ChatGPT for coaching analysis.

### Weekly Review Analysis
For comprehensive weekly training review:
```bash
# Analyze last complete week (Mon-Sun)
python weekly_review.py /path/to/fit/files/

# Analyze custom date range
python weekly_review.py /path/to/fit/files/ --start 2025-08-01 --end 2025-08-07
```

The weekly review script will:
1. Process all .fit files in the specified date range
2. Calculate weekly aggregates (total TSS, time, distance, elevation)
3. Extract detailed metrics for each ride
4. Include lap data for structured workouts
5. Conduct an interactive interview about your training week
6. Output everything in markdown format for ChatGPT

### Setup
```bash
pip install fitparse pandas numpy
```

### Configuration
Edit `config.py` to set your personal parameters:
- `FTP` - Your Functional Threshold Power in watts
- `HRMAX` - Your maximum heart rate in bpm

---

## 🎯 Which Version to Use?

**Choose the Web App if you:**
- Want seamless Strava integration
- Prefer a modern UI experience
- Need user-specific settings storage
- Want automated data fetching

**Choose Command Line if you:**
- Have local .fit files to analyze
- Prefer working in terminal
- Don't want to set up Strava API
- Need to analyze files not on Strava
