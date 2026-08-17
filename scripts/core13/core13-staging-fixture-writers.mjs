/**
 * CORE-13 disposable fixture writer inventory.
 * Documents existing canonical authorities. Does not invent writers.
 * Test/acceptance tooling only.
 *
 * TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY
 * INTERNAL match live shell (`match_live_states`) has no shared canonical writer.
 */

export const WRITER_CLASS = Object.freeze({
  CANONICAL_PRODUCT_COMMAND: "CANONICAL_PRODUCT_COMMAND",
  CANONICAL_ADMIN_TEST_COMMAND: "CANONICAL_ADMIN_TEST_COMMAND",
  AUTHORIZED_IDENTITY_ADMIN_API: "AUTHORIZED_IDENTITY_ADMIN_API",
  TEST_DOUBLE_ONLY: "TEST_DOUBLE_ONLY",
  DIRECT_TABLE_DML: "DIRECT_TABLE_DML",
  LEGACY: "LEGACY",
  MODE_SPECIFIC_NOT_ALLOWED: "MODE_SPECIFIC_NOT_ALLOWED",
  NOT_AVAILABLE: "NOT_AVAILABLE",
});

export const NODE_BINDING = Object.freeze({
  NODE_SAFE_BINDABLE: "NODE_SAFE_BINDABLE",
  BROWSER_SINGLETON_DEPENDENT: "BROWSER_SINGLETON_DEPENDENT",
  REQUIRES_AUTHENTICATED_USER_CLIENT: "REQUIRES_AUTHENTICATED_USER_CLIENT",
  REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT: "REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT",
  MODE_SPECIFIC_NOT_ALLOWED: "MODE_SPECIFIC_NOT_ALLOWED",
  MISSING_CANONICAL_CAPABILITY: "MISSING_CANONICAL_CAPABILITY",
});

export const APPROVED_PROVISION_CLASSES = Object.freeze([
  WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
  WRITER_CLASS.CANONICAL_ADMIN_TEST_COMMAND,
  WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
]);

export const INTERNAL_MATCH_LIVE_SHELL_GAP = "INTERNAL_MATCH_LIVE_SHELL";

export const FORBIDDEN_INTERNAL_MATCH_AUTHORITIES = Object.freeze([
  "team_tournament_provision_referee_match",
  "provisionRefereeMatch",
  "team-tournament",
  "teamTournament",
]);

export const CANONICAL_WRITER_CATALOG = Object.freeze({
  createTenant: {
    object: "TENANT",
    requiredState: "disposable Tenant A and Tenant B",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tenant/services/tenantService.js#createTenantDurable",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
  },
  createAuthUser: {
    object: "AUTH_USER",
    requiredState: "disposable Staging auth users",
    classification: WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
    authority: "src/features/identity/services/identityAdminCreateService.js#adminCreateManagedUser",
    nodeBinding: NODE_BINDING.REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT,
    required: true,
    testOnlyIdentityAdmin: true,
  },
  updateIdentitySubject: {
    object: "IDENTITY_SUBJECT",
    requiredState: "role/status evidence for referee / inactive / non-canonical subjects",
    classification: WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
    authority: "src/features/identity/services/userManagementService.js#updateManagedUser",
    nodeBinding: NODE_BINDING.REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT,
    required: true,
    testOnlyIdentityAdmin: true,
  },
  createCanonicalTournament: {
    object: "TOURNAMENT",
    requiredState: "canonical INTERNAL tournament + cross-tournament + completedLifecycle tournament",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#createTournamentCommand",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
  },
  createDailyPlayTournament: {
    object: "DAILY_PLAY",
    requiredState: "DAILY_PLAY enabled and disabled tournaments",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#createTournamentCommand(DAILY_PLAY)",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
  },
  createDailyPlayMatches: {
    object: "MATCH",
    requiredState: "Daily Play match shells (mode-specific; not INTERNAL shared)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/daily-play/canonical/dailyPlayCanonicalService.js#createMatches",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: true,
  },
  setCourtSchedule: {
    object: "SCHEDULE",
    requiredState: "canonical court/schedule context via Adapter B",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#setTournamentCourtScheduleCommand",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
  },
  createInternalMatch: {
    object: "MATCH",
    requiredState: "INTERNAL match identity in tournament payload (PRE_MATCH = missing live row)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#applyEngineV4StateCommand",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
    notes: "Creates payload match IDs only. Does not create match_live_states.",
  },
  provisionInternalMatchLiveShell: {
    object: "MATCH_LIVE_SHELL",
    requiredState: "match_live_states for IN_PROGRESS / SCORING_ACTIVE / LOCKED INTERNAL fixtures",
    classification: WRITER_CLASS.NOT_AVAILABLE,
    authority: "NONE — no shared INTERNAL/mode-neutral match live-shell writer",
    nodeBinding: NODE_BINDING.MISSING_CANONICAL_CAPABILITY,
    required: false,
    gap: INTERNAL_MATCH_LIVE_SHELL_GAP,
  },
  teamTournamentProvisionRefereeMatch: {
    object: "MATCH_LIVE_SHELL",
    requiredState: "Team-only live shell — FORBIDDEN as INTERNAL shared authority",
    classification: WRITER_CLASS.MODE_SPECIFIC_NOT_ALLOWED,
    authority: "team_tournament_provision_referee_match / provisionRefereeMatch",
    nodeBinding: NODE_BINDING.MODE_SPECIFIC_NOT_ALLOWED,
    required: false,
    forbiddenForInternal: true,
  },
  startMatchLive: {
    object: "LIFECYCLE",
    requiredState: "IN_PROGRESS (requires existing live shell)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/referee-v5/server/edgeHttpHandler.js#handleRefereeV5MatchAction start",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: false,
    dependsOn: "provisionInternalMatchLiveShell",
  },
  recordScoreEvent: {
    object: "LIFECYCLE",
    requiredState: "SCORING_ACTIVE derived (requires existing live shell)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/referee-v5/server/edgeHttpHandler.js#handleRefereeV5MatchAction score",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: false,
    dependsOn: "provisionInternalMatchLiveShell",
  },
  pauseMatchLive: {
    object: "LIFECYCLE",
    requiredState: "LOCKED via PAUSED alias (requires existing live shell)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/referee-v5/server/edgeHttpHandler.js#handleRefereeV5MatchAction pause",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: false,
    dependsOn: "provisionInternalMatchLiveShell",
  },
  completeIsolatedTournament: {
    object: "LIFECYCLE",
    requiredState: "COMPLETED on dedicated completedLifecycle tournament only",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority:
      "src/features/tournament/services/tournamentCommands.js#setTournamentStatusCommand|updateTournamentCommand completed",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
    notes: "Must never complete the shared primary tournament.",
  },
  unassignViaTrustedServer: {
    object: "ASSIGNMENT_TEARDOWN",
    requiredState: "inverse CORE-13 unassign for receipt-owned active assignments only",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "Edge competition-referee-assignment unassignReferee",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: true,
  },
  deleteAuthUser: {
    object: "AUTH_USER_TEARDOWN",
    requiredState: "delete provisioner-created disposable auth users",
    classification: WRITER_CLASS.AUTHORIZED_IDENTITY_ADMIN_API,
    authority: "Supabase Auth Admin deleteUser (test-only wrap)",
    nodeBinding: NODE_BINDING.REQUIRES_IDENTITY_ADMIN_SERVER_CLIENT,
    required: true,
    testOnlyIdentityAdmin: true,
  },
  deleteTournament: {
    object: "TOURNAMENT_TEARDOWN",
    requiredState: "canonical delete if supported; else retain disposable artifact",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#deleteTournamentCommand",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: false,
  },
});

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

export function evaluateTeamWriterDeniedForInternal(authority = "") {
  const blob = String(authority || "");
  const hit = FORBIDDEN_INTERNAL_MATCH_AUTHORITIES.find((token) => blob.includes(token));
  if (hit) {
    return Object.freeze({
      ok: false,
      detail: `TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY token=${hit}`,
      TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    });
  }
  return Object.freeze({
    ok: true,
    detail: "team-writer-denied-check",
    TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
  });
}

export function evaluateInternalMatchWriterArchitecture() {
  return Object.freeze({
    ok: false,
    verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    INTERNAL_MATCH_CANONICAL_WRITER: "NOT_AVAILABLE",
    INTERNAL_MATCH_WRITER_CLASSIFICATION: WRITER_CLASS.NOT_AVAILABLE,
    INTERNAL_MATCH_WRITER_GAP: INTERNAL_MATCH_LIVE_SHELL_GAP,
    PRE_MATCH_PAYLOAD_WRITER: CANONICAL_WRITER_CATALOG.createInternalMatch.authority,
    AVAILABLE_WRITERS:
      "createInternalMatch (payload PRE_MATCH only); Team provisionRefereeMatch DENIED for INTERNAL",
    MISSING_CAPABILITY: INTERNAL_MATCH_LIVE_SHELL_GAP,
  });
}

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
  const architecture = evaluateInternalMatchWriterArchitecture();
  if (writers.__allowTeamAsInternal === true) {
    return Object.freeze({
      ok: false,
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      missing: [INTERNAL_MATCH_LIVE_SHELL_GAP],
      gaps: [
        {
          OBJECT: "MATCH_LIVE_SHELL",
          REQUIRED_STATE: "INTERNAL shared live shell",
          EXPECTED_AUTHORITY: "shared INTERNAL match live-shell writer",
          AVAILABLE_WRITERS: "Team provisionRefereeMatch (DENIED)",
          MISSING_CAPABILITY: INTERNAL_MATCH_LIVE_SHELL_GAP,
        },
      ],
      architecture,
    });
  }
  const missing = REQUIRED_WRITER_PORTS.filter((name) => typeof writers[name] !== "function");
  if (missing.length) {
    return Object.freeze({
      ok: false,
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      missing: [...missing, INTERNAL_MATCH_LIVE_SHELL_GAP],
      gaps: [...missing.map((name) => gap(name)), architecture],
      architecture,
    });
  }
  return Object.freeze({
    ok: false,
    verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    missing: [INTERNAL_MATCH_LIVE_SHELL_GAP],
    gaps: [
      {
        OBJECT: "MATCH_LIVE_SHELL",
        REQUIRED_STATE: "IN_PROGRESS / SCORING_ACTIVE / LOCKED INTERNAL fixtures",
        EXPECTED_AUTHORITY: "shared INTERNAL / mode-neutral match live-shell writer",
        AVAILABLE_WRITERS: "none (Team RPC DENIED; Daily Play mode-specific; DML forbidden)",
        MISSING_CAPABILITY: INTERNAL_MATCH_LIVE_SHELL_GAP,
      },
    ],
    architecture,
    portsPresent: true,
  });
}

export function evaluatePortPresence(writers = {}) {
  const missing = REQUIRED_WRITER_PORTS.filter((name) => typeof writers[name] !== "function");
  if (missing.length) {
    return Object.freeze({
      ok: false,
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      missing,
      gaps: missing.map((name) => gap(name)),
    });
  }
  return Object.freeze({ ok: true, verdict: "PORTS_PRESENT", missing: [], gaps: [] });
}

export function buildNodeSafeWriterAudit() {
  const out = {};
  for (const [name, row] of Object.entries(CANONICAL_WRITER_CATALOG)) {
    out[name] = {
      classification: row.classification,
      nodeBinding: row.nodeBinding,
      authority: row.authority,
      required: row.required === true,
      gap: row.gap || null,
      forbiddenForInternal: row.forbiddenForInternal === true,
    };
  }
  return Object.freeze(out);
}

export function listForbiddenWriterClasses() {
  return Object.freeze([
    WRITER_CLASS.DIRECT_TABLE_DML,
    WRITER_CLASS.LEGACY,
    WRITER_CLASS.TEST_DOUBLE_ONLY,
    WRITER_CLASS.MODE_SPECIFIC_NOT_ALLOWED,
  ]);
}
