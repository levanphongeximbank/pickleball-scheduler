import {
  buildCanonicalSetupSnapshot,
  hashCanonicalSetupSnapshot,
  serializeCanonicalSetupSnapshot,
} from "../canonical/teamTournamentCanonical.js";

/**
 * Build the client-side canonical snapshot required by P1.3 setup RPCs.
 * The server independently hashes its normalized database read model.
 */
export function buildSetupMutationSnapshotPackage({
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
  const snapshotJson = buildCanonicalSetupSnapshot({
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
  const snapshotCanonicalText = serializeCanonicalSetupSnapshot(snapshotJson);
  const snapshotHash = hashCanonicalSetupSnapshot(snapshotJson);

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
