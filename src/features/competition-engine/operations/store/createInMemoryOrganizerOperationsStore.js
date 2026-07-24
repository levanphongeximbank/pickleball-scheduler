/**
 * In-memory Organizer operations store (capability-local, no Supabase).
 * Holds operational orchestration state only — not CM/Core engine SoT.
 */

import {
  CHECKIN_STATE,
  MATCH_OPS_STATE,
  ORGANIZER_LIFECYCLE_STATE,
  PARTICIPANT_FIELD_STATE,
  PUBLICATION_OPS_STATE,
} from "../constants.js";
import { clonePlain, deepFreeze, isNonEmptyString } from "../fingerprint.js";

/**
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function organizerScopeKey(tenantId, competitionId) {
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
    templateId: null,
    templateVersion: null,
    formatVersion: null,
    lifecycleState: ORGANIZER_LIFECYCLE_STATE.UNINITIALIZED,
    participantFieldState: PARTICIPANT_FIELD_STATE.OPEN,
    entries: [],
    poolCompositionFingerprint: null,
    poolMatchPlanFingerprint: null,
    poolCompositionSummary: null,
    scheduleCertified: false,
    scheduleFingerprint: null,
    scheduleSummary: null,
    courtAssignmentConfirmed: false,
    courtAssignmentFingerprint: null,
    courtAssignmentSummary: null,
    refereeReadiness: null,
    checkInState: CHECKIN_STATE.NOT_OPENED,
    checkInRequired: true,
    checkedInParticipantIds: [],
    matchOpsState: MATCH_OPS_STATE.CLOSED,
    matches: [],
    standingsReady: false,
    qualificationReady: false,
    unresolvedTie: false,
    knockoutActive: false,
    knockoutFingerprint: null,
    knockoutSummary: null,
    publicationState: PUBLICATION_OPS_STATE.NONE,
    operationalPlanPublication: null,
    finalResultPublication: null,
    completionConfirmed: false,
    archiveReadiness: null,
    deterministicSeed: null,
    lastCommandFingerprint: null,
    revision: 0,
  };
}

/**
 * @param {{ clockIso?: string }} [options]
 */
export function createInMemoryOrganizerOperationsStore(options = {}) {
  /** @type {Map<string, object>} */
  const records = new Map();
  const fixedClock = isNonEmptyString(options.clockIso)
    ? String(options.clockIso).trim()
    : "2026-07-24T00:00:00.000Z";

  /**
   * @param {string} tenantId
   * @param {string} competitionId
   * @returns {object|null}
   */
  function getRaw(tenantId, competitionId) {
    const key = organizerScopeKey(tenantId, competitionId);
    const record = records.get(key);
    return record ? clonePlain(record) : null;
  }

  /**
   * @param {string} tenantId
   * @param {string} competitionId
   * @returns {Readonly<object>}
   */
  function getOrCreate(tenantId, competitionId) {
    const key = organizerScopeKey(tenantId, competitionId);
    if (!records.has(key)) {
      const fresh = createEmptyRecord();
      fresh.tenantId = String(tenantId).trim();
      fresh.competitionId = String(competitionId).trim();
      records.set(key, fresh);
    }
    return deepFreeze(clonePlain(records.get(key)));
  }

  /**
   * @param {string} tenantId
   * @param {string} competitionId
   * @param {(draft: object) => void} mutator
   * @returns {Readonly<object>}
   */
  function update(tenantId, competitionId, mutator) {
    const key = organizerScopeKey(tenantId, competitionId);
    const current = records.get(key) || createEmptyRecord();
    current.tenantId = String(tenantId).trim();
    current.competitionId = String(competitionId).trim();
    const draft = clonePlain(current);
    mutator(draft);
    draft.revision = Number(draft.revision || 0) + 1;
    draft.updatedAt = fixedClock;
    records.set(key, draft);
    return deepFreeze(clonePlain(draft));
  }

  return Object.freeze({
    kind: "in-memory-organizer-operations-store",
    clockIso: fixedClock,
    get: getOrCreate,
    getRaw,
    update,
    /**
     * @returns {string[]}
     */
    listKeys() {
      return [...records.keys()].sort();
    },
    clear() {
      records.clear();
    },
  });
}
