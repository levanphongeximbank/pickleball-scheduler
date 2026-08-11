/**
 * Canonical lineup revision CAS contract for captain save/submit.
 *
 * p_expected_version refers ONLY to team_tournament_lineups.version —
 * never tournament.version.
 *
 * First create (no lineup row): expectedVersion = 0.
 * After insert, server returns lineup.version = 1.
 */

export const FIRST_CREATE_LINEUP_EXPECTED_VERSION = 0;

export const LINEUP_REVISION_ENTITY = "team_tournament_lineups";

/**
 * @param {object|null|undefined} lineup
 * @returns {number}
 */
export function resolveLineupExpectedVersion(lineup) {
  if (lineup?.version != null && Number.isFinite(Number(lineup.version))) {
    return Number(lineup.version);
  }
  if (
    lineup?.lineupVersion != null &&
    Number.isFinite(Number(lineup.lineupVersion))
  ) {
    return Number(lineup.lineupVersion);
  }
  return FIRST_CREATE_LINEUP_EXPECTED_VERSION;
}

/**
 * Pure CAS decision used by tests + docs. Mirrors SQL package semantics.
 *
 * @param {{
 *   existingVersion: number|null|undefined,
 *   expectedVersion: number|null|undefined,
 * }} args
 * @returns {{
 *   ok: boolean,
 *   code?: string,
 *   write: boolean,
 *   action?: 'insert'|'update',
 *   nextVersion?: number,
 *   expectedVersion?: number|null,
 *   actualVersion?: number|null,
 * }}
 */
export function evaluateLineupRevisionCas({
  existingVersion = null,
  expectedVersion = null,
} = {}) {
  const expected =
    expectedVersion == null || expectedVersion === ""
      ? null
      : Number(expectedVersion);

  if (existingVersion == null || existingVersion === "") {
    if (expected != null && expected !== FIRST_CREATE_LINEUP_EXPECTED_VERSION) {
      return {
        ok: false,
        code: "version_conflict",
        write: false,
        expectedVersion: expected,
        actualVersion: FIRST_CREATE_LINEUP_EXPECTED_VERSION,
      };
    }
    return {
      ok: true,
      write: true,
      action: "insert",
      nextVersion: 1,
      expectedVersion: expected ?? FIRST_CREATE_LINEUP_EXPECTED_VERSION,
      actualVersion: FIRST_CREATE_LINEUP_EXPECTED_VERSION,
    };
  }

  const current = Number(existingVersion);
  if (expected != null && current !== expected) {
    return {
      ok: false,
      code: "version_conflict",
      write: false,
      expectedVersion: expected,
      actualVersion: current,
    };
  }

  return {
    ok: true,
    write: true,
    action: "update",
    nextVersion: current + 1,
    expectedVersion: expected ?? current,
    actualVersion: current,
  };
}
