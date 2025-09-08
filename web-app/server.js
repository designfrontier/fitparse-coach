const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const { format, subDays, startOfWeek, endOfWeek } = require("date-fns");
const AICoachingService = require("./services/aiCoaching");
const prisma = require("./lib/prisma");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5555;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3333";
const BASE_URL = process.env.BASE_URL || "http://localhost:5555";

// Default values - will be overridden by user settings
const DEFAULT_FTP = 250;
const DEFAULT_HRMAX = 180;

// Middleware
app.use(
  cors({
    origin: [FRONTEND_URL, 'exp://192.168.86.242:8081', 'http://localhost:8081', 'exp://localhost:8081'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/dist", express.static(path.join(__dirname, "public/dist")));

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "strava-coach-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on each request
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true, // Prevent XSS attacks
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // CSRF protection while allowing normal navigation
    },
  })
);

// Database connection is handled by Prisma

// Initialize AI Coaching Service
const aiCoach = new AICoachingService({
  provider: process.env.AI_PROVIDER || 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.AI_MODEL || 'gpt-4-turbo-preview',
  slidingWindowSize: parseInt(process.env.AI_SLIDING_WINDOW || '10'),
});

// Database models are defined in prisma/schema.prisma




// Strava API configuration
const REDIRECT_URI = `${BASE_URL}/auth/callback`;

// Helper function to get current config
async function getStravaConfig() {
  try {
    const clientIdConfig = await prisma.config.findUnique({
      where: { key: 'STRAVA_CLIENT_ID' }
    });
    const clientSecretConfig = await prisma.config.findUnique({
      where: { key: 'STRAVA_CLIENT_SECRET' }
    });
    
    return {
      clientId: clientIdConfig?.value || process.env.STRAVA_CLIENT_ID,
      clientSecret: clientSecretConfig?.value || process.env.STRAVA_CLIENT_SECRET
    };
  } catch (error) {
    // Fallback to environment variables if database read fails
    return {
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET
    };
  }
}

// Helper function to get activities in a date range with analysis
async function getActivitiesInRange(user, startDate, endDate) {
  const activities = await fetchActivities(user, startDate, endDate);
  
  // Filter for rides only
  const rides = activities.filter(
    (a) => a.type === "Ride" || a.type === "VirtualRide"
  );
  
  // Analyze each activity
  const analyzed = [];
  for (const ride of rides) {
    const analysis = await analyzeActivity(user, ride.id);
    if (analysis) {
      analyzed.push(analysis);
    }
  }
  
  return analyzed;
}

// Helper functions
async function getValidToken(user) {
  const currentTime = Math.floor(Date.now() / 1000);

  if (currentTime >= user.expiresAt) {
    // Token expired, refresh it
    try {
      const config = await getStravaConfig();
      const response = await axios.post("https://www.strava.com/oauth/token", {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: user.refreshToken,
        grant_type: "refresh_token",
      });

      const tokens = response.data;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_at,
        }
      });

      return tokens.access_token;
    } catch (error) {
      console.error("Failed to refresh token:", error);
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
      const response = await axios.get(
        "https://www.strava.com/api/v3/athlete/activities",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { after, before, page, per_page: perPage },
        }
      );

      if (response.data.length === 0) break;
      activities.push(...response.data);

      if (response.data.length < perPage) break;
      page++;
    } catch (error) {
      console.error("Error fetching activities:", error);
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
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const details = detailsResponse.data;

    // Get streams
    let streams = {};
    try {
      const streamsResponse = await axios.get(
        `https://www.strava.com/api/v3/activities/${activityId}/streams`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            keys: "time,heartrate,cadence,watts,velocity_smooth,altitude",
            key_by_type: true,
          },
        }
      );
      streams = streamsResponse.data;
    } catch (e) {
      console.log("No streams available for activity", activityId);
    }

    // Get laps
    let laps = [];
    try {
      const lapsResponse = await axios.get(
        `https://www.strava.com/api/v3/activities/${activityId}/laps`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      laps = lapsResponse.data;
    } catch (e) {
      console.log("No laps available for activity", activityId);
    }

    // Build results
    const results = {
      id: activityId,
      name: details.name,
      type: details.type,
      startDate: details.start_date_local,
      durationSec: details.elapsed_time,
      distanceKm: Math.round((details.distance / 1000) * 100) / 100,
      elevationGain: details.total_elevation_gain,
      avgPower: details.average_watts,
      maxPower: details.max_watts,
      weightedAvgPower: details.weighted_average_watts,
      avgHr: details.average_heartrate,
      maxHr: details.max_heartrate,
      avgCadence: details.average_cadence,
      kilojoules: details.kilojoules,
    };

    // Calculate TSS and IF
    if (results.weightedAvgPower) {
      results.intensityFactor =
        Math.round((results.weightedAvgPower / user.ftp) * 100) / 100;
      results.tss =
        Math.round(
          ((results.durationSec *
            results.weightedAvgPower *
            results.intensityFactor) /
            (user.ftp * 3600)) *
            100 *
            10
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
    }
    
    // Calculate aerobic decoupling if we have both power and HR data
    if (streams.watts && streams.watts.data && streams.heartrate && streams.heartrate.data) {
      const aerobicDecoupling = calculateAerobicDecoupling(
        streams.watts.data,
        streams.heartrate.data,
        laps,
        user
      );
      
      if (aerobicDecoupling !== null) {
        results.aerobicDecoupling = aerobicDecoupling;
        // Keep hrDrift for backward compatibility
        results.hrDrift = aerobicDecoupling;
      }
    }

    // Process laps
    if (laps.length > 0) {
      results.laps = laps.map((lap, i) => ({
        number: i + 1,
        duration: lap.elapsed_time,
        distanceKm: Math.round((lap.distance / 1000) * 100) / 100,
        avgPower: lap.average_watts,
        avgHr: lap.average_heartrate,
        avgCadence: lap.average_cadence,
      }));
    }

    return results;
  } catch (error) {
    console.error("Error analyzing activity:", error);
    return null;
  }
}

function calculatePowerZones(powerData, ftp) {
  const zones = {
    "Z1 (<55%)": [0, 0.55 * ftp],
    "Z2 (55-75%)": [0.55 * ftp, 0.75 * ftp],
    "Z3 (76-90%)": [0.76 * ftp, 0.9 * ftp],
    "Z4 (91-105%)": [0.91 * ftp, 1.05 * ftp],
    "Z5 (106-120%)": [1.06 * ftp, 1.2 * ftp],
    "Z6+ (>120%)": [1.2 * ftp, Infinity],
  };

  const zoneTime = {};
  for (const [zoneName, [low, high]] of Object.entries(zones)) {
    const timeInZone = powerData.filter((p) => p >= low && p < high).length;
    zoneTime[zoneName] = Math.round((timeInZone / 60) * 10) / 10; // Minutes
  }

  return zoneTime;
}

function calculateHrZones(hrData, hrmax) {
  const zones = {
    "Z1 (<60%)": [0, 0.6 * hrmax],
    "Z2 (60-70%)": [0.6 * hrmax, 0.7 * hrmax],
    "Z3 (70-80%)": [0.7 * hrmax, 0.8 * hrmax],
    "Z4 (80-90%)": [0.8 * hrmax, 0.9 * hrmax],
    "Z5 (90-100%)": [0.9 * hrmax, hrmax],
  };

  const zoneTime = {};
  for (const [zoneName, [low, high]] of Object.entries(zones)) {
    const timeInZone = hrData.filter((hr) => hr >= low && hr < high).length;
    zoneTime[zoneName] = Math.round((timeInZone / 60) * 10) / 10; // Minutes
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

function calculateAerobicDecoupling(powerData, hrData, laps, user) {
  // Aerobic Decoupling (%) = ((Pw:HR_second_half / Pw:HR_first_half) - 1) × 100
  // Where Pw:HR = Average Normalized Power / Average Heart Rate
  
  if (!powerData || !hrData || powerData.length !== hrData.length || powerData.length < 200) {
    return null;
  }

  let startIndex = 0;
  let endIndex = powerData.length;
  
  // Intelligently exclude warmup and cooldown using laps if available
  if (laps && laps.length > 2) {
    // Check first lap for warmup characteristics (10-15 min duration)
    const firstLap = laps[0];
    if (firstLap.elapsed_time >= 600 && firstLap.elapsed_time <= 900) {
      // Skip first lap as warmup
      startIndex = Math.min(firstLap.elapsed_time, powerData.length);
    }
    
    // Check last lap for cooldown characteristics
    const lastLap = laps[laps.length - 1];
    // Check if last lap is low effort (Z1 - below 60% of max HR)
    const z1Threshold = user.hrmax * 0.6;
    if (lastLap.average_heartrate && lastLap.average_heartrate < z1Threshold) {
      // Skip last lap as cooldown
      endIndex = Math.max(0, powerData.length - lastLap.elapsed_time);
    } else if (lastLap.average_watts && lastLap.max_watts) {
      // Check for declining power (avg power much lower than max)
      const powerDecline = (lastLap.max_watts - lastLap.average_watts) / lastLap.max_watts;
      if (powerDecline > 0.3) { // 30% decline suggests cooldown
        endIndex = Math.max(0, powerData.length - lastLap.elapsed_time);
      }
    }
  } else {
    // Fallback to time-based approach if no laps or too few laps
    const warmupDuration = 600; // 10 minutes
    const cooldownDuration = 300; // 5 minutes
    
    if (powerData.length > warmupDuration + cooldownDuration + 100) {
      startIndex = warmupDuration;
      endIndex = powerData.length - cooldownDuration;
    }
  }
  
  // Calculate aerobic decoupling on the main set
  if (endIndex <= startIndex + 100) {
    return null;
  }
  
  const mainSetPower = powerData.slice(startIndex, endIndex);
  const mainSetHR = hrData.slice(startIndex, endIndex);
  
  // Split main set data in half
  const half = Math.floor(mainSetPower.length / 2);
  
  const firstHalfPower = mainSetPower.slice(0, half);
  const secondHalfPower = mainSetPower.slice(half);
  const firstHalfHR = mainSetHR.slice(0, half);
  const secondHalfHR = mainSetHR.slice(half);
  
  // Calculate normalized power for each half (simplified - using average as proxy)
  // In a full implementation, you'd calculate proper normalized power
  const firstHalfAvgPower = firstHalfPower.reduce((a, b) => a + b, 0) / firstHalfPower.length;
  const secondHalfAvgPower = secondHalfPower.reduce((a, b) => a + b, 0) / secondHalfPower.length;
  
  const firstHalfAvgHR = firstHalfHR.reduce((a, b) => a + b, 0) / firstHalfHR.length;
  const secondHalfAvgHR = secondHalfHR.reduce((a, b) => a + b, 0) / secondHalfHR.length;
  
  // Calculate Pw:HR ratios
  const pwHRFirstHalf = firstHalfAvgPower / firstHalfAvgHR;
  const pwHRSecondHalf = secondHalfAvgPower / secondHalfAvgHR;
  
  // Calculate aerobic decoupling percentage
  const aerobicDecoupling = ((pwHRSecondHalf / pwHRFirstHalf) - 1) * 100;
  
  return Math.round(aerobicDecoupling * 100) / 100;
}

function generateCoachingOutput(activities, responses, dateRange) {
  const lines = [];

  // Header
  lines.push("# Weekly Training Review");
  lines.push(`Period: ${dateRange.start} to ${dateRange.end}`);
  lines.push(`Generated: ${new Date().toLocaleString()}\n`);

  // Weekly Summary
  lines.push("## Weekly Summary");
  const totalTime =
    activities.reduce((sum, a) => sum + a.durationSec, 0) / 3600;
  const totalDistance = activities.reduce((sum, a) => sum + a.distanceKm, 0);
  const totalTss = activities.reduce((sum, a) => sum + (a.tss || 0), 0);
  const totalElevation = activities.reduce(
    (sum, a) => sum + (a.elevationGain || 0),
    0
  );

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
  lines.push("## Individual Activities");
  for (const activity of activities) {
    lines.push(`\n### ${activity.name}`);
    lines.push(`Date: ${activity.startDate}`);
    lines.push(`Duration: ${Math.round(activity.durationSec / 60)} min`);
    lines.push(`Distance: ${activity.distanceKm} km`);

    if (activity.avgPower) {
      lines.push(
        `Power: Avg ${activity.avgPower}W, NP ${
          activity.weightedAvgPower || "N/A"
        }W`
      );
      if (activity.intensityFactor) {
        lines.push(
          `IF: ${activity.intensityFactor}, TSS: ${activity.tss || "N/A"}`
        );
      }
    }

    if (activity.avgHr) {
      lines.push(
        `Heart Rate: Avg ${activity.avgHr}, Max ${activity.maxHr || "N/A"}`
      );
      if (activity.hrDrift !== undefined) {
        lines.push(`HR Drift: ${activity.hrDrift}%`);
      }
    }

    if (activity.powerZones) {
      lines.push("\nPower Zones (minutes):");
      for (const [zone, time] of Object.entries(activity.powerZones)) {
        lines.push(`  ${zone}: ${time}`);
      }
    }

    if (activity.hrZones) {
      lines.push("\nHR Zones (minutes):");
      for (const [zone, time] of Object.entries(activity.hrZones)) {
        lines.push(`  ${zone}: ${time}`);
      }
    }

    if (activity.laps && activity.laps.length > 1) {
      lines.push("\nLaps:");
      for (const lap of activity.laps) {
        lines.push(
          `  Lap ${lap.number}: ${lap.duration}s, ` +
            `${lap.avgPower || "N/A"}W, ` +
            `${lap.avgHr || "N/A"}bpm`
        );
      }
    }
  }

  // Interview Responses
  if (responses && Object.keys(responses).length > 0) {
    lines.push("\n## Athlete Feedback");

    const fields = {
      goals: "Weekly Goals",
      feel: "How I Felt",
      fatigue: "Fatigue Level",
      sleep: "Sleep Quality",
      nutrition: "Nutrition",
      stress: "Life Stress",
      weather: "Weather Conditions",
      achievements: "Key Achievements",
      challenges: "Challenges Faced",
      nextWeek: "Focus for Next Week",
    };

    for (const [key, label] of Object.entries(fields)) {
      if (responses[key]) {
        lines.push(`\n**${label}:**\n${responses[key]}`);
      }
    }
  }

  lines.push("\n---");
  lines.push("Please provide coaching feedback on this week's training.");

  return lines.join("\n");
}

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

// API Routes
app.get("/api/user", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      ftp: user.ftp,
      hrmax: user.hrmax,
      isFastTwitch: user.isFastTwitch,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/api/config", async (req, res) => {
  const config = await getStravaConfig();
  
  if (!config.clientId || !config.clientSecret) {
    return res.status(503).json({ error: "Setup required" });
  }

  res.json({
    client_id: config.clientId,
    has_secret: !!config.clientSecret,
  });
});

app.post("/api/config", async (req, res) => {
  const { clientId, clientSecret } = req.body;

  try {
    // Save to database
    await prisma.config.upsert({
      where: { key: 'STRAVA_CLIENT_ID' },
      update: { value: clientId },
      create: { key: 'STRAVA_CLIENT_ID', value: clientId }
    });
    await prisma.config.upsert({
      where: { key: 'STRAVA_CLIENT_SECRET' },
      update: { value: clientSecret },
      create: { key: 'STRAVA_CLIENT_SECRET', value: clientSecret }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

app.get("/auth/strava", async (req, res) => {
  const config = await getStravaConfig();
  
  if (!config.clientId || !config.clientSecret) {
    return res.redirect("/setup");
  }

  // Store the source (mobile or web) in session for redirect after auth
  const source = req.query.source || 'web';
  req.session.authSource = source;

  const authUrl =
    "https://www.strava.com/oauth/authorize?" +
    `client_id=${config.clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `approval_prompt=force&` +
    `scope=read,activity:read_all`;

  console.log('Generated Auth URL:', authUrl);
  console.log('REDIRECT_URI:', REDIRECT_URI);
  console.log('Auth source:', source);
  res.redirect(authUrl);
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization failed");
  }

  try {
    const config = await getStravaConfig();
    // Exchange code for token
    const response = await axios.post("https://www.strava.com/oauth/token", {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: "authorization_code",
    });

    const { athlete, access_token, refresh_token, expires_at } = response.data;

    // Save or update user
    let user = await prisma.user.findUnique({ 
      where: { stravaId: athlete.id } 
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          stravaId: athlete.id,
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_at,
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_at,
        }
      });
    }

    req.session.userId = user.id;
    
    // Check if this was a mobile auth request
    const authSource = req.session.authSource || 'web';
    
    if (authSource === 'mobile') {
      // For mobile apps, create a temporary auth token and redirect to deep link
      const crypto = require('crypto');
      const mobileAuthToken = crypto.randomBytes(32).toString('hex');
      
      // Store the token temporarily (expires in 5 minutes)
      const expiresAt = Date.now() + (5 * 60 * 1000);
      req.session[`mobileAuth_${mobileAuthToken}`] = {
        userId: user.id,
        expiresAt: expiresAt
      };
      
      // Check if this is a development build (supports deep linking)
      const userAgent = req.headers['user-agent'] || '';
      const isDevBuild = req.query.dev === 'true'; // Allow override with ?dev=true
      
      if (isDevBuild) {
        // Development build - use deep link
        const deepLinkUrl = `ridedomestique://auth/callback?token=${mobileAuthToken}`;
        res.redirect(deepLinkUrl);
      } else {
        // Expo Go or fallback - show the token page
        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              margin: 0;
            }
            .container {
              max-width: 400px;
              margin: 0 auto;
              background: rgba(255,255,255,0.95);
              color: #333;
              padding: 30px;
              border-radius: 20px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .icon { font-size: 50px; margin-bottom: 20px; }
            h1 { margin-bottom: 20px; color: #667eea; font-size: 24px; }
            p { margin-bottom: 15px; line-height: 1.5; }
            .success { color: #48bb78; font-weight: bold; }
            .token-container {
              background: #f8f9ff;
              border: 2px dashed #667eea;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .token {
              font-family: monospace;
              font-size: 12px;
              color: #667eea;
              font-weight: bold;
              word-break: break-all;
              background: white;
              padding: 10px;
              border-radius: 4px;
              margin: 10px 0;
            }
            .copy-btn, .close-btn {
              background: #667eea;
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              font-size: 14px;
              margin: 5px;
              cursor: pointer;
            }
            .copy-btn { background: #48bb78; }
            .instructions {
              font-size: 14px;
              color: #666;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">🚴‍♂️</div>
            <h1>Authentication Successful!</h1>
            <p class="success">Connected to Strava successfully</p>
            
            <div class="token-container">
              <p><strong>Copy this code:</strong></p>
              <div class="token" id="token">${mobileAuthToken}</div>
              <button class="copy-btn" onclick="copyToken()">Copy Code</button>
            </div>
            
            <p class="instructions">
              1. Copy the code above<br>
              2. Return to <strong>Ride Domestique</strong><br>
              3. Tap "Paste Auth Code"<br>
              4. Paste and confirm
            </p>
            
            <button class="close-btn" onclick="window.close()">Close Page</button>
          </div>
          
          <script>
            function copyToken() {
              const token = document.getElementById('token').textContent;
              navigator.clipboard.writeText(token).then(() => {
                const btn = document.querySelector('.copy-btn');
                btn.textContent = 'Copied!';
                btn.style.background = '#38a169';
                setTimeout(() => {
                  btn.textContent = 'Copy Code';
                  btn.style.background = '#48bb78';
                }, 2000);
              }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = token;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Code copied to clipboard!');
              });
            }
          </script>
        </body>
        </html>
      `);
      }
    } else {
      // Web app redirect
      res.redirect(`${FRONTEND_URL}/dashboard`);
    }
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication failed");
  }
});

// Endpoint for mobile apps to check auth status
app.get("/api/auth/status", async (req, res) => {
  if (req.session.userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: {
          id: true,
          stravaId: true,
          firstname: true,
          lastname: true,
          ftp: true,
          hrmax: true,
          isFastTwitch: true,
        }
      });
      
      if (user) {
        return res.json({ 
          authenticated: true, 
          user: user 
        });
      }
    } catch (error) {
      console.error("Auth status error:", error);
    }
  }
  
  res.json({ authenticated: false });
});

// Endpoint for mobile apps to exchange auth token for session
app.post("/api/auth/mobile", async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }
  
  const tokenKey = `mobileAuth_${token}`;
  const authData = req.session[tokenKey];
  
  if (!authData) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  
  if (Date.now() > authData.expiresAt) {
    delete req.session[tokenKey];
    return res.status(400).json({ error: 'Token expired' });
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: authData.userId },
      select: {
        id: true,
        stravaId: true,
        firstname: true,
        lastname: true,
        ftp: true,
        hrmax: true,
        isFastTwitch: true,
      }
    });
    
    if (user) {
      // Set up the session for this mobile app
      req.session.userId = user.id;
      // Clean up the temporary token
      delete req.session[tokenKey];
      
      return res.json({ 
        authenticated: true, 
        user: user 
      });
    }
    
    res.status(404).json({ error: 'User not found' });
  } catch (error) {
    console.error("Mobile auth error:", error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post("/api/analyze", requireAuth, async (req, res) => {
  const { startDate, endDate } = req.body;
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId }
  });

  // Fetch activities
  const activities = await fetchActivities(
    user,
    new Date(startDate),
    new Date(endDate)
  );

  // Filter for rides only
  const rides = activities.filter(
    (a) => a.type === "Ride" || a.type === "VirtualRide"
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
    message: `Found ${analyzed.length} activities`,
  });
});

app.get("/api/interview", requireAuth, (req, res) => {
  if (!req.session.activities) {
    return res
      .status(400)
      .json({ error: "No activities found. Please analyze activities first." });
  }

  res.json({
    activities: req.session.activities.map((a) => ({
      id: a.id,
      name: a.name,
      startDate: a.startDate,
      durationSec: a.durationSec,
    })),
  });
});

app.post("/api/interview", requireAuth, (req, res) => {
  if (!req.session.activities) {
    return res.status(400).json({ error: "No activities found" });
  }

  req.session.responses = req.body;

  const output = generateCoachingOutput(
    req.session.activities,
    req.session.responses,
    req.session.dateRange
  );

  res.json({
    success: true,
    output: output,
  });
});

app.put("/api/settings", requireAuth, async (req, res) => {
  const { ftp, hrmax, isFastTwitch } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });
    const updateData = {
      ftp: parseInt(ftp),
      hrmax: parseInt(hrmax),
    };
    
    // Update fast twitch status if provided
    if (isFastTwitch !== undefined) {
      updateData.isFastTwitch = isFastTwitch;
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        ftp: user.ftp,
        hrmax: user.hrmax,
        isFastTwitch: user.isFastTwitch,
      },
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ success: false, error: "Failed to save settings" });
  }
});

// Goals API
app.get("/api/goals", requireAuth, async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.session.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(goals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

app.post("/api/goals", requireAuth, async (req, res) => {
  try {
    const goal = await prisma.goal.create({
      data: {
        ...req.body,
        userId: req.session.userId
      }
    });
    res.json(goal);
  } catch (error) {
    console.error("Error saving goal:", error);
    res.status(500).json({ error: "Failed to save goal" });
  }
});

// Quick Stats API
app.post("/api/quick-stats", requireAuth, async (req, res) => {
  const { start, end } = req.body;
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId }
  });

  try {
    // Fetch activities for the date range
    const activities = await fetchActivities(
      user,
      new Date(start),
      new Date(end)
    );

    // Filter for rides only
    const rides = activities.filter(
      (a) => a.type === "Ride" || a.type === "VirtualRide"
    );

    if (rides.length === 0) {
      return res.json({
        totalActivities: 0,
        totalTime: 0,
        totalDistance: 0,
        totalElevation: 0,
        totalTSS: 0,
        avgPower: 0,
        maxPower: 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        recentActivities: [],
        powerZoneDistribution: {},
        hrZoneDistribution: {}
      });
    }

    // Calculate aggregate stats
    const totalTime = rides.reduce((sum, a) => sum + a.elapsed_time, 0);
    const totalDistance = rides.reduce((sum, a) => sum + (a.distance / 1000), 0);
    const totalElevation = rides.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);
    
    const ridesWithPower = rides.filter(a => a.average_watts);
    const avgPower = ridesWithPower.length > 0 
      ? ridesWithPower.reduce((sum, a) => sum + a.average_watts, 0) / ridesWithPower.length 
      : 0;
    const maxPower = rides.reduce((max, a) => Math.max(max, a.max_watts || 0), 0);

    const ridesWithHR = rides.filter(a => a.average_heartrate);
    const avgHeartRate = ridesWithHR.length > 0 
      ? ridesWithHR.reduce((sum, a) => sum + a.average_heartrate, 0) / ridesWithHR.length 
      : 0;
    const maxHeartRate = rides.reduce((max, a) => Math.max(max, a.max_heartrate || 0), 0);

    const avgSpeed = rides.reduce((sum, a) => sum + (a.average_speed || 0), 0) / rides.length;
    const maxSpeed = rides.reduce((max, a) => Math.max(max, a.max_speed || 0), 0);

    // Calculate TSS for rides with power
    let totalTSS = 0;
    for (const ride of ridesWithPower) {
      if (ride.weighted_average_watts) {
        const intensityFactor = ride.weighted_average_watts / user.ftp;
        const tss = (ride.elapsed_time * ride.weighted_average_watts * intensityFactor) / (user.ftp * 3600) * 100;
        totalTSS += tss;
      }
    }

    // Get recent activities with basic info
    const recentActivities = rides.slice(0, 10).map(activity => ({
      name: activity.name,
      startDate: activity.start_date_local,
      distanceKm: activity.distance / 1000,
      durationSec: activity.elapsed_time,
      avgPower: activity.average_watts
    }));

    res.json({
      totalActivities: rides.length,
      totalTime,
      totalDistance,
      totalElevation,
      totalTSS,
      avgPower,
      maxPower,
      avgHeartRate,
      maxHeartRate,
      avgSpeed,
      maxSpeed,
      recentActivities,
      powerZoneDistribution: {}, // Would need detailed analysis for this
      hrZoneDistribution: {} // Would need detailed analysis for this
    });

  } catch (error) {
    console.error("Error fetching quick stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// AI Coaching endpoints
app.post("/api/coach/message", requireAuth, async (req, res) => {
  try {
    const { message, includeRecentData } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get recent training data if requested
    let trainingData = null;
    if (includeRecentData) {
      const endDate = new Date();
      const startDate = subDays(endDate, 7);
      
      const activities = await getActivitiesInRange(
        user,
        startDate,
        endDate
      );
      
      trainingData = {
        weeklyTSS: activities.reduce((sum, act) => sum + (act.tss || 0), 0),
        activities: activities.slice(0, 5).map(act => ({
          name: act.name,
          date: act.startDate,
          tss: act.tss,
          avgPower: act.avgPower,
          hrDrift: act.hrDrift,
          intensityFactor: act.intensityFactor
        }))
      };
    }

    // Send message to AI coach
    const response = await aiCoach.sendCoachingMessage(
      user,
      message,
      trainingData
    );

    res.json({ response });
  } catch (error) {
    console.error("AI coaching error:", error);
    res.status(500).json({ error: "Failed to get coaching response" });
  }
});

app.post("/api/coach/analyze-workout", requireAuth, async (req, res) => {
  try {
    const { activityId } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get detailed activity analysis
    const activity = await analyzeActivity(user, activityId);
    
    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    // Create structured message for AI coach
    const message = `Please analyze this workout and provide specific feedback:
    
Workout: ${activity.name}
Duration: ${Math.round(activity.durationSec / 60)} minutes
Average Power: ${activity.avgPower}W
Normalized Power: ${activity.weightedAvgPower}W
Intensity Factor: ${activity.intensityFactor}
TSS: ${activity.tss}
HR Drift: ${activity.hrDrift}%
Power Zones: ${JSON.stringify(activity.powerZones)}
HR Zones: ${JSON.stringify(activity.hrZones)}`;

    const response = await aiCoach.sendCoachingMessage(
      user,
      message,
      activity
    );

    res.json({ response, activity });
  } catch (error) {
    console.error("Workout analysis error:", error);
    res.status(500).json({ error: "Failed to analyze workout" });
  }
});

app.post("/api/coach/clear-history", requireAuth, async (req, res) => {
  try {
    aiCoach.clearHistory(req.session.userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Clear history error:", error);
    res.status(500).json({ error: "Failed to clear conversation history" });
  }
});

app.put("/api/coach/settings", requireAuth, async (req, res) => {
  try {
    const { slidingWindowSize, provider, model } = req.body;
    
    if (slidingWindowSize) {
      aiCoach.setSlidingWindowSize(slidingWindowSize);
    }
    
    if (provider || model) {
      aiCoach.switchProvider(
        provider || aiCoach.provider,
        null, // Keep existing API key
        model || aiCoach.model
      );
    }
    
    res.json({ 
      success: true,
      settings: {
        slidingWindowSize: aiCoach.slidingWindowSize,
        provider: aiCoach.provider,
        model: aiCoach.model
      }
    });
  } catch (error) {
    console.error("Update coach settings error:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Serve React app for all non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dist/index.html"));
});

// Initialize server
async function initializeServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("Database connected");
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(
        `Default FTP: ${DEFAULT_FTP}W, Default HR Max: ${DEFAULT_HRMAX}bpm`
      );
      console.log("Visit http://localhost:3333 to access the React frontend");
    });
  } catch (err) {
    console.error("Failed to initialize server:", err);
  }
}

initializeServer();
