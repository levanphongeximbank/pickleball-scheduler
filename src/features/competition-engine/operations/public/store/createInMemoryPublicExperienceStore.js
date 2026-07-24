/**
 * In-memory published public experience store (capability-local, no Supabase).
 * Holds published snapshots only — not Organizer mutation SoT.
 */

import { PUBLICATION_OPS_STATE } from "../../constants.js";
import { clonePlain, deepFreeze, isNonEmptyString } from "../fingerprint.js";
import { PUBLICATION_VISIBILITY_DEFAULTS } from "../constants.js";
import { resolvePublicVisibility } from "../gates/publicationPrivacyGates.js";

/**
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function publicScopeKey(tenantId, competitionId) {
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
    venueName: null,
    publicTitle: null,
    branding: null,
    dates: null,
    timezone: null,
    divisions: [],
    templateId: null,
    formatLabel: "INDIVIDUAL_POOL_KNOCKOUT",
    publicationState: PUBLICATION_OPS_STATE.NONE,
    visibility: { ...PUBLICATION_VISIBILITY_DEFAULTS.NONE },
    entries: [],
    schedule: null,
    scheduleFingerprint: null,
    courts: [],
    pools: null,
    poolCompositionFingerprint: null,
    standings: null,
    unresolvedTie: false,
    qualification: null,
    bracket: null,
    knockoutFingerprint: null,
    matches: [],
    matchCenter: null,
    finalResults: null,
    archive: null,
    revision: 0,
  };
}

/**
 * @param {{ clockIso?: string }} [options]
 */
export function createInMemoryPublicExperienceStore(options = {}) {
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
    const key = publicScopeKey(tenantId, competitionId);
    const record = records.get(key);
    return record ? clonePlain(record) : null;
  }

  /**
   * @param {string} tenantId
   * @param {string} competitionId
   * @returns {Readonly<object>|null}
   */
  function get(tenantId, competitionId) {
    const raw = getRaw(tenantId, competitionId);
    return raw ? deepFreeze(raw) : null;
  }

  /**
   * Replace published snapshot (integrator / test seeding).
   * @param {string} tenantId
   * @param {string} competitionId
   * @param {object} snapshot
   * @returns {Readonly<object>}
   */
  function put(tenantId, competitionId, snapshot) {
    const key = publicScopeKey(tenantId, competitionId);
    const base = createEmptyRecord();
    const incoming =
      snapshot && typeof snapshot === "object" ? clonePlain(snapshot) : {};
    const publicationState =
      incoming.publicationState ||
      base.publicationState ||
      PUBLICATION_OPS_STATE.NONE;
    // Only honor explicit visibility overlays; otherwise derive from publication state.
    const visibility = resolvePublicVisibility(
      Object.prototype.hasOwnProperty.call(incoming, "visibility")
        ? incoming.visibility
        : null,
      publicationState
    );
    const next = {
      ...base,
      ...incoming,
      tenantId: String(tenantId).trim(),
      competitionId: String(competitionId).trim(),
      publicationState,
      visibility,
      revision: Number(snapshot?.revision || 0) + 1,
      updatedAt: fixedClock,
    };
    records.set(key, next);
    return deepFreeze(clonePlain(next));
  }

  return Object.freeze({
    kind: "in-memory-public-experience-store",
    clockIso: fixedClock,
    get,
    getRaw,
    put,
    listKeys() {
      return [...records.keys()].sort();
    },
    clear() {
      records.clear();
    },
  });
}
