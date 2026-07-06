import { getBroadcastRelayUrl } from "../constants/broadcastConfig.js";

function relayBaseUrl() {
  const url = getBroadcastRelayUrl();
  if (!url) {
    return null;
  }
  return url;
}

export function isRelayAvailable() {
  return Boolean(relayBaseUrl());
}

export async function createRelaySession({ tournamentId, tournamentName, destinations = [] }) {
  const baseUrl = relayBaseUrl();
  if (!baseUrl) {
    return { ok: false, error: "Chưa cấu hình VITE_BROADCAST_RELAY_URL." };
  }

  if (!destinations.length) {
    return { ok: false, error: "Chưa chọn nền tảng phát live." };
  }

  const response = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tournamentId,
      tournamentName,
      destinations,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: text || `Relay từ chối (${response.status}).` };
  }

  const data = await response.json();
  return { ok: true, sessionId: data.sessionId };
}

export async function appendRelayChunk(sessionId, blob) {
  const baseUrl = relayBaseUrl();
  if (!baseUrl || !sessionId) {
    return { ok: false, error: "Thiếu relay session." };
  }

  const response = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/chunks`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "video/webm" },
    body: blob,
  });

  if (!response.ok) {
    return { ok: false, error: `Upload chunk thất bại (${response.status}).` };
  }

  return { ok: true };
}

export async function endRelaySession(sessionId) {
  const baseUrl = relayBaseUrl();
  if (!baseUrl || !sessionId) {
    return { ok: false, error: "Thiếu relay session." };
  }

  const response = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/end`, {
    method: "POST",
  });

  if (!response.ok) {
    return { ok: false, error: `Kết thúc relay thất bại (${response.status}).` };
  }

  const data = await response.json().catch(() => ({}));
  return { ok: true, ...data };
}
