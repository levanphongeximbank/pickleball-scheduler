/** Feature flag — bật khi có relay server hoặc cần ghi VOD. */
export function isTournamentBroadcastEnabled() {
  return String(import.meta.env?.VITE_ENABLE_TOURNAMENT_BROADCAST || "").toLowerCase() === "true";
}

export function getBroadcastRelayUrl() {
  const url = String(import.meta.env?.VITE_BROADCAST_RELAY_URL || "").trim();
  return url.replace(/\/$/, "");
}

export const BROADCAST_PLATFORMS = Object.freeze({
  youtube: Object.freeze({
    id: "youtube",
    label: "YouTube Live",
    defaultRtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
    supportsRelay: true,
  }),
  facebook: Object.freeze({
    id: "facebook",
    label: "Facebook Live",
    defaultRtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp",
    supportsRelay: true,
  }),
  zalo: Object.freeze({
    id: "zalo",
    label: "Zalo Live",
    defaultRtmpUrl: "",
    supportsRelay: false,
    note: "Chưa hỗ trợ relay trực tiếp — dùng OBS quay màn trình chiếu.",
  }),
});

export const BROADCAST_STATUS = Object.freeze({
  IDLE: "idle",
  PREPARING: "preparing",
  LIVE: "live",
  UPLOADING: "uploading",
  STOPPING: "stopping",
  ERROR: "error",
});
