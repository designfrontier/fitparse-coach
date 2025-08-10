# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FitParse Coach is a Python-based tool for analyzing cycling data from .fit files to generate statistics suitable for AI coaching analysis. The project extracts power, heart rate, cadence, and other metrics from cycling workouts.

## Architecture

The codebase consists of three main analysis scripts and a configuration file:

1. **parse** - Main workout analysis script that:
   - Loads .fit file data using fitparse library
   - Calculates overall workout metrics (average/max power, normalized power, TSS, intensity factor)
   - Analyzes heart rate and power zones distribution
   - Outputs formatted statistics for the entire workout

2. **intervals** - Lap/interval analysis script that:
   - Processes individual lap segments from .fit files
   - Calculates per-lap metrics (duration, power, heart rate, cadence)
   - Provides detailed interval-by-interval breakdown
   - Outputs formatted lap statistics

3. **weekly_review.py** - Weekly training review script that:
   - Discovers and processes all .fit files within a date range
   - Extracts comprehensive ride-level metrics (power, HR, speed, elevation)
   - Calculates lap-level data for structured workouts
   - Computes weekly aggregates (total TSS, time, distance, etc.)
   - Conducts interactive interview for qualitative context
   - Outputs structured markdown for AI coaching analysis

4. **config.py** - Contains user-specific physiological parameters:
   - FTP (Functional Threshold Power): Currently 248W
   - HRMAX (Maximum Heart Rate): Currently 180 bpm

## Commands

### Running Analysis

#### Individual Ride Analysis
```bash
# Analyze overall workout statistics
python parse {filepath.fit}

# Analyze lap/interval breakdown
python intervals {filepath.fit}
```

Both scripts should be run on the same .fit file, with outputs combined for comprehensive analysis.

#### Weekly Review Analysis
```bash
# Analyze all rides from last complete week (Mon-Sun)
python weekly_review.py /path/to/fit/files/folder

# Analyze rides with custom date range
python weekly_review.py /path/to/fit/files/folder --start 2025-08-01 --end 2025-08-07
```

The weekly review script will:
1. Process all .fit files in the specified date range
2. Calculate weekly aggregates and per-ride metrics
3. Conduct an interactive interview for qualitative context
4. Output formatted markdown for ChatGPT coaching review

### Development Setup
```bash
# Install dependencies
pip install fitparse pandas numpy
```

## Key Technical Details

- Both scripts are standalone Python files without .py extensions but with shebang support
- Scripts expect .fit files as command-line arguments via sys.argv
- Power zones are calculated as percentages of FTP
- Heart rate zones are calculated as percentages of HRMAX
- TSS (Training Stress Score) calculation uses normalized power relative to FTP
- Scripts output formatted text designed for pasting into ChatGPT or similar AI tools