/**
 * Viewer-safe Captain Portal Dreambreaker contract.
 * Maps scoped reader payload → matchup.dreambreaker without exposing opponent order IDs.
 */

import { DREAMBREAKER_STATUS } from "../constants.js";

export const CAPTAIN_DREAMBREAKER_ORDER_SIZE = 4;

const ACTIVE_DREAMBREAKER_STATUSES = new Set([
  DREAMBREAKER_STATUS.LINEUP_OPEN,
  DREAMBREAKER_STATUS.READY,
  DREAMBREAKER_STATUS.IN_PROGRESS,
  DREAMBREAKER_STATUS.COMPLETED,
]);

function asId(value) {
  return String(value || "").trim();
}

function uniqueStringIds(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set();
  const next = [];
  for (const value of values) {
    const id = asId(value);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }
  return next;
}

/**
 * Persisted captain/reader Dreambreaker that should mount the order panel.
 * Presence of a pending stub (required=false) must NOT show the panel.
 */
export function isPersistedCaptainDreambreakerActive(dreambreaker) {
  if (!dreambreaker || typeof dreambreaker !== "object") {
    return false;
  }
  if (dreambreaker.required === true) {
    return true;
  }
  return ACTIVE_DREAMBREAKER_STATUSES.has(dreambreaker.status);
}

/**
 * CAS expectedVersion is dreambreaker_states.version only.
 * Never tournament.version or matchup.version.
 */
export function resolveDreambreakerExpectedVersion(matchup) {
  const raw = matchup?.dreambreaker?.version;
  if (raw == null || raw === "") {
    return null;
  }
  const version = Number(raw);
  return Number.isFinite(version) ? version : null;
}

/**
 * Strip opponent athlete IDs and project own order onto the viewer side.
 */
export function projectCaptainPortalMatchupDreambreaker(matchup, viewerTeamId) {
  if (!matchup || typeof matchup !== "object") {
    return matchup;
  }

  const raw = matchup.dreambreaker;
  if (!raw || typeof raw !== "object") {
    return matchup;
  }

  const viewer = asId(viewerTeamId);
  const teamAId = asId(matchup.teamAId);
  const teamBId = asId(matchup.teamBId);
  const isTeamA = Boolean(viewer) && viewer === teamAId;
  const isTeamB = Boolean(viewer) && viewer === teamBId;
  const isParticipant = isTeamA || isTeamB;

  const ownOrder = Array.isArray(raw.ownOrder)
    ? uniqueStringIds(raw.ownOrder)
    : isTeamA
      ? uniqueStringIds(raw.teamAOrder)
      : isTeamB
        ? uniqueStringIds(raw.teamBOrder)
        : [];

  return {
    ...matchup,
    dreambreaker: {
      required: raw.required === true,
      status: raw.status || null,
      version: raw.version ?? null,
      canSubmitOwnOrder: raw.canSubmitOwnOrder === true,
      ownOrder,
      opponentOrderSubmitted: raw.opponentOrderSubmitted === true,
      teamAOrder: isTeamA ? ownOrder : [],
      teamBOrder: isTeamB ? ownOrder : [],
      orderLockAt: raw.orderLockAt || null,
      ordersLockedAt: raw.ordersLockedAt || null,
      orderSourceA: isTeamA ? asId(raw.ownOrderSource || raw.orderSourceA) : "",
      orderSourceB: isTeamB ? asId(raw.ownOrderSource || raw.orderSourceB) : "",
      viewerTeamId: isParticipant ? viewer : "",
    },
  };
}

export function projectCaptainPortalMatchupsDreambreaker(matchups = [], viewerTeamId) {
  if (!Array.isArray(matchups)) {
    return [];
  }
  return matchups.map((matchup) =>
    projectCaptainPortalMatchupDreambreaker(matchup, viewerTeamId)
  );
}

/**
 * Prove a mapped dreambreaker object never carries opponent athlete IDs.
 */
export function listExposedDreambreakerAthleteIds(dreambreaker, viewerTeamId, matchup) {
  if (!dreambreaker || typeof dreambreaker !== "object") {
    return [];
  }
  const viewer = asId(viewerTeamId);
  const isTeamA = viewer && viewer === asId(matchup?.teamAId);
  const opponentOrder = isTeamA ? dreambreaker.teamBOrder : dreambreaker.teamAOrder;
  return uniqueStringIds(opponentOrder);
}

export function validateCaptainDreambreakerOrder({
  order = [],
  rosterIds = [],
  viewerTeamId,
  submitTeamId,
  matchup,
} = {}) {
  const viewer = asId(viewerTeamId);
  const submit = asId(submitTeamId);
  if (!viewer || !submit) {
    return { ok: false, error: "Thiếu đội xem / đội nộp." };
  }
  if (viewer !== submit) {
    return { ok: false, error: "Đội trưởng chỉ được nộp thứ tự đội mình." };
  }
  if (matchup) {
    const teamAId = asId(matchup.teamAId);
    const teamBId = asId(matchup.teamBId);
    if (submit !== teamAId && submit !== teamBId) {
      return { ok: false, error: "Đội không thuộc lượt đối đầu này." };
    }
  }

  const normalizedOrder = uniqueStringIds(order);
  if (!Array.isArray(order) || order.filter((id) => asId(id)).length !== CAPTAIN_DREAMBREAKER_ORDER_SIZE) {
    return { ok: false, error: "Dreambreaker cần đúng 4 VĐV theo thứ tự 1→4." };
  }
  if (normalizedOrder.length !== CAPTAIN_DREAMBREAKER_ORDER_SIZE) {
    return { ok: false, error: "Thứ tự Dreambreaker không được trùng VĐV." };
  }

  const roster = new Set(uniqueStringIds(rosterIds));
  const invalid = normalizedOrder.filter((playerId) => !roster.has(playerId));
  if (invalid.length > 0) {
    return { ok: false, error: "Tất cả VĐV phải thuộc đội." };
  }

  return { ok: true, order: normalizedOrder };
}

function createDreambreakerOrderIdempotencyKey(matchupId, teamId) {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `db-order:${asId(matchupId)}:${asId(teamId)}:${suffix}`;
}

/**
 * Build submit payload. Ignores tournament.version / matchup.version even if passed.
 */
export function buildCaptainDreambreakerSubmitCommand({
  matchup,
  teamId,
  order = [],
  rosterIds = [],
  viewerTeamId,
  tournamentVersion,
  matchupVersion,
  idempotencyKey,
} = {}) {
  void tournamentVersion;
  void matchupVersion;

  const validation = validateCaptainDreambreakerOrder({
    order,
    rosterIds,
    viewerTeamId: viewerTeamId || teamId,
    submitTeamId: teamId,
    matchup,
  });
  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    payload: {
      matchupId: asId(matchup?.id),
      teamId: asId(teamId),
      order: validation.order,
      expectedVersion: resolveDreambreakerExpectedVersion(matchup),
      idempotencyKey:
        asId(idempotencyKey) || createDreambreakerOrderIdempotencyKey(matchup?.id, teamId),
    },
  };
}
