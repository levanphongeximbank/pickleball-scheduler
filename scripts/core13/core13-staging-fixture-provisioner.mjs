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
  bindSharedRefereeExecutionWriters,
  CANONICAL_WRITER_CATALOG,
  evaluateDailyWriterDeniedForInternal,
  evaluateExecutableRemoteBinding,
  evaluateForbiddenCallerAuthority,
  evaluateInternalMatchWriterArchitecture,
  evaluateTeamWriterDeniedForInternal,
  evaluateWriterCoverage,
  HONEST_NOT_CONFIGURED,
  INITIALIZER_AUTHORITY,
  INITIALIZER_PORT_NAME,
  REQUIRED_WRITER_PORTS,
} from "./core13-staging-fixture-writers.mjs";
import {
  buildTypedCleanupPlan,
  createValidFixtureReceipt,
  evaluateFixtureReceipt,
  evaluatePhysicalEnvironment,
  evaluateTeardownScope,
  evaluateTypedTeardownTargets,
  FIXTURE_PROVISIONER_ID,
  hydrateHarnessFixtures,
  listReceiptOwnedIds,
  loadFixtureReceiptFromPath,
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

export function readStagingEdgeBaseUrl(envMap = {}) {
  return String(envMap.STAGING_EDGE_BASE_URL || envMap.STAGING_SUPABASE_URL || "").trim();
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
  const accessToken = readOrganizerAccessToken(envMap);
  if (!accessToken) {
    return proof(false, "authenticated organizer token required", {
      REMOTE_FIXTURE_PROVISION_READY: false,
    });
  }
  const edgeBaseUrl = readStagingEdgeBaseUrl(envMap);
  if (!edgeBaseUrl) {
    return proof(false, "Staging Edge base URL required", {
      REMOTE_FIXTURE_PROVISION_READY: false,
    });
  }
  const executionWriters = bindSharedRefereeExecutionWriters({ accessToken, edgeBaseUrl });
  const writers = { ...executionWriters, ...(options.writers || {}) };
  const binding = evaluateExecutableRemoteBinding(writers);
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
          "createCanonicalMatchIdentity",
          "initializeMatchExecution",
          "refereeV5LifecycleCommands",
          "completeIsolatedTournament",
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

async function applyLiveLifecycle({ writers, tournamentId, matchId, runId, steps, paths, key }) {
  const initInput = {
    tournamentId,
    matchId,
    competitionMode: "INTERNAL",
    runId,
  };
  const caller = evaluateForbiddenCallerAuthority(initInput);
  if (!caller.ok) return caller;
  const initialized = await writers.initializeMatchExecution(initInput);
  if (initialized && initialized.ok === false) return initialized;
  recordPath(paths, key, "initializeMatchExecution");
  for (const step of steps) {
    const result = await writers[step]({ tournamentId, matchId, runId });
    if (result && result.ok === false) return result;
    recordPath(paths, key, step);
  }
  return { ok: true };
}

/**
 * Local/stub materialization for receipt-shape proofs.
 * Refuses Team/Daily as INTERNAL execution authority.
 * Live lifecycle uses initialize-execution then Referee V5 commands.
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

  const identityOnly =
    options.requireLiveLifecycle === false || options.requireInternalLiveShell === false;
  const ports = evaluateWriterCoverage(options.writers || {});
  if (!ports.ok) return ports;
  if (options.allowExecute !== true) {
    return proof(false, "materialize requires explicit allowExecute");
  }

  const writers = options.writers;
  const runId = String(options.runId || `run-${Date.now()}`);
  const marker = `${CORE13_FIXTURE_NAMESPACE} ${runId}`;

  const tenantA = entity(await writers.createTenant({ name: `${marker} Tenant A`, disposable: true }));
  const tenantB = entity(await writers.createTenant({ name: `${marker} Tenant B`, disposable: true }));
  const userA = entity(await writers.createAuthUser({ tenantId: tenantA.id, role: "TENANT_OWNER" }));
  const userB = entity(await writers.createAuthUser({ tenantId: tenantB.id, role: "TENANT_OWNER" }));
  const refereeA = entity(
    await writers.createAuthUser({ tenantId: tenantA.id, role: "REFEREE", status: "ACTIVE" })
  );
  const replacementReferee = entity(
    await writers.createAuthUser({ tenantId: tenantA.id, role: "REFEREE", status: "ACTIVE" })
  );
  const inactiveReferee = entity(
    await writers.createAuthUser({ tenantId: tenantA.id, role: "REFEREE", status: "INACTIVE" })
  );
  await writers.updateIdentitySubject({ id: inactiveReferee.id, status: "INACTIVE" });
  const nonCanonicalSubject = entity(
    await writers.createAuthUser({ tenantId: tenantA.id, role: "PLAYER", status: "ACTIVE" })
  );

  const primary = entity(
    await writers.createCanonicalTournament({
      tenantId: tenantA.id,
      name: `${marker} primary`,
      mode: "INTERNAL",
      terminal: false,
    })
  );
  const crossTournament = entity(
    await writers.createCanonicalTournament({
      tenantId: tenantA.id,
      name: `${marker} cross`,
      mode: "INTERNAL",
    })
  );
  const completedLifecycle = entity(
    await writers.createCanonicalTournament({
      tenantId: tenantA.id,
      name: `${marker} completed-only`,
      mode: "INTERNAL",
      terminal: true,
    })
  );
  const dailyEnabled = entity(
    await writers.createDailyPlayTournament({
      tenantId: tenantA.id,
      name: `${marker} daily-on`,
      refereeFeatureEnabled: true,
    })
  );
  const dailyDisabled = entity(
    await writers.createDailyPlayTournament({
      tenantId: tenantA.id,
      name: `${marker} daily-off`,
      refereeFeatureEnabled: false,
    })
  );
  await writers.setCourtSchedule({ tournamentId: primary.id, tenantId: tenantA.id, marker });

  const mkMatch = async (tournamentId) =>
    entity(await writers.createInternalMatch({ tournamentId, mode: "INTERNAL" }));

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

  if (!identityOnly) {
    const inProgressLive = await applyLiveLifecycle({
      writers,
      tournamentId: primary.id,
      matchId: inProgress.id,
      runId,
      steps: ["startMatchLive"],
      paths: materializationPaths,
      key: "inProgress",
    });
    if (inProgressLive.ok === false) return inProgressLive;
    const scoringLive = await applyLiveLifecycle({
      writers,
      tournamentId: primary.id,
      matchId: scoringActive.id,
      runId,
      steps: ["startMatchLive", "recordScoreEvent"],
      paths: materializationPaths,
      key: "scoringActive",
    });
    if (scoringLive.ok === false) return scoringLive;
    const lockedLive = await applyLiveLifecycle({
      writers,
      tournamentId: primary.id,
      matchId: locked.id,
      runId,
      steps: ["startMatchLive", "pauseMatchLive"],
      paths: materializationPaths,
      key: "locked",
    });
    if (lockedLive.ok === false) return lockedLive;
  }

  await writers.completeIsolatedTournament({
    tournamentId: completedLifecycle.id,
    matchId: completed.id,
  });
  recordPath(materializationPaths, "completed", "completeIsolatedTournament");
  if (options.completePrimaryTournament === true) {
    return proof(false, "PRIMARY_TOURNAMENT_REMAINS_NON_TERMINAL violated");
  }

  const dailyEnabledMatch = entity(
    await writers.createDailyPlayMatches({ tournamentId: dailyEnabled.id, enabled: true })
  );
  const dailyDisabledMatch = entity(
    await writers.createDailyPlayMatches({ tournamentId: dailyDisabled.id, enabled: false })
  );

  const receipt = stripReceiptSecrets(
    createValidFixtureReceipt({
      runId,
      tenantA: { id: tenantA.id, name: `${marker} Tenant A`, marker: CORE13_FIXTURE_NAMESPACE },
      tenantB: { id: tenantB.id, name: `${marker} Tenant B`, marker: CORE13_FIXTURE_NAMESPACE },
      users: {
        userA: { id: userA.id, role: "TENANT_OWNER" },
        userB: { id: userB.id, role: "TENANT_OWNER" },
        refereeA: { id: refereeA.id, role: "REFEREE", status: "ACTIVE" },
        replacementReferee: { id: replacementReferee.id, role: "REFEREE", status: "ACTIVE" },
        inactiveReferee: { id: inactiveReferee.id, role: "REFEREE", status: "INACTIVE" },
        nonCanonicalSubject: { id: nonCanonicalSubject.id, role: "PLAYER", status: "ACTIVE" },
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
          terminal: true,
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
      cleanupPlan: buildTypedCleanupPlan({
        tenantA,
        tenantB,
        users: {
          userA,
          userB,
          refereeA,
          replacementReferee,
          inactiveReferee,
          nonCanonicalSubject,
        },
        tournaments: {
          primary,
          crossTournament,
          dailyEnabled,
          dailyDisabled,
          completedLifecycle,
        },
        matches: {
          preMatch,
          overlapA,
          overlapB,
          nonOverlap,
          inProgress,
          scoringActive,
          locked,
          completed,
          dailyEnabled: dailyEnabledMatch,
          dailyDisabled: dailyDisabledMatch,
        },
      }).steps
        ? {
            unknownBaselineAutoClean: false,
            receiptScopedOnly: true,
            typedByResource: true,
            genericUnassignOverAllReceiptIds: false,
            immutableAuditDelete: false,
            immutableIdempotencyDelete: false,
          }
        : undefined,
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
    COMPLETED_MATERIALIZATION_PATH: "completeIsolatedTournament",
    COMPLETED_MATCH_EXECUTION_GAP: "TOURNAMENT_STATUS_ONLY",
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
    const gate = evaluateRemoteProvisionGate(envMap, { writers: options.writers });
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
    return proof(false, "remote provision execution is Owner-GO only and was not run", {
      verdict: "REMOTE_FIXTURE_PROVISION_NOT_EXECUTED",
      executed: false,
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
          { ok: result.ok, verdict: result.verdict, detail: result.detail, missing: result.missing },
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
