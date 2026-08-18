/**
 * CORE-13 disposable fixture writer inventory.
 * Documents existing canonical authorities. Does not invent writers.
 * Test/acceptance tooling only.
 *
 * TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY
 * DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY=DENY
 * DIRECT_MATCH_LIVE_STATE_DML=DENY
 * DIRECT_INITIALIZER_RPC_FROM_FIXTURE_TOOL=DENY
 *
 * HISTORICAL_BLOCKER=CLOSED_BY_PR448
 * Previous INTERNAL_MATCH_LIVE_SHELL gap is historical only and must not
 * drive current readiness gates.
 */

import {
  REFEREE_V5_ACTIONS,
  refereeV5EdgeApplyCommand,
  refereeV5EdgeGetState,
  refereeV5EdgeInitializeExecution,
} from "../../src/features/referee-v5/services/refereeV5EdgeClient.js";
import { MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";

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

/** Historical only — CLOSED_BY_PR448. Must not drive current gates. */
export const HISTORICAL_INTERNAL_MATCH_LIVE_SHELL_GAP = "INTERNAL_MATCH_LIVE_SHELL";
export const HISTORICAL_BLOCKER_CLOSED_BY = "CLOSED_BY_PR448";

export const INITIALIZER_PORT_NAME = "initializeMatchExecution";
export const INITIALIZER_AUTHORITY =
  "src/features/referee-v5/services/refereeV5EdgeClient.js#refereeV5EdgeInitializeExecution";
export const INITIALIZER_IDEMPOTENCY_PURPOSE = "INITIALIZE_MATCH_EXECUTION_STATE";
export const CORE13_FIXTURE_IDEMPOTENCY_NAMESPACE = "CORE13_STAGING_ACCEPTANCE";

export const FORBIDDEN_INTERNAL_MATCH_AUTHORITIES = Object.freeze([
  "team_tournament_provision_referee_match",
  "provisionRefereeMatch",
  "team-tournament",
  "teamTournament",
]);

export const FORBIDDEN_DAILY_INTERNAL_AUTHORITIES = Object.freeze([
  "dailyPlayCanonicalService#createMatches",
  "createDailyPlayMatches",
  "daily-play/canonical",
]);

export const FORBIDDEN_CALLER_AUTHORITY_FIELDS = Object.freeze([
  "actor",
  "actorRole",
  "tenantId",
  "initialState",
  "adapter",
  "serviceRoleKey",
]);

export const FORBIDDEN_DIRECT_INITIALIZER_RPC = "referee_v5_initialize_match_execution_state";

export const LIVE_BACKED_LIFECYCLES = Object.freeze([
  "IN_PROGRESS",
  "SCORING_ACTIVE",
  "LOCKED",
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
    requiredState: "Daily Play match shells (mode-specific; not INTERNAL shared execution initializer)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/daily-play/canonical/dailyPlayCanonicalService.js#createMatches",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: true,
    forbiddenAsInternalInitializer: true,
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
    requiredState: "INTERNAL match identity in tournament payload (PRE_MATCH until live row exists)",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: "src/features/tournament/services/tournamentCommands.js#applyEngineV4StateCommand",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
    notes: "Creates canonical match identity only. Does not initialize match execution.",
  },
  initializeMatchExecution: {
    object: "MATCH_EXECUTION_INITIALIZATION",
    requiredState: "canonical not_started match execution row before lifecycle commands",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority: INITIALIZER_AUTHORITY,
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: true,
    notes:
      "Trusted Edge product path: authenticated organizer JWT → refereeV5EdgeInitializeExecution → referee-v5-match initialize-execution.",
  },
  teamTournamentProvisionRefereeMatch: {
    object: "MATCH_EXECUTION_INITIALIZATION",
    requiredState: "Team-only live shell — FORBIDDEN as INTERNAL shared authority",
    classification: WRITER_CLASS.MODE_SPECIFIC_NOT_ALLOWED,
    authority: "team_tournament_provision_referee_match / provisionRefereeMatch",
    nodeBinding: NODE_BINDING.MODE_SPECIFIC_NOT_ALLOWED,
    required: false,
    forbiddenForInternal: true,
  },
  startMatchLive: {
    object: "LIFECYCLE",
    requiredState: "IN_PROGRESS after initialize-execution + START_MATCH",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority:
      "src/features/referee-v5/services/refereeV5EdgeClient.js#refereeV5EdgeApplyCommand START_MATCH",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: true,
    dependsOn: INITIALIZER_PORT_NAME,
  },
  recordScoreEvent: {
    object: "LIFECYCLE",
    requiredState: "SCORING_ACTIVE after initialize-execution + START_MATCH + score event",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority:
      "src/features/referee-v5/services/refereeV5EdgeClient.js#refereeV5EdgeApplyCommand TEAM_A_WON_RALLY",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: true,
    dependsOn: INITIALIZER_PORT_NAME,
  },
  pauseMatchLive: {
    object: "LIFECYCLE",
    requiredState: "LOCKED via Referee V5 PAUSE_MATCH after initialize-execution + START_MATCH",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority:
      "src/features/referee-v5/services/refereeV5EdgeClient.js#refereeV5EdgeApplyCommand PAUSE_MATCH",
    nodeBinding: NODE_BINDING.REQUIRES_AUTHENTICATED_USER_CLIENT,
    required: true,
    dependsOn: INITIALIZER_PORT_NAME,
  },
  completeIsolatedTournament: {
    object: "LIFECYCLE",
    requiredState: "COMPLETED on dedicated completedLifecycle tournament only",
    classification: WRITER_CLASS.CANONICAL_PRODUCT_COMMAND,
    authority:
      "src/features/tournament/services/tournamentCommands.js#setTournamentStatusCommand|updateTournamentCommand completed",
    nodeBinding: NODE_BINDING.NODE_SAFE_BINDABLE,
    required: true,
    notes: "Must never complete the shared primary tournament. Match-level finalize remains a separate gap.",
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
    requiredState: "canonical delete if supported AND no live-backed execution dependency; else retain",
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

export function evaluateDailyWriterDeniedForInternal(authority = "") {
  const blob = String(authority || "");
  const hit = FORBIDDEN_DAILY_INTERNAL_AUTHORITIES.find((token) => blob.includes(token));
  if (hit) {
    return Object.freeze({
      ok: false,
      detail: `DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY=DENY token=${hit}`,
      DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    });
  }
  return Object.freeze({
    ok: true,
    detail: "daily-writer-denied-check",
    DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
  });
}

export function evaluateForbiddenCallerAuthority(input = {}) {
  const hits = FORBIDDEN_CALLER_AUTHORITY_FIELDS.filter((key) =>
    Object.prototype.hasOwnProperty.call(input || {}, key)
  );
  if (hits.length) {
    return Object.freeze({
      ok: false,
      detail: `caller authority denied: ${hits.join(",")}`,
    });
  }
  return Object.freeze({ ok: true, detail: "caller-authority-denied-check" });
}

export function evaluateInternalMatchWriterArchitecture() {
  const catalog = CANONICAL_WRITER_CATALOG.initializeMatchExecution;
  return Object.freeze({
    ok: true,
    verdict: "SHARED_REFEREE_MATCH_EXECUTION_INITIALIZER_AVAILABLE",
    TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    SHARED_REFEREE_MATCH_EXECUTION_INITIALIZER: "AVAILABLE",
    CANONICAL_AUTHORITY: "refereeV5EdgeInitializeExecution",
    INITIALIZER_PORT_NAME,
    INTERNAL_MATCH_CANONICAL_WRITER: INITIALIZER_PORT_NAME,
    INTERNAL_MATCH_WRITER_CLASSIFICATION: catalog.classification,
    INTERNAL_MATCH_WRITER_GAP: null,
    HISTORICAL_BLOCKER: HISTORICAL_BLOCKER_CLOSED_BY,
    HISTORICAL_INTERNAL_MATCH_LIVE_SHELL_GAP,
    PRE_MATCH_PAYLOAD_WRITER: CANONICAL_WRITER_CATALOG.createInternalMatch.authority,
    AVAILABLE_WRITERS: catalog.authority,
    MISSING_CAPABILITY: null,
    REFEREE_V5_INITIALIZE_ACTION: REFEREE_V5_ACTIONS.INITIALIZE_EXECUTION,
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
      missing: ["TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY"],
      gaps: [
        {
          OBJECT: "MATCH_EXECUTION_INITIALIZATION",
          REQUIRED_STATE: "shared INTERNAL match execution initializer",
          EXPECTED_AUTHORITY: INITIALIZER_AUTHORITY,
          AVAILABLE_WRITERS: "Team provisionRefereeMatch (DENIED)",
          MISSING_CAPABILITY: "TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY",
        },
      ],
      architecture,
    });
  }
  if (writers.__allowDailyAsInternal === true) {
    return Object.freeze({
      ok: false,
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      missing: ["DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY"],
      gaps: [
        {
          OBJECT: "MATCH_EXECUTION_INITIALIZATION",
          REQUIRED_STATE: "shared INTERNAL match execution initializer",
          EXPECTED_AUTHORITY: INITIALIZER_AUTHORITY,
          AVAILABLE_WRITERS: "Daily Play createMatches (DENIED)",
          MISSING_CAPABILITY: "DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY",
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
      missing,
      gaps: missing.map((name) => gap(name)),
      architecture,
    });
  }
  return Object.freeze({
    ok: true,
    verdict: "WRITER_COVERAGE_READY",
    missing: [],
    gaps: [],
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
      forbiddenAsInternalInitializer: row.forbiddenAsInternalInitializer === true,
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

export function buildInitializeExecutionIdempotencyKey({
  runId,
  tournamentId,
  matchId,
} = {}) {
  return [
    CORE13_FIXTURE_IDEMPOTENCY_NAMESPACE,
    String(runId || "").trim(),
    String(tournamentId || "").trim(),
    String(matchId || "").trim(),
    INITIALIZER_IDEMPOTENCY_PURPOSE,
  ].join(":");
}

export function buildInitializeMatchExecutionRequest({
  tournamentId,
  matchId,
  competitionMode = "INTERNAL",
  runId,
  accessToken,
  edgeBaseUrl,
} = {}) {
  const request = {
    tournamentId: String(tournamentId || "").trim(),
    matchId: String(matchId || "").trim(),
    competitionMode: String(competitionMode || "INTERNAL").trim() || "INTERNAL",
    idempotencyKey: buildInitializeExecutionIdempotencyKey({ runId, tournamentId, matchId }),
  };
  if (accessToken) request.accessToken = accessToken;
  if (edgeBaseUrl) request.edgeBaseUrl = edgeBaseUrl;
  return Object.freeze(request);
}

export function evaluateInitializerClientFields(input = {}) {
  const allowed = new Set([
    "tournamentId",
    "matchId",
    "competitionMode",
    "idempotencyKey",
    "accessToken",
    "edgeBaseUrl",
  ]);
  const extras = Object.keys(input || {}).filter((key) => !allowed.has(key));
  if (extras.length) {
    return Object.freeze({
      ok: false,
      detail: `initializer extra fields denied: ${extras.join(",")}`,
    });
  }
  const caller = evaluateForbiddenCallerAuthority(input);
  if (!caller.ok) return caller;
  if (!input.tournamentId || !input.matchId || !input.competitionMode || !input.idempotencyKey) {
    return Object.freeze({ ok: false, detail: "initializer canonical client fields required" });
  }
  return Object.freeze({ ok: true, detail: "initializer-client-fields" });
}

/**
 * Fetch-based trusted Edge product path. Does not call the initializer RPC
 * and does not accept actor/tenant/initialState as caller authority.
 */
export function createInitializeMatchExecutionWriter({
  accessToken,
  edgeBaseUrl,
  initializeExecution = refereeV5EdgeInitializeExecution,
  getState = refereeV5EdgeGetState,
} = {}) {
  return async function initializeMatchExecution(input = {}) {
    const caller = evaluateForbiddenCallerAuthority(input);
    if (!caller.ok) return caller;
    if (!accessToken) {
      return Object.freeze({
        ok: false,
        detail: "authenticated organizer token required",
      });
    }
    if (!edgeBaseUrl) {
      return Object.freeze({ ok: false, detail: "Staging Edge base URL required" });
    }
    const request = buildInitializeMatchExecutionRequest({
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      competitionMode: input.competitionMode || "INTERNAL",
      runId: input.runId,
      accessToken,
      edgeBaseUrl,
    });
    const fields = evaluateInitializerClientFields(request);
    if (!fields.ok) return fields;

    if (typeof getState === "function") {
      const existing = await getState({
        accessToken,
        tournamentId: request.tournamentId,
        matchId: request.matchId,
        edgeBaseUrl,
      });
      const status = String(existing?.state?.status || existing?.status || "").toLowerCase();
      if (existing?.ok === true && status) {
        if (["not_started", "in_progress", "paused", "locked"].includes(status)) {
          return Object.freeze({
            ok: true,
            alreadyInitialized: true,
            skippedReset: true,
            status,
          });
        }
        if (["completed", "cancelled", "disputed"].includes(status)) {
          return Object.freeze({
            ok: false,
            detail: "remote execution state conflicts with receipt initializer",
            status,
          });
        }
      }
    }

    return initializeExecution({
      accessToken: request.accessToken,
      tournamentId: request.tournamentId,
      matchId: request.matchId,
      competitionMode: request.competitionMode,
      idempotencyKey: request.idempotencyKey,
      edgeBaseUrl: request.edgeBaseUrl,
    });
  };
}

export function createRefereeV5LifecycleWriters({
  accessToken,
  edgeBaseUrl,
  applyCommand = refereeV5EdgeApplyCommand,
} = {}) {
  const apply = (commandType) => async (input = {}) => {
    const caller = evaluateForbiddenCallerAuthority(input);
    if (!caller.ok) return caller;
    if (!accessToken) {
      return Object.freeze({ ok: false, detail: "authenticated organizer token required" });
    }
    return applyCommand({
      accessToken,
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      commandType,
      payload: {},
      idempotencyKey: [
        CORE13_FIXTURE_IDEMPOTENCY_NAMESPACE,
        String(input.runId || ""),
        String(input.matchId || ""),
        commandType,
      ].join(":"),
      edgeBaseUrl,
    });
  };
  return Object.freeze({
    startMatchLive: apply(MATCH_EVENT_TYPE.START_MATCH),
    recordScoreEvent: apply(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY),
    pauseMatchLive: apply(MATCH_EVENT_TYPE.PAUSE_MATCH),
  });
}

export function bindSharedRefereeExecutionWriters(options = {}) {
  return Object.freeze({
    initializeMatchExecution: createInitializeMatchExecutionWriter(options),
    ...createRefereeV5LifecycleWriters(options),
  });
}

export function evaluateExecutableRemoteBinding(writers = {}) {
  const coverage = evaluateWriterCoverage(writers);
  return Object.freeze({
    ok: coverage.ok,
    missing: coverage.missing || [],
    initializerBound: typeof writers.initializeMatchExecution === "function",
    REMOTE_FIXTURE_PROVISION_READY: coverage.ok === true,
    INITIALIZER_AUTHORITY,
    INITIALIZER_PORT_NAME,
  });
}

export { REFEREE_V5_ACTIONS, MATCH_EVENT_TYPE };
