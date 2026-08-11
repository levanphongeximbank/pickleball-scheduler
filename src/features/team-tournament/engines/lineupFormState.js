/**
 * Captain portal lineup form dirty/pristine rehydration decisions.
 * Unsaved local Select values must survive poll/realtime/dataVersion bumps.
 */

import { LINEUP_STATUS } from "../constants.js";

function normalizeId(value) {
  return String(value || "").trim();
}

function stableSelectionsFingerprint(selections = {}) {
  const entries = Object.entries(selections || {})
    .map(([disciplineId, playerIds]) => {
      const ids = (Array.isArray(playerIds) ? playerIds : [])
        .map((id) => normalizeId(id))
        .filter(Boolean);
      return [normalizeId(disciplineId), ids];
    })
    .filter(([disciplineId]) => Boolean(disciplineId))
    .sort((a, b) => a[0].localeCompare(b[0]));

  return JSON.stringify(entries);
}

/**
 * Canonical server lineup fingerprint for rehydrate comparison.
 * @param {object|null|undefined} lineup
 * @param {string} matchupId
 * @param {string} teamId
 * @returns {string}
 */
export function buildServerLineupFingerprint(lineup, matchupId, teamId) {
  const status = normalizeId(lineup?.status) || LINEUP_STATUS.NOT_SUBMITTED;
  const version =
    lineup?.version != null
      ? String(lineup.version)
      : lineup?.lineupVersion != null
        ? String(lineup.lineupVersion)
        : "";
  const lockedAt = normalizeId(lineup?.lockedAt || lineup?.locked_at);
  const submittedAt = normalizeId(lineup?.submittedAt || lineup?.submitted_at);
  const selectionsFp = stableSelectionsFingerprint(lineup?.selections || {});
  return [
    normalizeId(matchupId),
    normalizeId(teamId),
    status,
    version,
    lockedAt,
    submittedAt,
    selectionsFp,
  ].join("::");
}

/**
 * @param {{
 *   dirty: boolean,
 *   prevFingerprint: string|null,
 *   nextFingerprint: string,
 *   force?: boolean,
 *   afterSuccessfulMutation?: boolean,
 * }} input
 * @returns {{ rehydrate: boolean, reason: string, conflict: boolean }}
 */
export function decideLineupFormRehydration({
  dirty = false,
  prevFingerprint = null,
  nextFingerprint = "",
  force = false,
  afterSuccessfulMutation = false,
} = {}) {
  if (force || afterSuccessfulMutation) {
    return {
      rehydrate: true,
      reason: afterSuccessfulMutation ? "post_mutation_readback" : "force",
      conflict: false,
    };
  }

  if (!nextFingerprint) {
    return { rehydrate: false, reason: "missing_fingerprint", conflict: false };
  }

  if (prevFingerprint == null) {
    return { rehydrate: true, reason: "initial_hydrate", conflict: false };
  }

  if (prevFingerprint === nextFingerprint) {
    return { rehydrate: false, reason: "server_unchanged", conflict: false };
  }

  if (dirty) {
    return {
      rehydrate: false,
      reason: "dirty_retain_local_server_changed",
      conflict: true,
    };
  }

  return {
    rehydrate: true,
    reason: "server_lineup_changed",
    conflict: false,
  };
}

export function buildInitialLineupSelections(teamData, matchupId, teamId, getLineupFn) {
  const lineup = typeof getLineupFn === "function" ? getLineupFn(teamData, matchupId, teamId) : null;
  const selections = {};
  for (const discipline of teamData?.disciplines || []) {
    if (!discipline?.id) continue;
    selections[discipline.id] = [...(lineup?.selections?.[discipline.id] || [])];
  }
  return selections;
}
