const STORAGE_KEY = "pickleball-tournament-broadcast-config-v1";

function defaultConfig() {
  return {
    autoBroadcastOnFlow: true,
    saveLocalVod: false,
    saveCloudVod: true,
    destinations: {
      youtube: { enabled: false, rtmpUrl: "rtmp://a.rtmp.youtube.com/live2", streamKey: "" },
      facebook: { enabled: false, rtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp", streamKey: "" },
    },
  };
}

export function loadBroadcastConfig(tournamentId) {
  if (!tournamentId) {
    return defaultConfig();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return { ...defaultConfig(), ...(all[tournamentId] || {}) };
  } catch {
    return defaultConfig();
  }
}

export function saveBroadcastConfig(tournamentId, config) {
  if (!tournamentId) {
    return { ok: false, error: "Thiếu tournamentId." };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[tournamentId] = { ...defaultConfig(), ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "Không lưu được cấu hình phát live." };
  }
}

export function getActiveDestinations(config) {
  const items = [];
  const destinations = config?.destinations || {};

  for (const [platformId, dest] of Object.entries(destinations)) {
    if (!dest?.enabled || !dest?.streamKey?.trim()) {
      continue;
    }

    items.push({
      platform: platformId,
      rtmpUrl: dest.rtmpUrl?.trim() || "",
      streamKey: dest.streamKey.trim(),
    });
  }

  return items;
}

export function isBroadcastConfigured(config) {
  return getActiveDestinations(config).length > 0;
}

export function isVodCloudMode(config) {
  return Boolean(config?.saveCloudVod);
}
