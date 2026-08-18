#!/usr/bin/env node
/**
 * CORE-13 disposable Staging fixture provisioner — test/acceptance orchestrator.
 *
 * Not product runtime. Not browser. Not domain authority.
 * TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY
 * DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY=DENY
 * DIRECT_INITIALIZER_RPC_FROM_FIXTURE_TOOL=DENY
 *
 * HISTORICAL_BLOCKER=CLOSED_BY_PR448 (INTERNAL_MATCH_LIVE_SHELL).
 * Current initializer authority: refereeV5EdgeInitializeExecution.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CORE13_FIXTURE_NAMESPACE } from "./core13-staging-acceptance-proofs.mjs";
import {
  evaluateExistingQaIdentitySet,
  evaluateOrganizerAuthContext,
  evaluateRefereeAuthContext,
  evaluateVenueAsTenantFallbackDenied,
  FIXTURE_BINDING_MODE,
  sanitizeAuthContext,
} from "./core13-staging-qa-auth.mjs";
import {
  BOOTSTRAP_ASSIGNMENT_PURPOSE,
  CANONICAL_WRITER_CATALOG,
  evaluateDailyWriterDeniedForInternal,
  evaluateExecutableRemoteBinding,
  evaluateExistingQaMutationPortsAbsentFromSetup,
  evaluateForbiddenCallerAuthority,
  evaluateInternalMatchWriterArchitecture,
  evaluateTeamWriterDeniedForInternal,
  evaluateWriterCoverage,
  EXISTING_QA_MUTATION_PORTS_DENIED,
  FIXTURE_LIFECYCLE_WRITER_COMMAND_TYPES,
  HONEST_NOT_CONFIGURED,
  INITIALIZER_AUTHORITY,
  INITIALIZER_PORT_NAME,
  NON_CANONICAL_ABSENT_UUID,
  NON_CANONICAL_EXPECTED_ABSENT,
  REQUIRED_WRITER_PORTS,
} from "./core13-staging-fixture-writers.mjs";
import {
  buildFixtureAbortReason,
  buildTypedCleanupPlan,
  createPartialFixtureReceipt,
  createValidFixtureReceipt,
  evaluateFixtureReceipt,
  evaluatePartialFixtureReceipt,
  evaluatePhysicalEnvironment,
  evaluateTeardownScope,
  evaluateTypedTeardownTargets,
  FIXTURE_ERROR_STAGE,
  FIXTURE_PROVISIONER_ID,
  hydrateHarnessFixtures,
  listReceiptOwnedIds,
  loadFixtureReceiptFromPath,
  normalizeFixtureLifecycleError,
  receiptHasLiveBackedFixtures,
  STAGING_PROJECT_REF,
  stripReceiptSecrets,
} from "./core13-staging-fixture-receipt.mjs";

export const RUNTIME_ARTIFACT_DIR = "artifacts/core13-staging-acceptance/runtime";

function proof(ok, detail, extra = {}) {
  return Object.freeze({ ok: ok === true, detail: String(detail || ""), ...extra });
}

export function readOrganizerAccessToken(envMap = {}) {
  return String(
    envMap.STAGING_ORGANIZER_ACCESS_TOKEN || envMap.STAGING_USER_A_ACCESS_TOKEN || ""
  ).trim();
}

export function readRefereeAccessToken(envMap = {}) {
  return String(envMap.STAGING_REFEREE_ACCESS_TOKEN || "").trim();
}

export function readStagingEdgeBaseUrl(envMap = {}) {
  return String(envMap.STAGING_EDGE_BASE_URL || envMap.STAGING_SUPABASE_URL || "").trim();
}

export function resolveProvisionAuthContexts(envMap = {}, options = {}) {
  if (options.organizerContext && options.refereeContext) {
    const organizer = evaluateOrganizerAuthContext(options.organizerContext);
    if (!organizer.ok) return organizer;
    const referee = evaluateRefereeAuthContext(options.refereeContext, options.organizerContext);
    if (!referee.ok) return referee;
    return proof(true, "auth-contexts", {
      organizerContext: options.organizerContext,
      refereeContext: options.refereeContext,
    });
  }
  const organizerToken = readOrganizerAccessToken(envMap);
  const refereeToken = readRefereeAccessToken(envMap);
  if (!organizerToken) {
    return proof(false, "missing organizer context");
  }
  if (!refereeToken) {
    return proof(false, "MISSING_EXISTING_QA_REFEREE_CREDENTIAL");
  }
  return proof(false, "missing organizer context", {
    detail:
      "env tokens are not sufficient without resolved organizerContext and refereeContext user/tenant/role",
  });
}

export function evaluateRemoteProvisionGate(envMap = {}, options = {}) {
  if (String(envMap.CORE13_FIXTURE_PROVISION_GO || "").trim() !== "YES") {
    return proof(false, "CORE13_FIXTURE_PROVISION_GO required");
  }
  if (String(envMap.STAGING_MUTATION_GO || "").trim() !== "YES") {
    return proof(false, "STAGING_MUTATION_GO required");
  }
  if (String(envMap.PICK_VN_ENV || "").trim().toLowerCase() !== "staging") {
    return proof(false, "PICK_VN_ENV must be staging");
  }
  const target = String(envMap.TARGET_PROJECT_REF || "").trim();
  if (target !== STAGING_PROJECT_REF) {
    return proof(false, "TARGET_PROJECT_REF must be Staging qyewbxjsiiyufanzcjcq");
  }
  const url = String(envMap.STAGING_SUPABASE_URL || envMap.SUPABASE_URL || "");
  if (/expuvcohlcjzvrrauvud/i.test(url)) {
    return proof(false, "Production project denied");
  }
  const edgeBaseUrl = readStagingEdgeBaseUrl(envMap);
  if (!edgeBaseUrl) {
    return proof(false, "Staging Edge base URL required", {
      REMOTE_FIXTURE_PROVISION_READY: false,
    });
  }
  const auth = resolveProvisionAuthContexts(envMap, options);
  if (!auth.ok) {
    return proof(false, auth.detail, {
      REMOTE_FIXTURE_PROVISION_READY: false,
    });
  }
  const writers = options.writers || {};
  const binding = evaluateExecutableRemoteBinding(writers, {
    bindingMode: FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY,
  });
  if (!binding.ok) {
    return proof(false, `missing canonical writer ports: ${(binding.missing || []).join(",")}`, {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      missing: binding.missing,
      REMOTE_FIXTURE_PROVISION_READY: false,
      REMOTE_FIXTURE_PROVISION_EXECUTABLE_BINDING: binding.initializerBound === true,
      architecture: evaluateInternalMatchWriterArchitecture(),
    });
  }
  return proof(true, "remote provision gate open", {
    verdict: "REMOTE_FIXTURE_PROVISION_READY",
    REMOTE_FIXTURE_PROVISION_READY: true,
    REMOTE_FIXTURE_PROVISION_EXECUTABLE_BINDING: true,
    architecture: evaluateInternalMatchWriterArchitecture(),
    identityMode: FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY,
    organizerContext: sanitizeAuthContext(auth.organizerContext),
    refereeContext: sanitizeAuthContext(auth.refereeContext),
  });
}

export function parseProvisionerMode(argv = []) {
  if (argv.includes("--teardown")) return "teardown";
  if (argv.includes("--provision")) return "provision";
  if (argv.includes("--verify")) return "verify";
  return "plan";
}

export function planFixtureProvision(options = {}) {
  const coverage = evaluateWriterCoverage(options.writers || {});
  const teamCheck = evaluateTeamWriterDeniedForInternal(
    CANONICAL_WRITER_CATALOG.teamTournamentProvisionRefereeMatch.authority
  );
  const dailyCheck = evaluateDailyWriterDeniedForInternal(
    CANONICAL_WRITER_CATALOG.createDailyPlayMatches.authority
  );
  const architecture = coverage.architecture || evaluateInternalMatchWriterArchitecture();
  return Object.freeze({
    ok: coverage.ok === true,
    verdict: coverage.ok ? "WRITER_COVERAGE_READY" : coverage.verdict,
    provisioner: FIXTURE_PROVISIONER_ID,
    namespace: CORE13_FIXTURE_NAMESPACE,
    TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    SHARED_REFEREE_MATCH_EXECUTION_INITIALIZER: architecture.SHARED_REFEREE_MATCH_EXECUTION_INITIALIZER,
    CANONICAL_AUTHORITY: architecture.CANONICAL_AUTHORITY,
    INITIALIZER_PORT_NAME,
    INITIALIZER_AUTHORITY,
    INTERNAL_MATCH_WRITER_GAP: coverage.ok ? null : coverage.missing,
    HISTORICAL_BLOCKER: architecture.HISTORICAL_BLOCKER,
    remoteMarkerPolicy:
      "secondary name/description metadata only where canonical fields already allow it; receipt is SSOT",
    unknownBaselineAutoClean: false,
    sqlExecution: false,
    edgeRedeploy: false,
    directServiceRoleBusinessDml: false,
    primaryTournamentRemainsNonTerminal: true,
    completedFixtureIsolated: true,
    ...HONEST_NOT_CONFIGURED,
    steps: coverage.ok
      ? [
          "resolveExistingTenantFixture",
          "resolveQaIdentitySet",
          "createCanonicalMatchIdentity",
          "initializeMatchExecution",
          "bootstrapRefereeAssignment",
          "refereeV5LifecycleCommands",
          "finalizeMatchLive",
        ]
      : [],
    missing: coverage.missing,
    gaps: coverage.gaps,
    catalog: CANONICAL_WRITER_CATALOG,
    teamCheck,
    dailyCheck,
    architecture,
  });
}

function entity(result, fallbackId) {
  if (result == null) return { id: fallbackId };
  if (typeof result === "string") return { id: result };
  return {
    id: String(result.id || result.userId || result.tenantId || fallbackId),
    ...result,
  };
}

function recordPath(paths, key, step) {
  if (!paths[key]) paths[key] = [];
  paths[key].push(step);
}

function failWithPartial(result, runId, owned, extra = {}) {
  const writerPort = result?.writerPort || extra.writerPort;
  const commandType =
    result?.commandType ||
    extra.commandType ||
    FIXTURE_LIFECYCLE_WRITER_COMMAND_TYPES[writerPort];
  const failureEnvelope = normalizeFixtureLifecycleError(result, {
    stage: result?.stage || extra.stage || FIXTURE_ERROR_STAGE.REFEREE_V5_LIFECYCLE,
    writerPort,
    commandType,
  });
  const abortReason = buildFixtureAbortReason(
    failureEnvelope,
    result?.detail || extra.abortReason
  );
  const partialReceipt = createPartialFixtureReceipt({
    runId,
    abortReason,
    failureStage: failureEnvelope.stage,
    failureEnvelope,
    ownedIds: owned,
  });
  return proof(false, abortReason, {
    ...extra,
    status: "PARTIAL",
    validLive29CaseSsot: false,
    failureStage: failureEnvelope.stage,
    failureEnvelope,
    partialReceipt,
  });
}

function readCanonicalCas(result = {}) {
  const expectedVersion =
    result.stateVersion != null && result.stateVersion !== ""
      ? Number(result.stateVersion)
      : undefined;
  const expectedSequence =
    result.lastEventSequence != null && result.lastEventSequence !== ""
      ? Number(result.lastEventSequence)
      : undefined;
  return {
    expectedVersion: Number.isFinite(expectedVersion) ? expectedVersion : undefined,
    expectedSequence: Number.isFinite(expectedSequence) ? expectedSequence : undefined,
  };
}

async function applyLiveLifecycle({
  writers,
  tournamentId,
  matchId,
  runId,
  refereeId,
  steps,
  paths,
  key,
}) {
  const initInput = {
    tournamentId,
    matchId,
    competitionMode: "INTERNAL",
    runId,
  };
  const caller = evaluateForbiddenCallerAuthority(initInput);
  if (!caller.ok) return caller;
  const initialized = await writers.initializeMatchExecution(initInput);
  if (initialized && initialized.ok === false) {
    return {
      ...initialized,
      writerPort: "initializeMatchExecution",
      stage: FIXTURE_ERROR_STAGE.MATCH_EXECUTION_INIT,
    };
  }
  recordPath(paths, key, "initializeMatchExecution");
  let { expectedVersion, expectedSequence } = readCanonicalCas(initialized);
  const bootstrap = await writers.bootstrapRefereeAssignment({
    tournamentId,
    matchId,
    refereeId,
    runId,
    lifecycleState: "PRE_MATCH",
  });
  if (bootstrap && bootstrap.ok === false) {
    return {
      ...bootstrap,
      writerPort: "bootstrapRefereeAssignment",
      stage: FIXTURE_ERROR_STAGE.ASSIGNMENT_BOOTSTRAP,
    };
  }
  recordPath(paths, key, "bootstrapRefereeAssignment");
  const assignmentProof = {
    assignmentId: bootstrap?.assignmentId || bootstrap?.id,
    purpose: BOOTSTRAP_ASSIGNMENT_PURPOSE,
    matchId,
    active: true,
  };
  if (!assignmentProof.assignmentId) {
    return proof(false, "bootstrap assignment did not return assignmentId");
  }
  const commandInput = {
    tournamentId,
    matchId,
    runId,
    refereeId,
    bootstrapAssignmentProof: assignmentProof,
  };
  for (const step of steps) {
    const result = await writers[step]({
      ...commandInput,
      expectedVersion,
      expectedSequence,
    });
    if (result && result.ok === false) {
      return {
        ...result,
        assignmentProof,
        writerPort: step,
        stage: FIXTURE_ERROR_STAGE.REFEREE_V5_LIFECYCLE,
        commandType: result.commandType || FIXTURE_LIFECYCLE_WRITER_COMMAND_TYPES[step],
      };
    }
    recordPath(paths, key, step);
    const nextCas = readCanonicalCas(result);
    if (nextCas.expectedVersion != null) expectedVersion = nextCas.expectedVersion;
    if (nextCas.expectedSequence != null) expectedSequence = nextCas.expectedSequence;
  }
  return { ok: true, assignmentProof };
}

async function resolveExistingQaFixtures(writers, callLog) {
  for (const denied of EXISTING_QA_MUTATION_PORTS_DENIED) {
    if (typeof writers[denied] === "function" && writers.__invokeIdentityMutation === true) {
      callLog.push(denied);
    }
  }
  const mutationCheck = evaluateExistingQaMutationPortsAbsentFromSetup(callLog);
  if (!mutationCheck.ok) return mutationCheck;

  const tenantA = entity(
    await writers.resolveExistingTenantFixture({ scope: "TENANT_A", deriveTenantFromVenue: false })
  );
  callLog.push("resolveExistingTenantFixture");
  const tenantB = entity(
    await writers.resolveExistingTenantFixture({ scope: "TENANT_B", deriveTenantFromVenue: false })
  );
  callLog.push("resolveExistingTenantFixture");
  const venueCheckA = evaluateVenueAsTenantFallbackDenied(tenantA);
  const venueCheckB = evaluateVenueAsTenantFallbackDenied(tenantB);
  if (!venueCheckA.ok) return venueCheckA;
  if (!venueCheckB.ok) return venueCheckB;
  if (!tenantA.id || !tenantB.id || tenantA.id === tenantB.id) {
    return proof(false, "TENANT_A and TENANT_B must be distinct canonical tenants");
  }
  const identities = await writers.resolveQaIdentitySet({
    tenantA: tenantA.id,
    tenantB: tenantB.id,
  });
  callLog.push("resolveQaIdentitySet");
  if (identities && identities.ok === false) return identities;
  const set = evaluateExistingQaIdentitySet({
    organizerA: identities.organizerA || identities.userA,
    organizerB: identities.organizerB || identities.userB,
    refereeA: {
      ...(identities.refereeA || {}),
      credentialPresent:
        identities.refereeA?.credentialPresent !== false &&
        Boolean(identities.refereeA?.accessToken || identities.refereeA?.credentialPresent),
    },
    replacementReferee: identities.replacementReferee,
    inactiveReferee: identities.inactiveReferee,
  });
  if (!set.ok) return set;
  return proof(true, "existing-qa-resolved", { tenantA, tenantB, identities });
}

/**
 * Existing-QA materialization. Refuses Team/Daily as INTERNAL execution authority.
 * Live lifecycle: identity → initialize [ORGANIZER] → CORE-13 bootstrap [ORGANIZER]
 * → Referee V5 commands [REFEREE].
 */
export async function materializeReceiptFromWriters(options = {}) {
  if (options.allowTeamAsInternal === true || options.writers?.__allowTeamAsInternal === true) {
    return proof(false, "TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY", {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    });
  }
  if (options.allowDailyAsInternal === true || options.writers?.__allowDailyAsInternal === true) {
    return proof(false, "DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY=DENY", {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    });
  }
  if (typeof options.writers?.provisionLiveMatchShell === "function") {
    return proof(false, "TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY provisionLiveMatchShell", {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    });
  }
  if (typeof options.writers?.teamTournamentProvisionRefereeMatch === "function") {
    return proof(false, "TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY", {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    });
  }

  const identityMode = options.identityMode || FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY;
  if (identityMode !== FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY) {
    return proof(false, "DISPOSABLE_IDENTITY_PROVISION_MODE not authorized");
  }

  const identityOnly =
    options.requireLiveLifecycle === false || options.requireInternalLiveShell === false;
  const ports = evaluateWriterCoverage(options.writers || {}, { bindingMode: identityMode });
  if (!ports.ok) return ports;
  if (options.allowExecute !== true) {
    return proof(false, "materialize requires explicit allowExecute");
  }

  const writers = options.writers;
  const callLog = [];
  const wrap =
    (name, fn) =>
    async (...args) => {
      callLog.push(name);
      return fn(...args);
    };
  const tracked = {};
  for (const [name, fn] of Object.entries(writers)) {
    tracked[name] = typeof fn === "function" ? wrap(name, fn) : fn;
  }

  const resolved = await resolveExistingQaFixtures(tracked, []);
  if (!resolved.ok) return resolved;
  const { tenantA, tenantB, identities } = resolved;
  const userA = identities.organizerA || identities.userA;
  const userB = identities.organizerB || identities.userB;
  const refereeA = identities.refereeA;
  const replacementReferee = identities.replacementReferee;
  const inactiveReferee = identities.inactiveReferee;
  const nonCanonicalSubject = {
    id: identities.nonCanonicalSubject?.id || NON_CANONICAL_ABSENT_UUID,
    classification: NON_CANONICAL_EXPECTED_ABSENT,
    role: "ABSENT",
    status: "ABSENT",
  };

  const mutationHits = callLog.filter((name) => EXISTING_QA_MUTATION_PORTS_DENIED.includes(name));
  if (mutationHits.length) {
    return proof(false, `EXISTING_QA_IDENTITY_MODE mutation ports invoked: ${mutationHits.join(",")}`);
  }

  const runId = String(options.runId || `run-${Date.now()}`);
  const marker = `${CORE13_FIXTURE_NAMESPACE} ${runId}`;

  const primary = entity(
    await tracked.createCanonicalTournament({
      tenantId: tenantA.id,
      name: `${marker} primary`,
      mode: "INTERNAL",
      terminal: false,
    })
  );
  const crossTournament = entity(
    await tracked.createCanonicalTournament({
      tenantId: tenantA.id,
      name: `${marker} cross`,
      mode: "INTERNAL",
    })
  );
  const completedLifecycle = entity(
    await tracked.createCanonicalTournament({
      tenantId: tenantA.id,
      name: `${marker} completed-only`,
      mode: "INTERNAL",
      terminal: false,
    })
  );
  const dailyEnabled = entity(
    await tracked.createDailyPlayTournament({
      tenantId: tenantA.id,
      name: `${marker} daily-on`,
      refereeFeatureEnabled: true,
    })
  );
  const dailyDisabled = entity(
    await tracked.createDailyPlayTournament({
      tenantId: tenantA.id,
      name: `${marker} daily-off`,
      refereeFeatureEnabled: false,
    })
  );
  await tracked.setCourtSchedule({ tournamentId: primary.id, tenantId: tenantA.id, marker });

  const mkMatch = async (tournamentId) =>
    entity(await tracked.createInternalMatch({ tournamentId, mode: "INTERNAL" }));

  const materializationPaths = {
    preMatch: ["createInternalMatch"],
    inProgress: ["createInternalMatch"],
    scoringActive: ["createInternalMatch"],
    locked: ["createInternalMatch"],
    completed: ["createInternalMatch"],
  };

  const preMatch = await mkMatch(primary.id);
  const overlapA = await mkMatch(primary.id);
  const overlapB = await mkMatch(primary.id);
  const nonOverlap = await mkMatch(primary.id);
  const inProgress = await mkMatch(primary.id);
  const scoringActive = await mkMatch(primary.id);
  const locked = await mkMatch(primary.id);
  const completed = await mkMatch(completedLifecycle.id);

  const owned = {
    tournaments: [
      primary.id,
      crossTournament.id,
      completedLifecycle.id,
      dailyEnabled.id,
      dailyDisabled.id,
    ].filter(Boolean),
    matches: [
      preMatch.id,
      overlapA.id,
      overlapB.id,
      nonOverlap.id,
      inProgress.id,
      scoringActive.id,
      locked.id,
      completed.id,
    ].filter(Boolean),
    assignments: [],
  };

  const bootstrapAssignments = [];
  if (!identityOnly) {
    const inProgressLive = await applyLiveLifecycle({
      writers: tracked,
      tournamentId: primary.id,
      matchId: inProgress.id,
      runId,
      refereeId: refereeA.userId || refereeA.id,
      steps: ["startMatchLive"],
      paths: materializationPaths,
      key: "inProgress",
    });
    if (inProgressLive.ok === false) {
      if (inProgressLive.assignmentProof?.assignmentId) {
        owned.assignments.push(inProgressLive.assignmentProof.assignmentId);
      }
      return failWithPartial(inProgressLive, runId, owned, {
        verdict: inProgressLive.verdict,
      });
    }
    if (inProgressLive.assignmentProof?.assignmentId) {
      owned.assignments.push(inProgressLive.assignmentProof.assignmentId);
    }
    bootstrapAssignments.push({
      ...inProgressLive.assignmentProof,
      fixture: "inProgress",
    });
    const scoringLive = await applyLiveLifecycle({
      writers: tracked,
      tournamentId: primary.id,
      matchId: scoringActive.id,
      runId,
      refereeId: refereeA.userId || refereeA.id,
      steps: ["startMatchLive", "recordScoreEvent"],
      paths: materializationPaths,
      key: "scoringActive",
    });
    if (scoringLive.ok === false) {
      if (scoringLive.assignmentProof?.assignmentId) {
        owned.assignments.push(scoringLive.assignmentProof.assignmentId);
      }
      return failWithPartial(scoringLive, runId, owned, {
        verdict: scoringLive.verdict,
      });
    }
    if (scoringLive.assignmentProof?.assignmentId) {
      owned.assignments.push(scoringLive.assignmentProof.assignmentId);
    }
    bootstrapAssignments.push({
      ...scoringLive.assignmentProof,
      fixture: "scoringActive",
    });
    const lockedLive = await applyLiveLifecycle({
      writers: tracked,
      tournamentId: primary.id,
      matchId: locked.id,
      runId,
      refereeId: refereeA.userId || refereeA.id,
      steps: ["startMatchLive", "pauseMatchLive"],
      paths: materializationPaths,
      key: "locked",
    });
    if (lockedLive.ok === false) {
      if (lockedLive.assignmentProof?.assignmentId) {
        owned.assignments.push(lockedLive.assignmentProof.assignmentId);
      }
      return failWithPartial(lockedLive, runId, owned, {
        verdict: lockedLive.verdict,
      });
    }
    if (lockedLive.assignmentProof?.assignmentId) {
      owned.assignments.push(lockedLive.assignmentProof.assignmentId);
    }
    bootstrapAssignments.push({
      ...lockedLive.assignmentProof,
      fixture: "locked",
    });
    const completedLive = await applyLiveLifecycle({
      writers: tracked,
      tournamentId: completedLifecycle.id,
      matchId: completed.id,
      runId,
      refereeId: refereeA.userId || refereeA.id,
      steps: ["startMatchLive", "declareForfeit", "finalizeMatchLive"],
      paths: materializationPaths,
      key: "completed",
    });
    if (completedLive.ok === false) {
      if (completedLive.assignmentProof?.assignmentId) {
        owned.assignments.push(completedLive.assignmentProof.assignmentId);
      }
      return failWithPartial(completedLive, runId, owned, {
        verdict: completedLive.verdict,
      });
    }
    if (completedLive.assignmentProof?.assignmentId) {
      owned.assignments.push(completedLive.assignmentProof.assignmentId);
    }
    bootstrapAssignments.push({
      ...completedLive.assignmentProof,
      fixture: "completed",
    });
  }

  if (options.completePrimaryTournament === true) {
    return proof(false, "PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL violated");
  }
  if (typeof tracked.completeIsolatedTournament === "function" && options.allowTournamentCompletedAsMatchProof === true) {
    return proof(false, "completeIsolatedTournament is not MATCH completed proof");
  }

  const dailyEnabledMatch = entity(
    await tracked.createDailyPlayMatches({ tournamentId: dailyEnabled.id, enabled: true })
  );
  const dailyDisabledMatch = entity(
    await tracked.createDailyPlayMatches({ tournamentId: dailyDisabled.id, enabled: false })
  );

  const receipt = stripReceiptSecrets(
    createValidFixtureReceipt({
      runId,
      identityMode: FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY,
      tenantA: { id: tenantA.id, name: `${marker} Tenant A`, marker: CORE13_FIXTURE_NAMESPACE },
      tenantB: { id: tenantB.id, name: `${marker} Tenant B`, marker: CORE13_FIXTURE_NAMESPACE },
      users: {
        userA: { id: userA.userId || userA.id, role: userA.role || "TENANT_OWNER" },
        userB: { id: userB.userId || userB.id, role: userB.role || "TENANT_OWNER" },
        refereeA: {
          id: refereeA.userId || refereeA.id,
          role: "REFEREE",
          status: "ACTIVE",
        },
        replacementReferee: {
          id: replacementReferee.userId || replacementReferee.id,
          role: "REFEREE",
          status: "ACTIVE",
        },
        inactiveReferee: {
          id: inactiveReferee.userId || inactiveReferee.id,
          role: "REFEREE",
          status:
            inactiveReferee.contract01Evidence?.status ||
            inactiveReferee.status ||
            "suspended",
        },
        nonCanonicalSubject: {
          id: nonCanonicalSubject.id,
          role: "ABSENT",
          status: "ABSENT",
          classification: NON_CANONICAL_EXPECTED_ABSENT,
        },
      },
      tournaments: {
        primary: {
          id: primary.id,
          tenantId: tenantA.id,
          mode: "INTERNAL",
          name: `${marker} primary`,
          terminal: false,
        },
        crossTournament: {
          id: crossTournament.id,
          tenantId: tenantA.id,
          mode: "INTERNAL",
          name: `${marker} cross`,
        },
        dailyEnabled: {
          id: dailyEnabled.id,
          tenantId: tenantA.id,
          mode: "DAILY_PLAY",
          name: `${marker} daily-on`,
        },
        dailyDisabled: {
          id: dailyDisabled.id,
          tenantId: tenantA.id,
          mode: "DAILY_PLAY",
          name: `${marker} daily-off`,
        },
        completedLifecycle: {
          id: completedLifecycle.id,
          tenantId: tenantA.id,
          mode: "INTERNAL",
          name: `${marker} completed-only`,
          terminal: false,
        },
      },
      matches: {
        preMatch: { id: preMatch.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        overlapA: { id: overlapA.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        overlapB: { id: overlapB.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        nonOverlap: { id: nonOverlap.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        inProgress: { id: inProgress.id, tournamentId: primary.id, lifecycle: "IN_PROGRESS" },
        scoringActive: {
          id: scoringActive.id,
          tournamentId: primary.id,
          lifecycle: "SCORING_ACTIVE",
        },
        locked: { id: locked.id, tournamentId: primary.id, lifecycle: "LOCKED" },
        completed: {
          id: completed.id,
          tournamentId: completedLifecycle.id,
          lifecycle: "COMPLETED",
        },
        dailyEnabled: {
          id: dailyEnabledMatch.id,
          tournamentId: dailyEnabled.id,
          lifecycle: "PRE_MATCH",
        },
        dailyDisabled: {
          id: dailyDisabledMatch.id,
          tournamentId: dailyDisabled.id,
          lifecycle: "PRE_MATCH",
        },
      },
      assignments: bootstrapAssignments.map((row) => ({
        id: row.assignmentId,
        matchId: row.matchId,
        purpose: BOOTSTRAP_ASSIGNMENT_PURPOSE,
        fixture: row.fixture,
        active: true,
      })),
      bootstrapAssignments,
      cleanupPlan: {
        unknownBaselineAutoClean: false,
        receiptScopedOnly: true,
        typedByResource: true,
        genericUnassignOverAllReceiptIds: false,
        immutableAuditDelete: false,
        immutableIdempotencyDelete: false,
        existingQaAuthUsersRetained: true,
        nonCanonicalExpectedAbsent: true,
      },
    })
  );
  const valid = evaluateFixtureReceipt(receipt);
  if (!valid.ok) return valid;
  if (receipt.tournaments.primary.terminal === true) {
    return proof(false, "PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL violated");
  }
  if (String(receipt.matches.completed.tournamentId) === String(receipt.tournaments.primary.id)) {
    return proof(false, "COMPLETED_FIXTURE_ISOLATED violated");
  }
  return proof(true, runId, {
    receipt,
    PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL: true,
    COMPLETED_FIXTURE_ISOLATED: true,
    SHARED_REFEREE_MATCH_EXECUTION_INITIALIZER: "AVAILABLE",
    CANONICAL_AUTHORITY: "refereeV5EdgeInitializeExecution",
    liveLifecycleReady: identityOnly !== true,
    materializationPaths,
    COMPLETED_MATERIALIZATION_PATH:
      "createInternalMatch>initializeMatchExecution>bootstrapRefereeAssignment>startMatchLive>declareForfeit>finalizeMatchLive",
    COMPLETED_MATCH_EXECUTION: "CANONICAL_REFEREE_V5_FINALIZE",
    FAKE_COMPLETED_STATUS: "DENY",
    FORCE_COMPLETE_USED_IN_SOURCE_PLAN: "NO",
    identityMode,
    callLog,
  });
}

export function persistReceiptArtifact(receipt, rootDir = process.cwd()) {
  const valid = evaluateFixtureReceipt(receipt);
  if (!valid.ok) return valid;
  const dir = path.join(rootDir, RUNTIME_ARTIFACT_DIR);
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${receipt.runId}.json`);
  writeFileSync(filePath, JSON.stringify(receipt, null, 2), "utf8");
  return proof(true, filePath, { filePath });
}

export function persistPartialReceiptArtifact(receipt, rootDir = process.cwd()) {
  const valid = evaluatePartialFixtureReceipt(receipt);
  if (!valid.ok) return valid;
  const dir = path.join(rootDir, RUNTIME_ARTIFACT_DIR);
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${receipt.runId}.partial.json`);
  writeFileSync(filePath, JSON.stringify(receipt, null, 2), "utf8");
  return proof(true, filePath, { filePath, partial: true });
}

export function planTeardown(receipt, requestedIds) {
  const owned = [...listReceiptOwnedIds(receipt)];
  const ids = Array.isArray(requestedIds) && requestedIds.length ? requestedIds : owned;
  const scope = evaluateTeardownScope(receipt, ids);
  if (!scope.ok) return scope;
  const typed = buildTypedCleanupPlan(receipt);
  const badUnassign = ids.filter((id) => {
    const tenants = [receipt.tenantA?.id, receipt.tenantB?.id].map(String);
    const users = Object.values(receipt.users || {}).map((row) => String(row.id));
    const tournaments = Object.values(receipt.tournaments || {}).map((row) => String(row.id));
    return tenants.includes(String(id)) || users.includes(String(id)) || tournaments.includes(String(id));
  });
  if (badUnassign.length && requestedIds?.every?.((row) => row?.resource === "assignments")) {
    // typed request path handled below
  }
  return proof(true, "receipt-scoped-typed", {
    ids,
    unknownBaselineAutoClean: false,
    genericUnassignOverAllReceiptIds: false,
    typedByResource: true,
    steps: typed.steps,
  });
}

export async function teardownFromReceipt(options = {}) {
  if (options.unknownBaselineAutoClean === true) {
    return proof(false, "UNKNOWN_BASELINE_AUTO_CLEAN denied");
  }
  const receipt = options.receipt;
  const planned = planTeardown(receipt, options.requestedIds);
  if (!planned.ok) return planned;
  if (options.allowExecute !== true) {
    return proof(true, "teardown planned only", {
      executed: false,
      ids: planned.ids,
      steps: planned.steps,
    });
  }
  const writers = options.writers || {};
  const executed = [];
  const retained = [];
  for (const step of planned.steps || []) {
    if (step.resource === "assignments") {
      for (const id of step.ids) {
        if (typeof writers.unassignViaTrustedServer !== "function") {
          retained.push({ resource: "assignments", id, reason: "writer missing" });
          continue;
        }
        await writers.unassignViaTrustedServer({
          assignmentId: id,
          receiptRunId: receipt.runId,
        });
        executed.push({ resource: "assignments", id, command: "unassignViaTrustedServer" });
      }
      continue;
    }
    if (step.resource === "authUsers") {
      for (const id of step.ids) {
        if (step.retain === true || step.command === "retain") {
          retained.push({ resource: "authUsers", id, reason: "existing QA identity retained" });
          continue;
        }
        if (typeof writers.deleteAuthUser !== "function") {
          retained.push({ resource: "authUsers", id, reason: "writer missing" });
          continue;
        }
        await writers.deleteAuthUser({ id, receiptRunId: receipt.runId });
        executed.push({ resource: "authUsers", id, command: "deleteAuthUser" });
      }
      continue;
    }
    if (step.resource === "tournaments") {
      const liveBacked = receiptHasLiveBackedFixtures(receipt);
      for (const id of step.ids) {
        if (liveBacked || step.retain === true || typeof writers.deleteTournament !== "function") {
          retained.push({
            resource: "tournaments",
            id,
            reason: liveBacked
              ? "canonical_tournament_delete does not cascade live execution"
              : "canonical delete unsupported",
          });
          continue;
        }
        await writers.deleteTournament({ id, receiptRunId: receipt.runId });
        executed.push({ resource: "tournaments", id, command: "deleteTournament" });
      }
      continue;
    }
    if (step.resource === "matches" || step.resource === "tenants") {
      for (const id of step.ids) {
        retained.push({ resource: step.resource, id, reason: "no safe canonical inverse" });
      }
      continue;
    }
    if (step.resource === "liveExecutionArtifacts" || step.resource === "retainedImmutableArtifacts") {
      for (const id of step.ids) {
        retained.push({
          resource: step.resource,
          id,
          reason:
            step.resource === "liveExecutionArtifacts"
              ? "never direct-delete live execution"
              : "immutable history",
        });
      }
    }
  }
  return proof(true, "teardown executed typed", {
    executed: true,
    executedSteps: executed,
    retained,
    genericUnassignOverAllReceiptIds: false,
  });
}

export async function runFixtureProvisionerCli(argv = [], envMap = {}, options = {}) {
  const mode = parseProvisionerMode(argv);
  if (mode === "plan") {
    return planFixtureProvision({ writers: options.writers });
  }
  if (mode === "verify") {
    const receiptPath = String(envMap.CORE13_FIXTURE_RECEIPT_PATH || "").trim();
    if (!receiptPath) return proof(false, "CORE13_FIXTURE_RECEIPT_PATH required");
    const loaded = loadFixtureReceiptFromPath(receiptPath);
    if (!loaded.ok) return loaded;
    const physical = evaluatePhysicalEnvironment(loaded.receipt, envMap);
    if (!physical.ok) return physical;
    return proof(true, "receipt verified locally", {
      fixtures: hydrateHarnessFixtures(loaded.receipt),
    });
  }
  if (mode === "provision" || mode === "teardown") {
    const gate = evaluateRemoteProvisionGate(envMap, {
      writers: options.writers,
      organizerContext: options.organizerContext,
      refereeContext: options.refereeContext,
    });
    if (!gate.ok) {
      return proof(false, gate.detail, {
        verdict: gate.verdict || "REMOTE_FIXTURE_PROVISION_DENIED",
        executed: false,
        missing: gate.missing,
        REMOTE_FIXTURE_PROVISION_READY: false,
      });
    }
    if (options.allowExecute !== true) {
      return proof(false, "remote provision structurally gated; allowExecute required", {
        verdict: "REMOTE_FIXTURE_PROVISION_NOT_EXECUTED",
        executed: false,
        REMOTE_FIXTURE_PROVISION_READY: gate.REMOTE_FIXTURE_PROVISION_READY === true,
      });
    }
    if (mode === "teardown") {
      return proof(false, "remote teardown execution is Owner-GO only and was not run", {
        verdict: "REMOTE_FIXTURE_PROVISION_NOT_EXECUTED",
        executed: false,
      });
    }
    const materialized = await materializeReceiptFromWriters({
      writers: options.writers,
      allowExecute: true,
      runId: options.runId || `run-cli-${Date.now()}`,
      identityMode: FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY,
      organizerContext: options.organizerContext,
      refereeContext: options.refereeContext,
    });
    if (!materialized.ok) {
      if (materialized.partialReceipt) {
        persistPartialReceiptArtifact(
          materialized.partialReceipt,
          options.rootDir || process.cwd()
        );
      }
      return proof(false, materialized.detail, {
        verdict: materialized.verdict || "REMOTE_FIXTURE_PROVISION_FAILED",
        executed: false,
        missing: materialized.missing,
        status: materialized.status || null,
        validLive29CaseSsot: false,
        failureStage: materialized.failureStage || null,
        failureEnvelope: materialized.failureEnvelope || null,
        partialReceipt: materialized.partialReceipt || null,
      });
    }
    const persisted = persistReceiptArtifact(materialized.receipt, options.rootDir || process.cwd());
    if (!persisted.ok) return persisted;
    return proof(true, persisted.filePath, {
      verdict: "REMOTE_FIXTURE_PROVISION_EXECUTED",
      executed: true,
      receiptPath: persisted.filePath,
      receipt: materialized.receipt,
      runId: materialized.receipt.runId,
      PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL: materialized.PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL,
      COMPLETED_FIXTURE_ISOLATED: materialized.COMPLETED_FIXTURE_ISOLATED,
      materializationPaths: materialized.materializationPaths,
      identityMode: FIXTURE_BINDING_MODE.EXISTING_QA_IDENTITY,
    });
  }
  return proof(false, `unknown mode ${mode}`);
}

export { evaluateTypedTeardownTargets, buildTypedCleanupPlan, REQUIRED_WRITER_PORTS };

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && path.normalize(invokedPath) === path.normalize(selfPath)) {
  runFixtureProvisionerCli(process.argv.slice(2), process.env)
    .then((result) => {
      console.log(
        JSON.stringify(
          stripReceiptSecrets({
            ok: result.ok,
            verdict: result.verdict,
            detail: result.detail,
            missing: result.missing,
            status: result.status || null,
            validLive29CaseSsot: result.validLive29CaseSsot,
            failureStage: result.failureStage || null,
            failureEnvelope: result.failureEnvelope || null,
          }),
          null,
          2
        )
      );
      if (!result.ok) process.exit(1);
    })
    .catch((err) => {
      console.error(`REFUSE: ${err?.message || err}`);
      process.exit(1);
    });
}
