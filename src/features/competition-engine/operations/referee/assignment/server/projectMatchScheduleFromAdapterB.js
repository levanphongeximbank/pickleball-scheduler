/**
 * Project CORE-13 match schedule rows from Adapter B getMatchContext.
 * Uses authoritative scheduled start and duration-derived end when present.
 * Never invents timestamps.
 */

import { createMatchScheduleRow } from "../../../../../competition-core/referee-assignment/index.js";
import {
  createEmptySnapshotResult,
  createPopulatedSnapshotResult,
} from "../../../../../competition-core/referee-assignment/ports/portResult.js";
import { resolvePhysicalCourtId, trimId } from "./loadCanonicalCompetitionModeState.js";

function readInstant(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function readDurationMs(match = {}, context = {}) {
  const minutes =
    Number(match.durationMinutes) ||
    Number(match.matchDurationMinutes) ||
    Number(match.durationMin) ||
    Number(context.durationMinutes) ||
    0;
  if (Number.isFinite(minutes) && minutes > 0) {
    return minutes * 60 * 1000;
  }
  const ms = Number(match.durationMs) || Number(match.durationMillis) || 0;
  if (Number.isFinite(ms) && ms > 0) return ms;
  return null;
}

/**
 * @param {{
 *   matchContext?: object|null,
 *   modeMatch?: object|null,
 *   matchId: string,
 * }} input
 */
export function projectMatchScheduleFromAdapterB(input = {}) {
  const matchId = String(input.matchId || "").trim();
  const context = input.matchContext && typeof input.matchContext === "object"
    ? input.matchContext
    : {};
  const modeMatch =
    input.modeMatch && typeof input.modeMatch === "object" ? input.modeMatch : {};

  const startAt =
    readInstant(modeMatch.startAt) ||
    readInstant(modeMatch.scheduledStart) ||
    readInstant(modeMatch.scheduledAt) ||
    readInstant(context.scheduledAt) ||
    readInstant(context.startAt);

  const explicitEnd =
    readInstant(modeMatch.endAt) ||
    readInstant(modeMatch.scheduledEnd) ||
    readInstant(context.endAt) ||
    readInstant(context.scheduledEnd);

  const durationMs = readDurationMs(modeMatch, context);
  const endAt =
    explicitEnd ||
    (startAt && durationMs
      ? new Date(Date.parse(startAt) + durationMs).toISOString()
      : null);

  const courtId =
    resolvePhysicalCourtId(modeMatch) ||
    resolvePhysicalCourtId(context) ||
    null;

  const scheduled = Boolean(startAt && endAt);
  const row = createMatchScheduleRow({
    matchId,
    startAt,
    endAt,
    courtId,
  });

  return Object.freeze({
    scheduleSnapshot: createPopulatedSnapshotResult([row]),
    startAt,
    endAt,
    courtId,
    scheduled,
    assignmentBeforeSchedule: !scheduled,
    source: "ADAPTER_B_GET_MATCH_CONTEXT",
  });
}

export function createUnscheduledMatchSnapshot(matchId) {
  const id = trimId(matchId) || "unknown-match";
  const row = createMatchScheduleRow({
    matchId: id,
    startAt: null,
    endAt: null,
    courtId: null,
  });
  return Object.freeze({
    scheduleSnapshot: createPopulatedSnapshotResult([row]),
    startAt: null,
    endAt: null,
    courtId: null,
    scheduled: false,
    assignmentBeforeSchedule: true,
    source: "UNSCHEDULED_HONEST",
  });
}

export function emptyScheduleSnapshot(message) {
  return Object.freeze({
    scheduleSnapshot: createEmptySnapshotResult(message),
    startAt: null,
    endAt: null,
    courtId: null,
    scheduled: false,
    assignmentBeforeSchedule: true,
    source: "EMPTY",
  });
}
