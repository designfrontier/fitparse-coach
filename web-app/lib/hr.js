function calculateAerobicDecoupling(
  powerData, // array of watts
  hrData, // array of bpm
  laps = null, // optional laps with elapsed_time etc.
  user = { hrmax: 180, ftp: 250 },
  options = {}
) {
  const {
    sampleRateHz = 1, // samples per second
    minMainMinutes = 10, // require at least 10 min for validity (reduced from 20)
    warmupGuessSec = 600, // fallback warmup trim if no laps
    cooldownGuessSec = 300, // fallback cooldown trim if no laps
    powerMin = 30, // drop near-zero power (coasting)
    hrMin = 60,
    hrMax = 220, // drop HR artifacts
    trimPct = 0.02, // robust mean: trim 2% tails
    requireSteadyCV = 0.35, // reject if CV(power) > 35% in main set (increased for intervals)
  } = options;

  if (!powerData || !hrData || powerData.length !== hrData.length) return null;
  if (powerData.length < minMainMinutes * 60 * sampleRateHz) return null;

  // --- Determine start/end indices (exclude warm-up & cooldown) ---
  let startIdx = 0,
    endIdx = powerData.length;

  if (laps && laps.length >= 2) {
    // Assume 1Hz unless specified; convert elapsed to samples
    const toIdx = (sec) =>
      Math.max(0, Math.min(powerData.length, Math.round(sec * sampleRateHz)));

    const firstLap = laps[0];
    if (firstLap?.elapsed_time >= 600 && firstLap.elapsed_time <= 1200) {
      startIdx = toIdx(firstLap.elapsed_time);
    }

    const lastLap = laps[laps.length - 1];
    const z1Thresh = user?.hrmax ? user.hrmax * 0.6 : 110;
    const lastLapLooksCooldown =
      (lastLap?.average_heartrate && lastLap.average_heartrate < z1Thresh) ||
      (lastLap?.average_watts &&
        lastLap?.max_watts &&
        (lastLap.max_watts - lastLap.average_watts) /
          Math.max(1, lastLap.max_watts) >
          0.3) ||
      (lastLap?.elapsed_time && lastLap.elapsed_time <= 900);

    if (lastLapLooksCooldown && lastLap?.elapsed_time) {
      endIdx = toIdx(powerData.length / sampleRateHz - lastLap.elapsed_time);
      endIdx = Math.max(endIdx, startIdx + 60 * sampleRateHz);
    }
  } else {
    // Fallback trims if no laps
    const n = powerData.length;
    startIdx = Math.min(n, Math.round(warmupGuessSec * sampleRateHz));
    endIdx = Math.max(
      startIdx,
      n - Math.round(cooldownGuessSec * sampleRateHz)
    );
  }

  if (endIdx - startIdx < minMainMinutes * 60 * sampleRateHz) return null;

  // --- Extract main set & clean data ---
  const P = [],
    H = [];
  for (let i = startIdx; i < endIdx; i++) {
    const p = powerData[i],
      h = hrData[i];
    if (p == null || h == null) continue;
    if (p < powerMin) continue; // drop coasting
    if (h < hrMin || h > hrMax) continue; // drop HR artifacts
    P.push(p);
    H.push(h);
  }
  if (P.length < minMainMinutes * 60 * sampleRateHz * 0.6) return null;

  // --- Optional steadiness check (reject very spiky segments) ---
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mP = mean(P);
  const sdP = Math.sqrt(mean(P.map((x) => (x - mP) ** 2)));
  const cvP = sdP / Math.max(1, mP);
  if (cvP > requireSteadyCV) return null;

  // --- Robust mean via trimmed mean ---
  function trimmedMean(arr, frac = trimPct) {
    if (arr.length === 0) return null;
    const a = [...arr].sort((x, y) => x - y);
    const cut = Math.floor(a.length * frac);
    const b = a.slice(cut, a.length - cut);
    return b.reduce((s, x) => s + x, 0) / b.length;
  }

  const half = Math.floor(P.length / 2);
  const P1 = P.slice(0, half),
    P2 = P.slice(half);
  const H1 = H.slice(0, half),
    H2 = H.slice(half);

  const P1m = trimmedMean(P1),
    P2m = trimmedMean(P2);
  const H1m = trimmedMean(H1),
    H2m = trimmedMean(H2);
  if (!P1m || !P2m || !H1m || !H2m) return null;

  // --- Compute both metrics ---
  // HR-per-watt drift (preferred): positive = HR rose vs power (less efficient)
  const hrPerWatt1 = H1m / P1m;
  const hrPerWatt2 = H2m / P2m;
  const drift_hrPerWatt = 100 * (hrPerWatt2 / hrPerWatt1 - 1);

  // EF drift (P/HR), typically negative when HR rises
  const ef1 = P1m / H1m;
  const ef2 = P2m / H2m;
  const drift_EF = 100 * (ef2 / ef1 - 1);

  return {
    drift_hrPerWatt: Math.round(drift_hrPerWatt * 100) / 100,
    drift_EF: Math.round(drift_EF * 100) / 100,
    segmentSeconds: Math.round((endIdx - startIdx) / sampleRateHz),
    startIdx,
    endIdx,
    meanPower: Math.round(mP),
    meanHR: Math.round(mean(H)),
    cvPower: Math.round(cvP * 100) / 100,
  };
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

module.exports = { calculateAerobicDecoupling, calculateHrZones };
