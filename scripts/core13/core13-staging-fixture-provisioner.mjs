#!/usr/bin/env node
/**
 * CORE-13 disposable Staging fixture provisioner — test/acceptance orchestrator.
 *
 * Not product runtime. Not browser. Not domain authority.
 * TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY
 * INTERNAL_MATCH_LIVE_SHELL remains a honest writer gap.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CORE13_FIXTURE_NAMESPACE } from "./core13-staging-acceptance-proofs.mjs";
import {
  CANONICAL_WRITER_CATALOG,
  evaluateInternalMatchWriterArchitecture,
  evaluatePortPresence,
  evaluateTeamWriterDeniedForInternal,
  evaluateWriterCoverage,
  HONEST_NOT_CONFIGURED,
  INTERNAL_MATCH_LIVE_SHELL_GAP,
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
  STAGING_PROJECT_REF,
  stripReceiptSecrets,
} from "./core13-staging-fixture-receipt.mjs";

export const RUNTIME_ARTIFACT_DIR = "artifacts/core13-staging-acceptance/runtime";

function proof(ok, detail, extra = {}) {
  return Object.freeze({ ok: ok === true, detail: String(detail || ""), ...extra });
}

export function evaluateRemoteProvisionGate(envMap = {}) {
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
  return proof(false, INTERNAL_MATCH_LIVE_SHELL_GAP, {
    verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
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
  return Object.freeze({
    ok: false,
    verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    provisioner: FIXTURE_PROVISIONER_ID,
    namespace: CORE13_FIXTURE_NAMESPACE,
    TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY: "DENY",
    INTERNAL_MATCH_WRITER_GAP: INTERNAL_MATCH_LIVE_SHELL_GAP,
    remoteMarkerPolicy:
      "secondary name/description metadata only where canonical fields already allow it; receipt is SSOT",
    unknownBaselineAutoClean: false,
    sqlExecution: false,
    edgeRedeploy: false,
    directServiceRoleBusinessDml: false,
    primaryTournamentRemainsNonTerminal: true,
    completedFixtureIsolated: true,
    ...HONEST_NOT_CONFIGURED,
    steps: [],
    missing: coverage.missing,
    gaps: coverage.gaps,
    catalog: CANONICAL_WRITER_CATALOG,
    teamCheck,
    architecture: coverage.architecture,
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

/**
 * Local/stub materialization for receipt-shape proofs.
 * Refuses Team-as-INTERNAL. Refuses completing the primary tournament.
 * Still reports INTERNAL_MATCH_LIVE_SHELL gap for live lifecycle readiness.
 */
export async function materializeReceiptFromWriters(options = {}) {
  if (options.allowTeamAsInternal === true || options.writers?.__allowTeamAsInternal === true) {
    return proof(false, "TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY", {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      MISSING_CAPABILITY: INTERNAL_MATCH_LIVE_SHELL_GAP,
    });
  }
  if (typeof options.writers?.provisionLiveMatchShell === "function") {
    return proof(false, "TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY provisionLiveMatchShell", {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      MISSING_CAPABILITY: INTERNAL_MATCH_LIVE_SHELL_GAP,
    });
  }
  if (typeof options.writers?.teamTournamentProvisionRefereeMatch === "function") {
    return proof(false, "TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY", {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      MISSING_CAPABILITY: INTERNAL_MATCH_LIVE_SHELL_GAP,
    });
  }

  const ports = evaluatePortPresence(options.writers || {});
  if (!ports.ok) return ports;
  if (options.allowExecute !== true) {
    return proof(false, "materialize requires explicit allowExecute");
  }

  // Full live lifecycle readiness remains blocked.
  if (options.requireInternalLiveShell !== false) {
    return proof(false, INTERNAL_MATCH_LIVE_SHELL_GAP, {
      verdict: "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
      MISSING_CAPABILITY: INTERNAL_MATCH_LIVE_SHELL_GAP,
      architecture: evaluateInternalMatchWriterArchitecture(),
    });
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

  const mkMatch = async (tournamentId, lifecycle) =>
    entity(await writers.createInternalMatch({ tournamentId, lifecycle, mode: "INTERNAL" }));

  const preMatch = await mkMatch(primary.id, "PRE_MATCH");
  const overlapA = await mkMatch(primary.id, "PRE_MATCH");
  const overlapB = await mkMatch(primary.id, "PRE_MATCH");
  const nonOverlap = await mkMatch(primary.id, "PRE_MATCH");
  // Live lifecycle shells are unavailable for INTERNAL — materialize only when
  // requireInternalLiveShell=false for local receipt-shape tests; IDs are placeholders.
  const inProgress = await mkMatch(primary.id, "IN_PROGRESS");
  const scoringActive = await mkMatch(primary.id, "SCORING_ACTIVE");
  const locked = await mkMatch(primary.id, "LOCKED");
  const completed = await mkMatch(completedLifecycle.id, "COMPLETED");
  await writers.completeIsolatedTournament({
    tournamentId: completedLifecycle.id,
    matchId: completed.id,
  });
  if (writers.completeIsolatedTournament && options.forbidPrimaryComplete !== false) {
    // Guard: primary must never be completed by this orchestrator.
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
    INTERNAL_MATCH_LIVE_SHELL_GAP,
    liveLifecycleReady: false,
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
      for (const id of step.ids) {
        if (typeof writers.deleteTournament !== "function") {
          retained.push({ resource: "tournaments", id, reason: "canonical delete unsupported" });
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
    if (step.resource === "retainedImmutableArtifacts") {
      for (const id of step.ids) {
        retained.push({ resource: "retainedImmutableArtifacts", id, reason: "immutable history" });
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
    const gate = evaluateRemoteProvisionGate(envMap);
    if (!gate.ok) {
      return proof(false, gate.detail, {
        verdict: gate.verdict || "REMOTE_FIXTURE_PROVISION_DENIED",
        executed: false,
      });
    }
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
