const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const { format, subDays, startOfWeek, endOfWeek } = require("date-fns");
const AICoachingService = require("./services/aiCoaching");
const prisma = require("./lib/prisma");
const { calculateAerobicDecoupling, calculateHrZones } = require("./lib/hr");
const { calculatePowerCurve, calculatePowerZones } = require("./lib/power");
require("dotenv").config();

const { get: getGoals, post: postGoals } = require("./routes/goals");
const { post: postQuickStats } = require("./routes/quick-stats");
const { post: postConfig, get: getConfig } = require("./routes/config");
const { get: getUser } = require("./routes/user");
const {
  get: getAIAnalyses,
  getLatest: getLatestAIAnalysis,
  getById: getAIAnalysisById,
  post: postAIAnalysis,
  delete: deleteAIAnalysis,
} = require("./routes/ai-analysis");
const {
  getAuthStatus,
  postAuthMobile,
  getAuthCallback,
  getAuthStrava,
  logout,
} = require("./routes/auth");
const { getStravaConfig } = require("./lib/config");

const app = express();
const PORT = process.env.PORT || 5555;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3333";

// Default values - will be overridden by user settings
const DEFAULT_FTP = 250;
const DEFAULT_HRMAX = 180;

// Middleware
app.use(
  cors({
    origin: [
      FRONTEND_URL,
      "exp://192.168.86.242:8081",
      "http://localhost:8081",
      "exp://localhost:8081",
    ],
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
      sameSite: "lax", // CSRF protection while allowing normal navigation
    },
  })
);

// Database connection is handled by Prisma

// Initialize AI Coaching Service
const aiCoach = new AICoachingService({
  provider: process.env.AI_PROVIDER || "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.AI_MODEL || "gpt-4-turbo-preview",
  slidingWindowSize: parseInt(process.env.AI_SLIDING_WINDOW || "10"),
});

// Database models are defined in prisma/schema.prisma

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
        },
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
    if (
      streams.watts &&
      streams.watts.data &&
      streams.heartrate &&
      streams.heartrate.data
    ) {
      const aerobicDecoupling = calculateAerobicDecoupling(
        streams.watts.data,
        streams.heartrate.data,
        laps,
        user
      );

      if (aerobicDecoupling !== null) {
        results.aerobicDecoupling = aerobicDecoupling.drift_EF;
        // Keep hrDrift for backward compatibility
        results.hrDrift = aerobicDecoupling.drift_hrPerWatt;
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
        lines.push(`HR Drift (HR/Watt): ${activity.hrDrift}%`);
      }
      if (activity.aerobicDecoupling !== undefined) {
        lines.push(`Aerobic Decoupling (EF): ${activity.aerobicDecoupling}%`);
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
app.get("/api/user", getUser);

app.get("/api/config", getConfig);
app.post("/api/config", postConfig);

app.post("/api/logout", logout);
app.get("/auth/strava", getAuthStrava);
app.get("/auth/callback", getAuthCallback);

// Endpoint for mobile apps to check auth status
app.get("/api/auth/status", getAuthStatus);

// Endpoint for mobile apps to exchange auth token for session
app.post("/api/auth/mobile", postAuthMobile);

app.post("/api/analyze", requireAuth, async (req, res) => {
  const { startDate, endDate } = req.body;
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
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
      where: { id: req.session.userId },
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
      data: updateData,
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
app.get("/api/goals", requireAuth, getGoals);
app.post("/api/goals", requireAuth, postGoals);

// AI Analysis API
app.get("/api/ai-analysis", requireAuth, getAIAnalyses);
app.get("/api/ai-analysis/latest", requireAuth, getLatestAIAnalysis);
app.get("/api/ai-analysis/:id", requireAuth, getAIAnalysisById);
app.post("/api/ai-analysis", requireAuth, postAIAnalysis);
app.delete("/api/ai-analysis/:id", requireAuth, deleteAIAnalysis);

// Quick Stats API
app.post("/api/quick-stats", requireAuth, postQuickStats);

// AI Coaching endpoints
app.post("/api/coach/message", requireAuth, async (req, res) => {
  try {
    const { message, includeRecentData } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get recent training data if requested
    let trainingData = null;
    if (includeRecentData) {
      const endDate = new Date();
      const startDate = subDays(endDate, 7);

      const activities = await getActivitiesInRange(user, startDate, endDate);

      trainingData = {
        weeklyTSS: activities.reduce((sum, act) => sum + (act.tss || 0), 0),
        activities: activities.slice(0, 5).map((act) => ({
          name: act.name,
          date: act.startDate,
          tss: act.tss,
          avgPower: act.avgPower,
          hrDrift: act.hrDrift,
          intensityFactor: act.intensityFactor,
        })),
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
      where: { id: req.session.userId },
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
HR Drift (HR/Watt): ${activity.hrDrift}%
Aerobic Decoupling (EF): ${activity.aerobicDecoupling}%
Power Zones: ${JSON.stringify(activity.powerZones)}
HR Zones: ${JSON.stringify(activity.hrZones)}`;

    const response = await aiCoach.sendCoachingMessage(user, message, activity);

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
        model: aiCoach.model,
      },
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
