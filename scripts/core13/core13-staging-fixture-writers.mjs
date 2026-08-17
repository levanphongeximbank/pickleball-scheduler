/**
 * CORE-13 disposable fixture writer inventory.
 * Documents existing canonical authorities. Does not invent writers.
 * Test/acceptance tooling only.
 */

export const WRITER_CLASS = Object.freeze({
  CANONICAL_PRODUCT_COMMAND: "CANONICAL_PRODUCT_COMMAND",
  CANONICAL_ADMIN_TEST_COMMAND: "CANONICAL_ADMIN_TEST_COMMAND",
  AUTHORIZED_IDENTITY_ADMIN_API: "AUTHORIZED_IDENTITY_ADMIN_API",
  TEST_DOUBLE_ONLY: "TEST_DOUBLE_ONLY",
  DIRECT_TABLE_DML: "DIRECT_TABLE_DML",
  LEGACY: "LEGACY",
  NOT_AVAILABLE: "NOT_AVAILABLE",
});

export const APPROVED_PROVISION_CLASSES = Object.freeze([
  WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
  WRITER_CLASS.CANONICAL_ADMIN_TEST_COMMAND,
  WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
]);

export const CANONICAL_WRITER_CATALOG = Object.freeze({
  createTenant: {
    object: "TENANT",
    requiredState: "disposable Tenant A and Tenant B",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tenant/services/tenantService.js#createTenantDurable",
    required: true,
  },
  createAuthUser: {
    object: "AUTH_USER",
    requiredState: "disposable Staging auth users",
    classification: WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
    authority: "src/features/identity/services/identityAdminCreateService.js#adminCreateManagedUser",
    required: true,
    testOnlyIdentityAdmin: true,
  },
  updateIdentitySubject: {
    object: "IDENTITY_SUBJECT",
    requiredState: "role/status evidence for referee / inactive / non-canonical subjects",
    classification: WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
    authority: "src/features/identity/services/userManagementService.js#updateManagedUser",
    required: true,
    testOnlyIdentityAdmin: true,
  },
  createCanonicalTournament: {
    object: "TOURNAMENT",
    requiredState: "canonical INTERNAL tournament + distinct cross-tournament",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#createTournamentCommand",
    required: true,
  },
  createDailyPlayTournament: {
    object: "DAILY_PLAY",
    requiredState: "DAILY_PLAY enabled and disabled tournaments",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#createTournamentCommand(DAILY_PLAY)",
    required: true,
  },
  createDailyPlayMatches: {
    object: "MATCH",
    requiredState: "Daily Play match shells",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/daily-play/canonical/dailyPlayCanonicalService.js#createMatches",
    required: true,
  },
  setCourtSchedule: {
    object: "SCHEDULE",
    requiredState: "canonical court/schedule context via Adapter B",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#setTournamentCourtScheduleCommand",
    required: true,
  },
  provisionLiveMatchShell: {
    object: "MATCH",
    requiredState: "live match row for lifecycle fixtures (PRE_MATCH missing-row is also canonical)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "team_tournament_provision_referee_match via team tournament repository provisionRefereeMatch",
    required: true,
  },
  startMatchLive: {
    object: "LIFECYCLE",
    requiredState: "IN_PROGRESS",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/referee-v5/server/edgeHttpHandler.js#handleRefereeV5MatchAction start",
    required: true,
  },
  recordScoreEvent: {
    object: "LIFECYCLE",
    requiredState: "SCORING_ACTIVE (derived from score/event sequence, not a writable enum)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/referee-v5/server/edgeHttpHandler.js#handleRefereeV5MatchAction score",
    required: true,
  },
  pauseMatchLive: {
    object: "LIFECYCLE",
    requiredState: "LOCKED (PAUSED aliases to CORE-13 LOCKED)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/referee-v5/server/edgeHttpHandler.js#handleRefereeV5MatchAction pause",
    required: true,
  },
  completeTournament: {
    object: "LIFECYCLE",
    requiredState: "COMPLETED",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#updateTournamentCommand status completed",
    required: true,
  },
  unassignViaTrustedServer: {
    object: "ASSIGNMENT_TEARDOWN",
    requiredState: "inverse CORE-13 unassign for receipt-owned active assignments",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "Edge competition-referee-assignment unassignReferee",
    required: true,
  },
  deleteAuthUser: {
    object: "AUTH_USER_TEARDOWN",
    requiredState: "delete provisioner-created disposable auth users",
    classification: WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
    authority: "Supabase Auth Admin deleteUser (test-only wrap)",
    required: true,
    testOnlyIdentityAdmin: true,
  },
});

export const OPTIONAL_WRITER_PORTS = Object.freeze(["archiveTournament", "deleteTournament"]);

export const REQUIRED_WRITER_PORTS = Object.freeze(
  Object.entries(CANONICAL_WRITER_CATALOG)
    .filter(([, row]) => row.required)
    .map(([name]) => name)
);

export const HONEST_NOT_CONFIGURED = Object.freeze({
  qualificationRuntime: "NOT_CONFIGURED",
  availabilityRuntime: "NOT_CONFIGURED",
  fakeEvidenceCreated: false,
});

function gap(portName) {
  const row = CANONICAL_WRITER_CATALOG[portName] || { object: portName };
  return {
    OBJECT: row.object,
    REQUIRED_STATE: row.requiredState || "",
    EXPECTED_AUTHORITY: row.authority || "",
    AVAILABLE_WRITERS: "missing injected canonical writer port",
    MISSING_CAPABILITY: portName,
  };
}

export function evaluateWriterCoverage(writers = {}) {
  const missing = REQUIRED_WRITER_PORTS.filter((name) => typeof writers[name] !== "function");
  if (missing.length) {
    return Object.freeze({
      ok: false,
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      missing,
      gaps: missing.map((name) => gap(name)),
    });
  }
  return Object.freeze({
    ok: true,
    verdict: "WRITERS_PRESENT",
    missing: [],
    gaps: [],
  });
}

export function listForbiddenWriterClasses() {
  return Object.freeze([
    WRITER_CLASS.DIRECT_TABLE_DML,
    WRITER_CLASS.LEGACY,
    WRITER_CLASS.TEST_DOUBLE_ONLY,
  ]);
}
