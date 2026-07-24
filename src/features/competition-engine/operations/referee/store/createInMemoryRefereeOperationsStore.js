/**
 * In-memory Referee operations store (capability-local, no Supabase).
 * Holds assignment queue, match lifecycle snapshots, scoring sessions, validation.
 */

import {
  REFEREE_ASSIGNMENT_OPS_STATUS,
  REFEREE_VALIDATION_OPS_STATUS,
} from "../constants.js";
import { clonePlain, deepFreeze, isNonEmptyString } from "../../fingerprint.js";

/**
 * @param {string} tenantId
 * @param {string} competitionId
 */
export function refereeScopeKey(tenantId, competitionId) {
  return `${String(tenantId).trim()}::${String(competitionId).trim()}`;
}

/**
 * @returns {object}
 */
function createEmptyRecord() {
  return {
    tenantId: null,
    competitionId: null,
    venueId: null,
    assignments: [],
    matches: {},
    scoreSessions: {},
    validationByMatch: {},
    revision: 0,
  };
}

/**
 * @param {{ clockIso?: string }} [options]
 */
export function createInMemoryRefereeOperationsStore(options = {}) {
  /** @type {Map<string, object>} */
  const records = new Map();
  let seq = 0;
  const fixedClock = isNonEmptyString(options.clockIso)
    ? String(options.clockIso).trim()
    : "2026-07-24T00:00:00.000Z";

  function nextId(prefix) {
    seq += 1;
    return `${prefix}-${seq}`;
  }

  function getRaw(tenantId, competitionId) {
    const key = refereeScopeKey(tenantId, competitionId);
    const record = records.get(key);
    return record ? clonePlain(record) : null;
  }

  function getOrCreate(tenantId, competitionId) {
    const key = refereeScopeKey(tenantId, competitionId);
    if (!records.has(key)) {
      const fresh = createEmptyRecord();
      fresh.tenantId = String(tenantId).trim();
      fresh.competitionId = String(competitionId).trim();
      records.set(key, fresh);
    }
    return deepFreeze(clonePlain(records.get(key)));
  }

  function update(tenantId, competitionId, mutator) {
    const key = refereeScopeKey(tenantId, competitionId);
    const current = records.get(key) || createEmptyRecord();
    current.tenantId = String(tenantId).trim();
    current.competitionId = String(competitionId).trim();
    const draft = clonePlain(current);
    mutator(draft, { nextId, clockIso: fixedClock });
    draft.revision = Number(draft.revision || 0) + 1;
    draft.updatedAt = fixedClock;
    records.set(key, draft);
    return deepFreeze(clonePlain(draft));
  }

  /**
   * Seed/replace assignment list from CORE-13 plan projection (ops handoff).
   * Does not run CORE-13 planner itself.
   */
  function upsertAssignments(tenantId, competitionId, assignments, meta = {}) {
    return update(tenantId, competitionId, (draft) => {
      if (isNonEmptyString(meta.venueId)) {
        draft.venueId = String(meta.venueId).trim();
      }
      const next = [];
      for (const raw of assignments || []) {
        if (!raw || typeof raw !== "object") continue;
        const matchId = String(raw.matchId || "").trim();
        const refereeId = String(raw.refereeId || raw.assigneeId || "").trim();
        if (!matchId || !refereeId) continue;
        next.push(
          Object.freeze({
            assignmentId:
              String(raw.assignmentId || "").trim() ||
              `${matchId}::${refereeId}`,
            matchId,
            refereeId,
            tenantId: String(tenantId).trim(),
            competitionId: String(competitionId).trim(),
            venueId: String(raw.venueId || meta.venueId || draft.venueId || "").trim() || null,
            courtId: raw.courtId || raw.courtAssignmentRef || null,
            scheduledAt: raw.scheduledAt || null,
            status:
              String(raw.status || REFEREE_ASSIGNMENT_OPS_STATUS.ASSIGNED)
                .trim()
                .toUpperCase() || REFEREE_ASSIGNMENT_OPS_STATUS.ASSIGNED,
            participants: Array.isArray(raw.participants)
              ? raw.participants
              : [],
            entries: Array.isArray(raw.entries) ? raw.entries : [],
            checkInReady: raw.checkInReady === true,
            source: raw.source || "core13-handoff",
          })
        );
      }
      next.sort((a, b) =>
        String(a.assignmentId).localeCompare(String(b.assignmentId))
      );
      draft.assignments = next;
    });
  }

  function putMatch(tenantId, competitionId, match) {
    return update(tenantId, competitionId, (draft) => {
      const matchId = String(match?.id || match?.matchId || "").trim();
      if (!matchId) return;
      draft.matches[matchId] = clonePlain(match);
    });
  }

  return Object.freeze({
    kind: "in-memory-referee-operations-store",
    clockIso: fixedClock,
    get: getOrCreate,
    getRaw,
    update,
    upsertAssignments,
    putMatch,
    nextId: (prefix = "ref-ops") => nextId(prefix),
    listKeys() {
      return [...records.keys()].sort();
    },
    clear() {
      records.clear();
      seq = 0;
    },
    REFEREE_ASSIGNMENT_OPS_STATUS,
    REFEREE_VALIDATION_OPS_STATUS,
  });
}
