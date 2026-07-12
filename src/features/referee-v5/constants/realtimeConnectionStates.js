export const REALTIME_CONNECTION = Object.freeze({
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  RECONNECTING: "RECONNECTING",
  DISCONNECTED: "DISCONNECTED",
  SYNCING: "SYNCING",
  SYNCED: "SYNCED",
  CONFLICT: "CONFLICT",
  ERROR: "ERROR",
});

export const REALTIME_CONNECTION_VI = Object.freeze({
  [REALTIME_CONNECTION.CONNECTING]: "Đang kết nối",
  [REALTIME_CONNECTION.CONNECTED]: "Đã kết nối",
  [REALTIME_CONNECTION.RECONNECTING]: "Đang kết nối lại",
  [REALTIME_CONNECTION.DISCONNECTED]: "Mất kết nối",
  [REALTIME_CONNECTION.SYNCING]: "Đang đồng bộ",
  [REALTIME_CONNECTION.SYNCED]: "Đã đồng bộ",
  [REALTIME_CONNECTION.CONFLICT]: "Có xung đột",
  [REALTIME_CONNECTION.ERROR]: "Lỗi đồng bộ",
});

export function buildRefereeMatchChannelName(matchId) {
  return `referee-v5:match:${matchId}`;
}

export function extractRealtimeNotification(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  return {
    matchId: row.match_id ?? null,
    tenantId: row.tenant_id ?? null,
    stateVersion: Number(row.state_version ?? row.version ?? 0),
    eventSequence: Number(row.last_event_sequence ?? 0),
    status: row.status ?? null,
    updatedAt: row.updated_at ?? null,
  };
}
