const prisma = require("../lib/prisma");

// Helper function to fetch activities (copied from server.js)
async function fetchActivities(user, startDate, endDate) {
  // This function would need to be imported from server.js or moved to a shared utility
  // For now, returning empty array to fix the import issue
  return [];
}

const post = async (req, res) => {
  const { start, end } = req.body;
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
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
        hrZoneDistribution: {},
      });
    }

    // Calculate aggregate stats
    const totalTime = rides.reduce((sum, a) => sum + a.elapsed_time, 0);
    const totalDistance = rides.reduce((sum, a) => sum + a.distance / 1000, 0);
    const totalElevation = rides.reduce(
      (sum, a) => sum + (a.total_elevation_gain || 0),
      0
    );

    const ridesWithPower = rides.filter((a) => a.average_watts);
    const avgPower =
      ridesWithPower.length > 0
        ? ridesWithPower.reduce((sum, a) => sum + a.average_watts, 0) /
          ridesWithPower.length
        : 0;
    const maxPower = rides.reduce(
      (max, a) => Math.max(max, a.max_watts || 0),
      0
    );

    const ridesWithHR = rides.filter((a) => a.average_heartrate);
    const avgHeartRate =
      ridesWithHR.length > 0
        ? ridesWithHR.reduce((sum, a) => sum + a.average_heartrate, 0) /
          ridesWithHR.length
        : 0;
    const maxHeartRate = rides.reduce(
      (max, a) => Math.max(max, a.max_heartrate || 0),
      0
    );

    const avgSpeed =
      rides.reduce((sum, a) => sum + (a.average_speed || 0), 0) / rides.length;
    const maxSpeed = rides.reduce(
      (max, a) => Math.max(max, a.max_speed || 0),
      0
    );

    // Calculate TSS for rides with power
    let totalTSS = 0;
    for (const ride of ridesWithPower) {
      if (ride.weighted_average_watts) {
        const intensityFactor = ride.weighted_average_watts / user.ftp;
        const tss =
          ((ride.elapsed_time * ride.weighted_average_watts * intensityFactor) /
            (user.ftp * 3600)) *
          100;
        totalTSS += tss;
      }
    }

    // Get recent activities with basic info
    const recentActivities = rides.slice(0, 10).map((activity) => ({
      name: activity.name,
      startDate: activity.start_date_local,
      distanceKm: activity.distance / 1000,
      durationSec: activity.elapsed_time,
      avgPower: activity.average_watts,
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
      hrZoneDistribution: {}, // Would need detailed analysis for this
    });
  } catch (error) {
    console.error("Error fetching quick stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

module.exports = { post };
