const { getStravaConfig } = require("../lib/config");
const prisma = require("../lib/prisma");

const post = async (req, res) => {
  const { clientId, clientSecret } = req.body;

  try {
    // Save to database
    await prisma.config.upsert({
      where: { key: "STRAVA_CLIENT_ID" },
      update: { value: clientId },
      create: { key: "STRAVA_CLIENT_ID", value: clientId },
    });
    await prisma.config.upsert({
      where: { key: "STRAVA_CLIENT_SECRET" },
      update: { value: clientSecret },
      create: { key: "STRAVA_CLIENT_SECRET", value: clientSecret },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving config:", error);
    res.status(500).json({ error: "Failed to save configuration" });
  }
};

const get = async (req, res) => {
  const config = await getStravaConfig();

  if (!config.clientId || !config.clientSecret) {
    return res.status(503).json({ error: "Setup required" });
  }

  res.json({
    client_id: config.clientId,
    has_secret: !!config.clientSecret,
  });
};

module.exports = { post, get };
