export const SCORE_LOG_SOURCE = {
  REFEREE: "referee",
  DIRECTOR: "director",
  DIRECTOR_OVERRIDE: "director_override",
  DISPUTE_RESET: "dispute_reset",
};

export const SCORE_LOG_ACTION = {
  ADJUST: "adjust",
  FINALIZED: "finalized",
  ADMIN_OVERRIDE: "admin_override",
  DISPUTE_RESET: "dispute_reset",
};

const VALID_SOURCES = new Set(Object.values(SCORE_LOG_SOURCE));
const VALID_ACTIONS = new Set(Object.values(SCORE_LOG_ACTION));

export const REFEREE_LINK_LOCKED_MESSAGE =
  "Link trọng tài không hợp lệ hoặc trận đấu đã bị khóa.";

function createScoreLogId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `log-${crypto.randomUUID().slice(0, 12)}`;
  }

  return `log-${Date.now()}`;
}

function toScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function normalizeScoreLogEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const source = String(entry.source || "").trim().toLowerCase();
  const action = String(entry.action || "").trim().toLowerCase();

  if (!VALID_SOURCES.has(source) && !VALID_ACTIONS.has(action)) {
    return null;
  }

  const resolvedSource = VALID_SOURCES.has(source) ? source : SCORE_LOG_SOURCE.REFEREE;
  const resolvedAction = VALID_ACTIONS.has(action)
    ? action
    : resolvedSource === SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE
      ? SCORE_LOG_ACTION.ADMIN_OVERRIDE
      : resolvedSource === SCORE_LOG_SOURCE.DISPUTE_RESET
        ? SCORE_LOG_ACTION.DISPUTE_RESET
        : "";

  return {
    id: entry.id ? String(entry.id) : createScoreLogId(),
    at: entry.at || new Date().toISOString(),
    source: resolvedSource,
    action: resolvedAction,
    actorName: String(entry.actorName || "").trim() || "Hệ thống",
    matchId: entry.matchId ? String(entry.matchId) : "",
    refereeToken: entry.refereeToken ? String(entry.refereeToken) : "",
    team: entry.team === "A" || entry.team === "B" ? entry.team : "",
    delta: Number.isFinite(Number(entry.delta)) ? Number(entry.delta) : 0,
    oldScoreA: toScore(entry.oldScoreA),
    oldScoreB: toScore(entry.oldScoreB),
    scoreA: toScore(entry.scoreA),
    scoreB: toScore(entry.scoreB),
    userAgent: entry.userAgent ? String(entry.userAgent).slice(0, 240) : "",
    note: entry.note ? String(entry.note).trim() : "",
    sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : index,
  };
}

export function normalizeScoreLog(entries = []) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => normalizeScoreLogEntry(entry, index))
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = new Date(left.at).getTime();
      const rightTime = new Date(right.at).getTime();
      return leftTime - rightTime || left.sortOrder - right.sortOrder;
    });
}

export function createScoreLogEntry(options = {}) {
  return normalizeScoreLogEntry({
    id: createScoreLogId(),
    at: new Date().toISOString(),
    source: options.source || SCORE_LOG_SOURCE.DIRECTOR,
    action: options.action || "",
    actorName: options.actorName || "BTC",
    matchId: options.matchId || "",
    refereeToken: options.refereeToken || "",
    team: options.team || "",
    delta: options.delta ?? 0,
    oldScoreA: options.oldScoreA,
    oldScoreB: options.oldScoreB,
    scoreA: options.scoreA,
    scoreB: options.scoreB,
    userAgent: options.userAgent || "",
    note: options.note || "",
  });
}

export function createScoreAdjustLogEntry({
  source = SCORE_LOG_SOURCE.REFEREE,
  actorName = "Trọng tài",
  matchId = "",
  refereeToken = "",
  team = "A",
  delta = 1,
  oldScoreA = 0,
  oldScoreB = 0,
  scoreA = 0,
  scoreB = 0,
  userAgent = "",
} = {}) {
  return createScoreLogEntry({
    source,
    action: SCORE_LOG_ACTION.ADJUST,
    actorName,
    matchId,
    refereeToken,
    team,
    delta,
    oldScoreA,
    oldScoreB,
    scoreA,
    scoreB,
    userAgent,
  });
}

export function appendScoreLogToMatch(match, entry) {
  if (!match) {
    return match;
  }

  const normalizedEntry = normalizeScoreLogEntry(entry);
  if (!normalizedEntry) {
    return match;
  }

  return {
    ...match,
    scoreLog: normalizeScoreLog([...(match.scoreLog || []), normalizedEntry]),
  };
}

export function mergeAuditLogIntoMatch(match, auditEntries = []) {
  if (!match || !auditEntries.length) {
    return match;
  }

  return auditEntries.reduce((current, entry) => appendScoreLogToMatch(current, entry), match);
}

export function resolveDirectorScoreLogSource(match, liveRow) {
  if (!match?.referee?.token) {
    return SCORE_LOG_SOURCE.DIRECTOR;
  }

  if (!liveRow) {
    return SCORE_LOG_SOURCE.DIRECTOR;
  }

  const hasLiveActivity =
    liveRow.scoreA > 0 ||
    liveRow.scoreB > 0 ||
    liveRow.status === "finalize_requested" ||
    liveRow.status === "processed" ||
    liveRow.status === "locked";

  return hasLiveActivity ? SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE : SCORE_LOG_SOURCE.DIRECTOR;
}

export function matchHasAdminAdjustment(match) {
  return normalizeScoreLog(match?.scoreLog).some(
    (entry) =>
      entry.action === SCORE_LOG_ACTION.ADMIN_OVERRIDE ||
      entry.source === SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE
  );
}

const SOURCE_LABELS = {
  [SCORE_LOG_SOURCE.REFEREE]: "Trọng tài",
  [SCORE_LOG_SOURCE.DIRECTOR]: "BTC",
  [SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE]: "BTC ghi đè",
  [SCORE_LOG_SOURCE.DISPUTE_RESET]: "Reset tranh chấp",
};

const ACTION_LABELS = {
  [SCORE_LOG_ACTION.ADJUST]: "Điều chỉnh điểm",
  [SCORE_LOG_ACTION.FINALIZED]: "Chốt kết quả",
  [SCORE_LOG_ACTION.ADMIN_OVERRIDE]: "BTC điều chỉnh",
  [SCORE_LOG_ACTION.DISPUTE_RESET]: "Reset tranh chấp",
};

export function formatScoreLogEntry(entry) {
  const normalized = normalizeScoreLogEntry(entry);
  if (!normalized) {
    return "";
  }

  const label = SOURCE_LABELS[normalized.source] || normalized.source;
  const actionLabel = ACTION_LABELS[normalized.action] || "";
  const time = new Date(normalized.at).toLocaleString("vi-VN");

  if (normalized.action === SCORE_LOG_ACTION.ADJUST) {
    const teamLabel = normalized.team === "A" ? "Đội A" : normalized.team === "B" ? "Đội B" : "Điểm";
    const deltaLabel = normalized.delta > 0 ? `+${normalized.delta}` : String(normalized.delta);
    return `${time} · ${label} ${normalized.actorName}: ${teamLabel} ${deltaLabel} (${normalized.oldScoreA}-${normalized.oldScoreB} → ${normalized.scoreA}-${normalized.scoreB})`;
  }

  const scoreText = `${normalized.scoreA}-${normalized.scoreB}`;
  const noteText = normalized.note ? ` — ${normalized.note}` : "";
  const prefix = actionLabel ? `${actionLabel} · ` : "";

  return `${time} · ${prefix}${label} ${normalized.actorName}: ${scoreText}${noteText}`;
}

export function getLatestScoreLogEntry(match) {
  const log = normalizeScoreLog(match?.scoreLog);
  return log.length ? log[log.length - 1] : null;
}

export function getClientUserAgent() {
  if (typeof navigator === "undefined") {
    return "";
  }

  return String(navigator.userAgent || "").slice(0, 240);
}
