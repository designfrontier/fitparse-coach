const axios = require("axios");
const { getStravaConfig } = require("../lib/config");
const prisma = require("../lib/prisma");

// Strava API configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:5555";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3333";
const REDIRECT_URI = `${BASE_URL}/auth/callback`;

const getAuthStatus = async (req, res) => {
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
        },
      });

      if (user) {
        return res.json({
          authenticated: true,
          user: user,
        });
      }
    } catch (error) {
      console.error("Auth status error:", error);
    }
  }

  res.json({ authenticated: false });
};

const postAuthMobile = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }

  const tokenKey = `mobileAuth_${token}`;
  const authData = req.session[tokenKey];

  if (!authData) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  if (Date.now() > authData.expiresAt) {
    delete req.session[tokenKey];
    return res.status(400).json({ error: "Token expired" });
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
      },
    });

    if (user) {
      // Set up the session for this mobile app
      req.session.userId = user.id;
      // Clean up the temporary token
      delete req.session[tokenKey];

      return res.json({
        authenticated: true,
        user: user,
      });
    }

    res.status(404).json({ error: "User not found" });
  } catch (error) {
    console.error("Mobile auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

const getAuthCallback = async (req, res) => {
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
      where: { stravaId: athlete.id },
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
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_at,
        },
      });
    }

    req.session.userId = user.id;

    // Check if this was a mobile auth request
    const authSource = req.session.authSource || "web";

    if (authSource === "mobile") {
      // For mobile apps, create a temporary auth token and redirect to deep link
      const crypto = require("crypto");
      const mobileAuthToken = crypto.randomBytes(32).toString("hex");

      // Store the token temporarily (expires in 5 minutes)
      const expiresAt = Date.now() + 5 * 60 * 1000;
      req.session[`mobileAuth_${mobileAuthToken}`] = {
        userId: user.id,
        expiresAt: expiresAt,
      };

      // Check if this is a development build (supports deep linking)
      const userAgent = req.headers["user-agent"] || "";
      const isDevBuild = req.query.dev === "true"; // Allow override with ?dev=true

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
      // Web app redirect - go to root, let React router handle the redirect
      res.redirect(`${FRONTEND_URL}/`);
    }
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication failed");
  }
};

const getAuthStrava = async (req, res) => {
  const config = await getStravaConfig();

  if (!config.clientId || !config.clientSecret) {
    return res.redirect("/setup");
  }

  // Store the source (mobile or web) in session for redirect after auth
  const source = req.query.source || "web";
  req.session.authSource = source;

  const authUrl =
    "https://www.strava.com/oauth/authorize?" +
    `client_id=${config.clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `approval_prompt=force&` +
    `scope=read,activity:read_all`;

  console.log("Generated Auth URL:", authUrl);
  console.log("REDIRECT_URI:", REDIRECT_URI);
  console.log("Auth source:", source);
  res.redirect(authUrl);
};

const logout = (req, res) => {
  req.session.destroy();
  res.json({ success: true });
};

module.exports = {
  getAuthStatus,
  postAuthMobile,
  getAuthCallback,
  getAuthStrava,
  logout,
};
