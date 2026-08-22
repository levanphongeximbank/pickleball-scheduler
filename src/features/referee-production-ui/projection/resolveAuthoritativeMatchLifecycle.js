/**
 * Resolve CORE-15 match lifecycle for RefereeMatchView.
 * Adapter/modeState status is never allowed to regress an in-progress match to READY.
 */

import { MATCH_STATUS } from "../../competition-core/matches/index.js";

function normalizeCoreStatus(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/-/g, "_");
  if (!raw) return null;
  if (raw === "IN_PROGRESS" || raw === "INPROGRESS") return MATCH_STATUS.IN_PROGRESS;
  if (raw === "READY_TO_START") return MATCH_STATUS.READY_TO_START;
  if (raw === "READY") return MATCH_STATUS.READY;
  if (raw === "SCHEDULED") return MATCH_STATUS.SCHEDULED;
  if (raw === "PAUSED") return MATCH_STATUS.PAUSED;
  if (raw === "SUSPENDED") return MATCH_STATUS.SUSPENDED;
  if (raw === "COMPLETED") return MATCH_STATUS.COMPLETED;
  if (raw === "CANCELLED") return MATCH_STATUS.CANCELLED;
  if (raw === "POSTPONED") return MATCH_STATUS.POSTPONED;
  if (raw === "DRAFT") return MATCH_STATUS.DRAFT;
  return raw;
}

/** Live row status → CORE-15 (translator only). */
export function mapLiveStatusToCore15(liveStatus) {
  const s = String(liveStatus || "").trim().toLowerCase();
  if (s === "in_progress") return MATCH_STATUS.IN_PROGRESS;
  if (s === "paused") return MATCH_STATUS.PAUSED;
  if (s === "completed") return MATCH_STATUS.COMPLETED;
  if (s === "cancelled") return MATCH_STATUS.CANCELLED;
  if (s === "not_started") return null;
  return normalizeCoreStatus(liveStatus);
}

/**
 * @param {{
 *   live?: object|null,
 *   assignedMatch?: object|null,
 *   matchContext?: object|null,
 *   scoreProjection?: object|null,
 *   preferInProgressAfterScore?: boolean,
 * }} input
 */
export function resolveAuthoritativeMatchLifecycle(input = {}) {
  const live = input.live || null;
  const assigned = input.assignedMatch || {};
  const matchContext = input.matchContext || {};
  const scoreProjection = input.scoreProjection || assigned.scoreProjection || null;

  const fromCanonical = normalizeCoreStatus(live?.statePayload?.canonical?.match?.status);
  const fromAssigned = normalizeCoreStatus(assigned.lifecycleState || assigned.match?.status);
  const fromLiveRow = mapLiveStatusToCore15(live?.status);
  const fromAdapter = normalizeCoreStatus(matchContext.status);

  const authoritative = fromCanonical || fromAssigned || fromLiveRow;

  if (authoritative === MATCH_STATUS.IN_PROGRESS) return MATCH_STATUS.IN_PROGRESS;
  if (authoritative === MATCH_STATUS.PAUSED || authoritative === MATCH_STATUS.SUSPENDED) {
    return authoritative;
  }
  if (authoritative === MATCH_STATUS.COMPLETED || authoritative === MATCH_STATUS.CANCELLED) {
    return authoritative;
  }

  const hasScoreSession = Boolean(live?.statePayload?.canonical?.scoreSession);
  const points = scoreProjection?.points || null;
  const hasPoints =
    points &&
    (Number(points.SIDE_A || 0) > 0 ||
      Number(points.SIDE_B || 0) > 0 ||
      Boolean(scoreProjection?.serve));

  // Scoring path / active score session must never surface as READY.
  if (
    input.preferInProgressAfterScore === true ||
    hasScoreSession ||
    hasPoints
  ) {
    return MATCH_STATUS.IN_PROGRESS;
  }

  if (authoritative) return authoritative;
  return fromAdapter;
}
