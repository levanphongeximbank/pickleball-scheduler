/**
 * @typedef {Object} NormalizedCourtAllocation
 * @property {string|null} courtId
 * @property {string|null} label
 * @property {number|null} index
 * @property {string[]} playerIds
 * @property {string[]} pairKeys
 */

/**
 * @typedef {Object} FormationCourtParityResult
 * @property {boolean} ok
 * @property {NormalizedCourtAllocation[]} legacyCourts
 * @property {NormalizedCourtAllocation[]} adapterCourts
 * @property {string[]} warnings
 */

function pairKey(playerIds = []) {
  return [...playerIds].map(String).sort().join("|");
}

/**
 * Extract court allocation from legacy result metadata.
 *
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} result
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} [payload]
 */
export function extractLegacyCourtAllocation(result = {}, payload = {}) {
  const courts = payload.courts || payload.options?.courts || result.courts || [];
  if (courts.length) {
    return courts.map((court, index) => ({
      courtId: court.id != null ? String(court.id) : null,
      label: court.label ?? court.name ?? null,
      index: Number.isFinite(Number(court.index)) ? Number(court.index) : index,
      playerIds: [...(court.playerIds || [])].map(String).sort(),
      pairKeys: [],
    }));
  }

  return (result.teams || []).map((team, index) => ({
    courtId: team.courtId != null ? String(team.courtId) : null,
    label: team.name ?? null,
    index,
    playerIds: [...(team.playerIds || [])].map(String).sort(),
    pairKeys: [pairKey(team.playerIds || [])],
  }));
}

/**
 * Compare court allocation between direct legacy and adapter paths.
 *
 * @param {Object} input
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.directLegacy
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.adapterLegacy
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} [input.legacyPayload]
 */
export function compareFormationCourtParity(input = {}) {
  const legacyCourts = extractLegacyCourtAllocation(input.directLegacy, input.legacyPayload);
  const adapterCourts = extractLegacyCourtAllocation(input.adapterLegacy, input.legacyPayload);

  const legacyKey = JSON.stringify(
    legacyCourts.map((c) => ({
      courtId: c.courtId,
      playerIds: c.playerIds,
    }))
  );
  const adapterKey = JSON.stringify(
    adapterCourts.map((c) => ({
      courtId: c.courtId,
      playerIds: c.playerIds,
    }))
  );

  const warnings = [];
  if (legacyKey !== adapterKey) {
    warnings.push("COURT_ALLOCATION_MISMATCH");
  }

  const legacyPayload = input.legacyPayload || {};
  for (const metaKey of ["venueId", "sessionId", "queuePosition", "courtStatus"]) {
    if (legacyPayload[metaKey] != null || legacyPayload.options?.[metaKey] != null) {
      warnings.push(`metadata_preserved:${metaKey}`);
    }
  }

  return {
    ok: legacyKey === adapterKey,
    legacyCourts,
    adapterCourts,
    warnings,
  };
}
