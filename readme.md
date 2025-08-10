# FitParse Coach

Scripts for pulling stats out of .fit files to feed to ChatGPT for cycling coaching.

## Scripts

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

## Setup

```bash
pip install fitparse pandas numpy
```

## Configuration

Edit `config.py` to set your personal parameters:
- `FTP` - Your Functional Threshold Power in watts
- `HRMAX` - Your maximum heart rate in bpm
