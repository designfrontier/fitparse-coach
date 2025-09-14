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

module.exports = { calculatePowerCurve, calculatePowerZones };
