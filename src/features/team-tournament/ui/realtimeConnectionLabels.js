import { TT_REALTIME_CONNECTION } from "../realtime/realtimeConnectionState.js";
import { isTeamTournamentRealtimeEnabled } from "../realtime/realtimeFlags.js";

/** Vietnamese labels for TT realtime connection states (user-facing). */
export const TT_REALTIME_CONNECTION_VI = Object.freeze({
  [TT_REALTIME_CONNECTION.IDLE]: "Chờ đồng bộ",
  [TT_REALTIME_CONNECTION.CONNECTING]: "Đang kết nối",
  [TT_REALTIME_CONNECTION.CONNECTED]: "Đã kết nối",
  [TT_REALTIME_CONNECTION.DEGRADED]: "Mất kết nối — đang đồng bộ dự phòng",
  [TT_REALTIME_CONNECTION.RECONNECTING]: "Đang kết nối lại",
  [TT_REALTIME_CONNECTION.DISCONNECTED]: "Mất kết nối — đang đồng bộ dự phòng",
  [TT_REALTIME_CONNECTION.UNAUTHORIZED]: "Không có quyền truy cập",
  [TT_REALTIME_CONNECTION.ERROR]: "Lỗi đồng bộ",
  [TT_REALTIME_CONNECTION.CLOSED]: "Đã ngắt đồng bộ",
});

export const TT_REALTIME_POLLING_ONLY_VI = "Đồng bộ định kỳ";

/**
 * @param {string} state
 * @param {{ pollingOnly?: boolean }} [options]
 */
export function getRealtimeConnectionLabel(state, options = {}) {
  if (!isTeamTournamentRealtimeEnabled() || options.pollingOnly) {
    return TT_REALTIME_POLLING_ONLY_VI;
  }
  return TT_REALTIME_CONNECTION_VI[state] || TT_REALTIME_CONNECTION_VI[TT_REALTIME_CONNECTION.CONNECTING];
}

/**
 * @param {string} state
 * @returns {'success'|'info'|'warning'|'error'}
 */
export function getRealtimeConnectionSeverity(state) {
  switch (state) {
    case TT_REALTIME_CONNECTION.CONNECTED:
      return "success";
    case TT_REALTIME_CONNECTION.CONNECTING:
    case TT_REALTIME_CONNECTION.RECONNECTING:
      return "info";
    case TT_REALTIME_CONNECTION.DEGRADED:
    case TT_REALTIME_CONNECTION.DISCONNECTED:
      return "warning";
    case TT_REALTIME_CONNECTION.UNAUTHORIZED:
    case TT_REALTIME_CONNECTION.ERROR:
      return "error";
    default:
      return "info";
  }
}

/**
 * Whether to show a prominent banner (degraded / error / unauthorized).
 * @param {string} state
 * @param {boolean} [pollingOnly]
 */
export function shouldShowRealtimeBanner(state, pollingOnly = false) {
  if (pollingOnly || !isTeamTournamentRealtimeEnabled()) {
    return false;
  }
  return (
    state === TT_REALTIME_CONNECTION.DEGRADED ||
    state === TT_REALTIME_CONNECTION.DISCONNECTED ||
    state === TT_REALTIME_CONNECTION.RECONNECTING ||
    state === TT_REALTIME_CONNECTION.ERROR ||
    state === TT_REALTIME_CONNECTION.UNAUTHORIZED
  );
}

/**
 * @param {number|null|undefined} timestampMs
 */
export function formatLastUpdateLabel(timestampMs) {
  if (!timestampMs) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestampMs));
  } catch {
    return null;
  }
}
