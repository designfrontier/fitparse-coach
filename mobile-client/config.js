import { Platform } from "react-native";
import Constants from "expo-constants";

// Development server configuration options:
// Option 1: Use local IP for direct connection
// export const DEV_IP_OVERRIDE = "192.168.86.242"; // Your machine's IP

// Option 2: Use ngrok URL for Strava OAuth (uncomment when using ngrok)
export const NGROK_URL = "https://cbc4595100ff.ngrok-free.app"; // Your ngrok URL

// Get the development server URL
const getDevServerURL = () => {
  // Check for ngrok URL first (for Strava OAuth)
  if (typeof NGROK_URL !== "undefined") {
    return NGROK_URL;
  }

  // Check for local IP override
  if (typeof DEV_IP_OVERRIDE !== "undefined") {
    return `http://${DEV_IP_OVERRIDE}:5555`;
  }

  // Try to get IP from Expo Constants
  if (Constants.expoConfig?.hostUri) {
    const ip = Constants.expoConfig.hostUri.split(":")[0];
    if (ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:5555`;
    }
  }

  if (Constants.experienceUrl) {
    // Extract IP from Expo's experience URL (works in development)
    const match = Constants.experienceUrl.match(/https?:\/\/([\d.]+):/);
    if (match && match[1]) {
      return `http://${match[1]}:5555`;
    }
  }

  // Fallback to manifest URL if available
  if (Constants.manifest?.debuggerHost) {
    const ip = Constants.manifest.debuggerHost.split(":")[0];
    if (ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:5555`;
    }
  }

  // Try newer manifest2 format
  if (Constants.manifest2?.extra?.expoGo?.debuggerHost) {
    const ip = Constants.manifest2.extra.expoGo.debuggerHost.split(":")[0];
    if (ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:5555`;
    }
  }

  // Last resort fallback
  console.warn(
    "Could not detect local IP, using localhost. Consider setting DEV_IP_OVERRIDE in config.js"
  );
  return "http://localhost:5555";
};

// Configuration for API endpoints
export const API_CONFIG = {
  development: {
    // Use ngrok URL or detected server URL
    baseURL:
      Platform.OS === "web" ? "http://localhost:5555" : getDevServerURL(),
    timeout: 30000,
  },
  production: {
    baseURL: "https://your-production-api.com",
    timeout: 30000,
  },
};

// Get current environment
export const getCurrentEnvironment = () => {
  return __DEV__ ? "development" : "production";
};

// Get current API config
export const getAPIConfig = () => {
  const env = getCurrentEnvironment();
  return API_CONFIG[env];
};

// Manual override for development (if auto-detection fails)
// You can uncomment and modify this if needed:
// export const DEV_IP_OVERRIDE = '192.168.1.100'; // Your machine's IP

export default {
  API_CONFIG,
  getCurrentEnvironment,
  getAPIConfig,
};
