// Helper function to get current config
async function getStravaConfig() {
  try {
    const clientIdConfig = await prisma.config.findUnique({
      where: { key: "STRAVA_CLIENT_ID" },
    });
    const clientSecretConfig = await prisma.config.findUnique({
      where: { key: "STRAVA_CLIENT_SECRET" },
    });

    return {
      clientId: clientIdConfig?.value || process.env.STRAVA_CLIENT_ID,
      clientSecret:
        clientSecretConfig?.value || process.env.STRAVA_CLIENT_SECRET,
    };
  } catch (error) {
    // Fallback to environment variables if database read fails
    return {
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
    };
  }
}

module.exports = { getStravaConfig };
