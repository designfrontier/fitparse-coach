const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');
const { format, subDays, startOfWeek, endOfWeek } = require('date-fns');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Default values - will be overridden by user settings
const DEFAULT_FTP = 250;
const DEFAULT_HRMAX = 180;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/dist', express.static(path.join(__dirname, 'public/dist')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'strava-coach-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Database setup
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './strava_coach.db',
  logging: false
});

// Models
const User = sequelize.define('User', {
  stravaId: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: false
  },
  firstname: DataTypes.STRING,
  lastname: DataTypes.STRING,
  accessToken: DataTypes.TEXT,
  refreshToken: DataTypes.TEXT,
  expiresAt: DataTypes.INTEGER,
  ftp: {
    type: DataTypes.INTEGER,
    defaultValue: DEFAULT_FTP
  },
  hrmax: {
    type: DataTypes.INTEGER,
    defaultValue: DEFAULT_HRMAX
  }
});

const ActivityCache = sequelize.define('ActivityCache', {
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  activityId: {
    type: DataTypes.BIGINT,
    unique: true
  },
  activityDate: DataTypes.DATE,
  data: DataTypes.TEXT // JSON string
});

// Strava API configuration
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5000/auth/callback';

// Helper functions
async function getValidToken(user) {
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (currentTime >= user.expiresAt) {
    // Token expired, refresh it
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: user.refreshToken,
        grant_type: 'refresh_token'
      });
      
      const tokens = response.data;
      user.accessToken = tokens.access_token;
      user.refreshToken = tokens.refresh_token;
      user.expiresAt = tokens.expires_at;
      await user.save();
      
      return tokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }
  
  return user.accessToken;
}

async function fetchActivities(user, startDate, endDate) {
  const token = await getValidToken(user);
  if (!token) return [];
  
  const after = Math.floor(startDate.getTime() / 1000);
  const before = Math.floor(endDate.getTime() / 1000) + 86400; // Add one day
  
  const activities = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    try {
      const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { after, before, page, per_page: perPage }
      });
      
      if (response.data.length === 0) break;
      activities.push(...response.data);
      
      if (response.data.length < perPage) break;
      page++;
    } catch (error) {
      console.error('Error fetching activities:', error);
      break;
    }
  }
  
  return activities;
}

async function analyzeActivity(user, activityId) {
  const token = await getValidToken(user);
  if (!token) return null;
  
  try {
    // Get activity details
    const detailsResponse = await axios.get(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const details = detailsResponse.data;
    
    // Get streams
    let streams = {};
    try {
      const streamsResponse = await axios.get(
        `https://www.strava.com/api/v3/activities/${activityId}/streams`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { 
            keys: 'time,heartrate,cadence,watts,velocity_smooth,altitude',
            key_by_type: true
          }
        }
      );
      streams = streamsResponse.data;
    } catch (e) {
      console.log('No streams available for activity', activityId);
    }
    
    // Get laps
    let laps = [];
    try {
      const lapsResponse = await axios.get(
        `https://www.strava.com/api/v3/activities/${activityId}/laps`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      laps = lapsResponse.data;
    } catch (e) {
      console.log('No laps available for activity', activityId);
    }
    
    // Build results
    const results = {
      id: activityId,
      name: details.name,
      type: details.type,
      startDate: details.start_date_local,
      durationSec: details.elapsed_time,
      distanceKm: Math.round(details.distance / 1000 * 100) / 100,
      elevationGain: details.total_elevation_gain,
      avgPower: details.average_watts,
      maxPower: details.max_watts,
      weightedAvgPower: details.weighted_average_watts,
      avgHr: details.average_heartrate,
      maxHr: details.max_heartrate,
      avgCadence: details.average_cadence,
      kilojoules: details.kilojoules
    };
    
    // Calculate TSS and IF
    if (results.weightedAvgPower) {
      results.intensityFactor = Math.round(results.weightedAvgPower / user.ftp * 100) / 100;
      results.tss = Math.round(
        (results.durationSec * results.weightedAvgPower * results.intensityFactor) / 
        (user.ftp * 3600) * 100 * 10
      ) / 10;
    }
    
    // Process power zones if we have power stream
    if (streams.watts && streams.watts.data) {
      results.powerZones = calculatePowerZones(streams.watts.data, user.ftp);
      results.powerCurve = calculatePowerCurve(streams.watts.data);
    }
    
    // Process HR zones if we have HR stream
    if (streams.heartrate && streams.heartrate.data) {
      results.hrZones = calculateHrZones(streams.heartrate.data, user.hrmax);
      
      // Calculate HR drift
      const hrData = streams.heartrate.data;
      if (hrData.length > 100) {
        const half = Math.floor(hrData.length / 2);
        const firstHalf = hrData.slice(0, half);
        const secondHalf = hrData.slice(half);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        results.hrDrift = Math.round(((secondAvg - firstAvg) / firstAvg) * 100 * 100) / 100;
      }
    }
    
    // Process laps
    if (laps.length > 0) {
      results.laps = laps.map((lap, i) => ({
        number: i + 1,
        duration: lap.elapsed_time,
        distanceKm: Math.round(lap.distance / 1000 * 100) / 100,
        avgPower: lap.average_watts,
        avgHr: lap.average_heartrate,
        avgCadence: lap.average_cadence
      }));
    }
    
    return results;
  } catch (error) {
    console.error('Error analyzing activity:', error);
    return null;
  }
}

function calculatePowerZones(powerData, ftp) {
  const zones = {
    'Z1 (<55%)': [0, 0.55 * ftp],
    'Z2 (55-75%)': [0.55 * ftp, 0.75 * ftp],
    'Z3 (76-90%)': [0.76 * ftp, 0.90 * ftp],
    'Z4 (91-105%)': [0.91 * ftp, 1.05 * ftp],
    'Z5 (106-120%)': [1.06 * ftp, 1.20 * ftp],
    'Z6+ (>120%)': [1.20 * ftp, Infinity]
  };
  
  const zoneTime = {};
  for (const [zoneName, [low, high]] of Object.entries(zones)) {
    const timeInZone = powerData.filter(p => p >= low && p < high).length;
    zoneTime[zoneName] = Math.round(timeInZone / 60 * 10) / 10; // Minutes
  }
  
  return zoneTime;
}

function calculateHrZones(hrData, hrmax) {
  const zones = {
    'Z1 (<60%)': [0, 0.6 * hrmax],
    'Z2 (60-70%)': [0.6 * hrmax, 0.7 * hrmax],
    'Z3 (70-80%)': [0.7 * hrmax, 0.8 * hrmax],
    'Z4 (80-90%)': [0.8 * hrmax, 0.9 * hrmax],
    'Z5 (90-100%)': [0.9 * hrmax, hrmax]
  };
  
  const zoneTime = {};
  for (const [zoneName, [low, high]] of Object.entries(zones)) {
    const timeInZone = hrData.filter(hr => hr >= low && hr < high).length;
    zoneTime[zoneName] = Math.round(timeInZone / 60 * 10) / 10; // Minutes
  }
  
  return zoneTime;
}

function calculatePowerCurve(powerData) {
  const durations = [5, 10, 30, 60, 120, 300, 600, 1200, 1800];
  const powerCurve = {};
  
  for (const duration of durations) {
    if (powerData.length >= duration) {
      let maxAvg = 0;
      for (let i = 0; i <= powerData.length - duration; i++) {
        const window = powerData.slice(i, i + duration);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        if (avg > maxAvg) maxAvg = avg;
      }
      powerCurve[`${duration}s`] = Math.round(maxAvg * 10) / 10;
    }
  }
  
  return powerCurve;
}

function generateCoachingOutput(activities, responses, dateRange) {
  const lines = [];
  
  // Header
  lines.push('# Weekly Training Review');
  lines.push(`Period: ${dateRange.start} to ${dateRange.end}`);
  lines.push(`Generated: ${new Date().toLocaleString()}\n`);
  
  // Weekly Summary
  lines.push('## Weekly Summary');
  const totalTime = activities.reduce((sum, a) => sum + a.durationSec, 0) / 3600;
  const totalDistance = activities.reduce((sum, a) => sum + a.distanceKm, 0);
  const totalTss = activities.reduce((sum, a) => sum + (a.tss || 0), 0);
  const totalElevation = activities.reduce((sum, a) => sum + (a.elevationGain || 0), 0);
  
  lines.push(`- Total Activities: ${activities.length}`);
  lines.push(`- Total Time: ${totalTime.toFixed(1)} hours`);
  lines.push(`- Total Distance: ${totalDistance.toFixed(1)} km`);
  lines.push(`- Total TSS: ${Math.round(totalTss)}`);
  lines.push(`- Total Elevation: ${Math.round(totalElevation)} m`);
  // Get user settings for the first activity (all should have same user)
  const userFtp = activities[0]?.userFtp || DEFAULT_FTP;
  const userHrmax = activities[0]?.userHrmax || DEFAULT_HRMAX;
  
  lines.push(`- FTP Setting: ${userFtp}W`);
  lines.push(`- HR Max Setting: ${userHrmax} bpm\n`);
  
  // Individual Activities
  lines.push('## Individual Activities');
  for (const activity of activities) {
    lines.push(`\n### ${activity.name}`);
    lines.push(`Date: ${activity.startDate}`);
    lines.push(`Duration: ${Math.round(activity.durationSec / 60)} min`);
    lines.push(`Distance: ${activity.distanceKm} km`);
    
    if (activity.avgPower) {
      lines.push(`Power: Avg ${activity.avgPower}W, NP ${activity.weightedAvgPower || 'N/A'}W`);
      if (activity.intensityFactor) {
        lines.push(`IF: ${activity.intensityFactor}, TSS: ${activity.tss || 'N/A'}`);
      }
    }
    
    if (activity.avgHr) {
      lines.push(`Heart Rate: Avg ${activity.avgHr}, Max ${activity.maxHr || 'N/A'}`);
      if (activity.hrDrift !== undefined) {
        lines.push(`HR Drift: ${activity.hrDrift}%`);
      }
    }
    
    if (activity.powerZones) {
      lines.push('\nPower Zones (minutes):');
      for (const [zone, time] of Object.entries(activity.powerZones)) {
        lines.push(`  ${zone}: ${time}`);
      }
    }
    
    if (activity.hrZones) {
      lines.push('\nHR Zones (minutes):');
      for (const [zone, time] of Object.entries(activity.hrZones)) {
        lines.push(`  ${zone}: ${time}`);
      }
    }
    
    if (activity.laps && activity.laps.length > 1) {
      lines.push('\nLaps:');
      for (const lap of activity.laps) {
        lines.push(`  Lap ${lap.number}: ${lap.duration}s, ` +
                  `${lap.avgPower || 'N/A'}W, ` +
                  `${lap.avgHr || 'N/A'}bpm`);
      }
    }
  }
  
  // Interview Responses
  if (responses && Object.keys(responses).length > 0) {
    lines.push('\n## Athlete Feedback');
    
    const fields = {
      goals: 'Weekly Goals',
      feel: 'How I Felt',
      fatigue: 'Fatigue Level',
      sleep: 'Sleep Quality',
      nutrition: 'Nutrition',
      stress: 'Life Stress',
      weather: 'Weather Conditions',
      achievements: 'Key Achievements',
      challenges: 'Challenges Faced',
      nextWeek: 'Focus for Next Week'
    };
    
    for (const [key, label] of Object.entries(fields)) {
      if (responses[key]) {
        lines.push(`\n**${label}:**\n${responses[key]}`);
      }
    }
  }
  
  lines.push('\n---');
  lines.push('Please provide coaching feedback on this week\'s training.');
  
  return lines.join('\n');
}

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  next();
}

// API Routes
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      ftp: user.ftp,
      hrmax: user.hrmax
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Setup required' });
  }
  
  res.json({
    client_id: STRAVA_CLIENT_ID,
    has_secret: !!STRAVA_CLIENT_SECRET
  });
});

app.post('/api/config', (req, res) => {
  const { clientId, clientSecret } = req.body;
  
  // Save to .env file
  const envContent = `STRAVA_CLIENT_ID=${clientId}\nSTRAVA_CLIENT_SECRET=${clientSecret}\n`;
  require('fs').writeFileSync('.env', envContent);
  
  // Reload environment
  process.env.STRAVA_CLIENT_ID = clientId;
  process.env.STRAVA_CLIENT_SECRET = clientSecret;
  
  res.json({ success: true });
});

app.get('/auth/strava', (req, res) => {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return res.redirect('/setup');
  }
  
  const authUrl = 'https://www.strava.com/oauth/authorize?' +
    `client_id=${STRAVA_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `approval_prompt=force&` +
    `scope=read,activity:read_all`;
  
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization failed');
  }
  
  try {
    // Exchange code for token
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });
    
    const { athlete, access_token, refresh_token, expires_at } = response.data;
    
    // Save or update user
    let user = await User.findOne({ where: { stravaId: athlete.id } });
    
    if (!user) {
      user = await User.create({
        stravaId: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: expires_at
      });
    } else {
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.expiresAt = expires_at;
      await user.save();
    }
    
    req.session.userId = user.id;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.post('/api/analyze', requireAuth, async (req, res) => {
  const { startDate, endDate } = req.body;
  const user = await User.findByPk(req.session.userId);
  
  // Fetch activities
  const activities = await fetchActivities(
    user,
    new Date(startDate),
    new Date(endDate)
  );
  
  // Filter for rides only
  const rides = activities.filter(a => 
    a.type === 'Ride' || a.type === 'VirtualRide'
  );
  
  // Analyze each activity
  const analyzed = [];
  for (const ride of rides) {
    const analysis = await analyzeActivity(user, ride.id);
    if (analysis) {
      // Add user settings to activity for report generation
      analysis.userFtp = user.ftp;
      analysis.userHrmax = user.hrmax;
      analyzed.push(analysis);
    }
  }
  
  // Store in session
  req.session.activities = analyzed;
  req.session.dateRange = { start: startDate, end: endDate };
  
  res.json({ 
    success: true, 
    activities: analyzed.length,
    message: `Found ${analyzed.length} activities`
  });
});

app.get('/api/interview', requireAuth, (req, res) => {
  if (!req.session.activities) {
    return res.status(400).json({ error: 'No activities found. Please analyze activities first.' });
  }
  
  res.json({ 
    activities: req.session.activities.map(a => ({
      id: a.id,
      name: a.name,
      startDate: a.startDate,
      durationSec: a.durationSec
    }))
  });
});

app.post('/api/interview', requireAuth, (req, res) => {
  if (!req.session.activities) {
    return res.status(400).json({ error: 'No activities found' });
  }
  
  req.session.responses = req.body;
  
  const output = generateCoachingOutput(
    req.session.activities,
    req.session.responses,
    req.session.dateRange
  );
  
  res.json({ 
    success: true,
    output: output 
  });
});

app.put('/api/settings', requireAuth, async (req, res) => {
  const { ftp, hrmax } = req.body;
  
  try {
    const user = await User.findByPk(req.session.userId);
    user.ftp = parseInt(ftp);
    user.hrmax = parseInt(hrmax);
    await user.save();
    
    res.json({ 
      success: true,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        ftp: user.ftp,
        hrmax: user.hrmax
      }
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dist/index.html'));
});

// Initialize database and start server
sequelize.sync().then(() => {
  console.log('Database synced');
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`FTP: ${FTP}W, HR Max: ${HRMAX}bpm`);
  });
}).catch(err => {
  console.error('Failed to sync database:', err);
});