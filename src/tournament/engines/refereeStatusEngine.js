import { MATCH_STATUS } from "../../models/tournament/constants.js";
import { MATCH_LIVE_STATUS } from "../../domain/matchLiveSync.js";
import { matchHasAdminAdjustment } from "../../models/tournament/scoreLog.js";

export const REFEREE_MATCH_STATUS = {
  NOT_ASSIGNED: "not_assigned",
  NOT_STARTED: "not_started",
  PLAYING: "playing",
  LIVE: "live",
  FINALIZE_PENDING: "finalize_pending",
  FINALIZED: "finalized",
  ADJUSTED: "adjusted",
  DISPUTE: "dispute",
};

export const REFEREE_STATUS_LABELS = {
  [REFEREE_MATCH_STATUS.NOT_ASSIGNED]: "Chưa gán TT",
  [REFEREE_MATCH_STATUS.NOT_STARTED]: "Chưa bắt đầu",
  [REFEREE_MATCH_STATUS.PLAYING]: "Đang thi đấu",
  [REFEREE_MATCH_STATUS.LIVE]: "Điểm live",
  [REFEREE_MATCH_STATUS.FINALIZE_PENDING]: "Chờ BTC xác nhận",
  [REFEREE_MATCH_STATUS.FINALIZED]: "Đã chốt",
  [REFEREE_MATCH_STATUS.ADJUSTED]: "Đã điều chỉnh",
  [REFEREE_MATCH_STATUS.DISPUTE]: "Tranh chấp",
};

export const REFEREE_STATUS_COLORS = {
  [REFEREE_MATCH_STATUS.NOT_ASSIGNED]: "default",
  [REFEREE_MATCH_STATUS.NOT_STARTED]: "default",
  [REFEREE_MATCH_STATUS.PLAYING]: "info",
  [REFEREE_MATCH_STATUS.LIVE]: "success",
  [REFEREE_MATCH_STATUS.FINALIZE_PENDING]: "warning",
  [REFEREE_MATCH_STATUS.FINALIZED]: "success",
  [REFEREE_MATCH_STATUS.ADJUSTED]: "warning",
  [REFEREE_MATCH_STATUS.DISPUTE]: "error",
};

const LOCKED_LIVE_STATUSES = new Set([
  MATCH_LIVE_STATUS.FINALIZE_REQUESTED,
  MATCH_LIVE_STATUS.PROCESSED,
  MATCH_LIVE_STATUS.LOCKED,
]);

export function resolveRefereeMatchStatus(match, liveRow) {
  if (matchHasAdminAdjustment(match)) {
    return REFEREE_MATCH_STATUS.ADJUSTED;
  }

  if (liveRow?.status === MATCH_LIVE_STATUS.PLAYING && (liveRow.scoreA > 0 || liveRow.scoreB > 0)) {
    return REFEREE_MATCH_STATUS.LIVE;
  }

  if (liveRow?.status === MATCH_LIVE_STATUS.FINALIZE_REQUESTED) {
    return REFEREE_MATCH_STATUS.FINALIZE_PENDING;
  }

  if (
    liveRow?.status === MATCH_LIVE_STATUS.PROCESSED ||
    liveRow?.status === MATCH_LIVE_STATUS.LOCKED ||
    match?.status === MATCH_STATUS.COMPLETED ||
    match?.status === MATCH_STATUS.FORFEIT
  ) {
    return REFEREE_MATCH_STATUS.FINALIZED;
  }

  if (!match?.referee?.token) {
    return REFEREE_MATCH_STATUS.NOT_ASSIGNED;
  }

  if (
    match?.status === MATCH_STATUS.PLAYING ||
    match?.status === MATCH_STATUS.ASSIGNED
  ) {
    return REFEREE_MATCH_STATUS.PLAYING;
  }

  return REFEREE_MATCH_STATUS.NOT_STARTED;
}

export function isRefereeMatchLocked(liveRow) {
  return Boolean(liveRow && LOCKED_LIVE_STATUSES.has(liveRow.status));
}

export function resolveRefereeStatusLabel(status) {
  return REFEREE_STATUS_LABELS[status] || "Trận đấu";
}

export function resolveRefereeStatusColor(status) {
  return REFEREE_STATUS_COLORS[status] || "default";
}
