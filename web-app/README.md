# Strava Coach Web Application

A React + Node.js application that connects to Strava API to analyze cycling training data and generate comprehensive reports for AI coaching analysis.

## Architecture

- **Frontend**: React 18 with Vite, React Router, TanStack Query
- **Backend**: Express.js API with SQLite database
- **Authentication**: Strava OAuth 2.0
- **Styling**: CSS modules with responsive design

## Features

- 🔐 OAuth authentication with Strava
- 📊 Fetches and analyzes cycling activities
- 💪 Calculates power zones, TSS, and intensity factors
- ❤️ Tracks heart rate zones and cardiac drift
- 📈 Generates power duration curves
- 📝 Interview form for qualitative training context
- 📋 Formats data for ChatGPT/Claude coaching analysis
- ⚙️ User-specific FTP and HR Max settings

## Setup

### 1. Install Dependencies

**Backend:**
```bash
# In web-app directory
npm install
```

**Frontend:**
```bash
# In web-app/client directory
cd client
npm install
```

### 2. Configure Strava API

- Go to [Strava API Settings](https://www.strava.com/settings/api)
- Create a new application with:
  - Authorization Callback Domain: `localhost:5000`
  - Website: `http://localhost:5000`

### 3. Environment Setup

```bash
# In web-app directory
cp .env.example .env
# Edit .env with your Strava credentials (or configure via UI)
```

### 4. Start Development

**Terminal 1 - Backend:**
```bash
# In web-app directory
npm run dev
```

**Terminal 2 - Frontend:**
```bash
# In web-app/client directory
npm run dev
```

**Terminal 3 - Build Frontend for Production:**
```bash
# In web-app/client directory
npm run build
```

### 5. Access Application

- Frontend: http://localhost:3000 (development)
- Backend API: http://localhost:5000
- Production: http://localhost:5000 (serves built React app)

## Usage

1. **Setup**: Configure Strava API credentials (first-time only)
2. **Connect**: Authorize with Strava account
3. **Configure**: Set your FTP and HR Max in settings
4. **Analyze**: Select date range and fetch activities
5. **Interview**: Answer questions about your training
6. **Results**: Copy formatted report for AI coaching

## API Endpoints

### Authentication
- `GET /auth/strava` - Initiate OAuth flow
- `GET /auth/callback` - OAuth callback
- `GET /api/user` - Get current user
- `POST /api/logout` - Logout

### Analysis
- `POST /api/analyze` - Analyze activities in date range
- `GET /api/interview` - Get interview data
- `POST /api/interview` - Submit interview and generate report

### Settings
- `PUT /api/settings` - Update user FTP/HR Max

### Configuration
- `GET /api/config` - Get Strava config status
- `POST /api/config` - Set Strava credentials

## Data Analysis

The app calculates:
- **Power Metrics**: Average, normalized power, intensity factor, TSS
- **Power Zones**: Time in each zone (Z1-Z6+) based on user FTP
- **Heart Rate**: Zones, drift percentage based on user HR Max
- **Power Curves**: Best efforts for various durations (5s-1hr)
- **Lap Analysis**: Breakdown of intervals and segments

## Security

- OAuth tokens stored in SQLite database
- Tokens auto-refresh when expired
- Session-based authentication
- CORS configured for development
- No permanent activity data storage

## Development

### Project Structure
```
web-app/
├── server.js              # Express API server
├── package.json           # Backend dependencies
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API client
│   │   └── main.jsx       # React entry point
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js     # Vite configuration
└── public/dist/           # Built frontend (production)
```

### Key Technologies
- **Frontend**: React, React Router, TanStack Query, React Hook Form
- **Backend**: Express, Sequelize, SQLite, Axios
- **Build**: Vite, Node.js
- **Styling**: CSS modules, responsive design

## Requirements

- Node.js 16+
- Strava account with activities
- Power meter data (for power analysis)
- Heart rate data (for HR analysis)