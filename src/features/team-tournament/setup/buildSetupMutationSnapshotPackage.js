import {
  buildCanonicalSetupSnapshot,
  hashCanonicalSetupSnapshot,
  hashCanonicalSetupSnapshotAsync,
  serializeCanonicalSetupSnapshot,
} from "../canonical/teamTournamentCanonical.js";

/**
 * @param {object} params
 * @returns {object}
 */
function buildCanonicalSnapshotJson({
  tournament = {},
  teams = [],
  disciplines = [],
  groups = [],
  matchups = [],
  subMatches = [],
  schedule = [],
  schedulePublish = {},
  settings = {},
  formatPreset,
  rosterRules,
  engine = {},
  rules = {},
  actor = {},
  expectedTournamentVersion,
  engineInput,
  engineOutput,
  generatedAt,
} = {}) {
  return buildCanonicalSetupSnapshot({
    tournament: {
      ...tournament,
      version: Number(expectedTournamentVersion) + 1,
    },
    teams,
    disciplines,
    groups,
    matchups,
    subMatches,
    schedule,
    schedulePublish,
    settings,
    formatPreset,
    rosterRules,
    engine: { ...engine, input: engineInput, output: engineOutput },
    rules,
    actor,
    generatedAt,
  });
}

/**
 * Build the client-side canonical snapshot required by P1.3 setup RPCs.
 * Node/tests/scripts only — browser UI must use buildSetupMutationSnapshotPackageAsync.
 * The server independently hashes its normalized database read model.
 */
export function buildSetupMutationSnapshotPackage(params = {}) {
  const snapshotJson = buildCanonicalSnapshotJson(params);
  const snapshotCanonicalText = serializeCanonicalSetupSnapshot(snapshotJson);
  const snapshotHash = hashCanonicalSetupSnapshot(snapshotJson);

  return {
    snapshotJson,
    snapshotCanonicalText,
    snapshotHash,
    normalizedReadHash: snapshotHash,
  };
}

/**
 * Browser-safe snapshot package (SubtleCrypto SHA-256).
 * @param {object} params
 * @returns {Promise<{
 *   snapshotJson: object,
 *   snapshotCanonicalText: string,
 *   snapshotHash: string,
 *   normalizedReadHash: string,
 * }>}
 */
export async function buildSetupMutationSnapshotPackageAsync(params = {}) {
  const snapshotJson = buildCanonicalSnapshotJson(params);
  const snapshotCanonicalText = serializeCanonicalSetupSnapshot(snapshotJson);
  const snapshotHash = await hashCanonicalSetupSnapshotAsync(snapshotJson);

  return {
    snapshotJson,
    snapshotCanonicalText,
    snapshotHash,
    normalizedReadHash: snapshotHash,
  };
}

export function attachSnapshotPackageToPayload(payload = {}, snapshotPackage = {}) {
  return {
    ...payload,
    snapshot: {
      ...(payload.snapshot || {}),
      ...snapshotPackage,
    },
  };
}
