#!/usr/bin/env node
/**
 * CORE-13 disposable Staging fixture provisioner — test/acceptance orchestrator.
 *
 * Not product runtime. Not browser. Not Tenant/Identity/Tournament/Match/Lifecycle
 * authority. Orchestrates existing canonical writers for disposable receipts.
 *
 * Modes: --plan | --verify | --provision | --teardown
 * This pass authorizes local/static/unit only. Remote --provision/--teardown
 * require a later Owner GO and are refused here without:
 *   CORE13_FIXTURE_PROVISION_GO=YES
 *   STAGING_MUTATION_GO=YES
 *   PICK_VN_ENV=staging
 *   TARGET_PROJECT_REF=qyewbxjsiiyufanzcjcq
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CORE13_FIXTURE_NAMESPACE } from "./core13-staging-acceptance-proofs.mjs";
import {
  CANONICAL_WRITER_CATALOG,
  evaluateWriterCoverage,
  HONEST_NOT_CONFIGURED,
  REQUIRED_WRITER_PORTS,
} from "./core13-staging-fixture-writers.mjs";
import {
  createValidFixtureReceipt,
  evaluateFixtureReceipt,
  evaluatePhysicalEnvironment,
  evaluateTeardownScope,
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
  return proof(true, "remote-provision-gate");
}

export function parseProvisionerMode(argv = []) {
  if (argv.includes("--teardown")) return "teardown";
  if (argv.includes("--provision")) return "provision";
  if (argv.includes("--verify")) return "verify";
  return "plan";
}

export function planFixtureProvision(options = {}) {
  const coverage = evaluateWriterCoverage(options.writers || {});
  const steps = REQUIRED_WRITER_PORTS.map((port) => ({
    port,
    authority: CANONICAL_WRITER_CATALOG[port].authority,
    classification: CANONICAL_WRITER_CATALOG[port].classification,
  }));
  return Object.freeze({
    ok: coverage.ok,
    verdict: coverage.ok ? "PLAN_READY" : "BLOCKED_CANONICAL_FIXTURE_WRITER_GAP",
    provisioner: FIXTURE_PROVISIONER_ID,
    namespace: CORE13_FIXTURE_NAMESPACE,
    remoteMarkerPolicy:
      "secondary name/description metadata only where canonical fields already allow it; receipt is SSOT",
    unknownBaselineAutoClean: false,
    sqlExecution: false,
    edgeRedeploy: false,
    directServiceRoleBusinessDml: false,
    ...HONEST_NOT_CONFIGURED,
    steps: coverage.ok ? steps : [],
    missing: coverage.missing,
    gaps: coverage.gaps,
    catalog: CANONICAL_WRITER_CATALOG,
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

export async function materializeReceiptFromWriters(options = {}) {
  const coverage = evaluateWriterCoverage(options.writers || {});
  if (!coverage.ok) return coverage;
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
    })
  );
  const crossTournament = entity(
    await writers.createCanonicalTournament({
      tenantId: tenantA.id,
      name: `${marker} cross`,
      mode: "INTERNAL",
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

  const preMatch = entity(await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "PRE_MATCH" }));
  const overlapA = entity(await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "PRE_MATCH" }));
  const overlapB = entity(await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "PRE_MATCH" }));
  const nonOverlap = entity(await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "PRE_MATCH" }));
  const inProgress = entity(await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "IN_PROGRESS" }));
  await writers.startMatchLive({ matchId: inProgress.id });
  const scoringActive = entity(
    await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "SCORING_ACTIVE" })
  );
  await writers.startMatchLive({ matchId: scoringActive.id });
  await writers.recordScoreEvent({ matchId: scoringActive.id });
  const locked = entity(await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "LOCKED" }));
  await writers.startMatchLive({ matchId: locked.id });
  await writers.pauseMatchLive({ matchId: locked.id });
  const completed = entity(await writers.provisionLiveMatchShell({ tournamentId: primary.id, lifecycle: "COMPLETED" }));
  await writers.completeTournament({ tournamentId: primary.id, matchId: completed.id });
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
        primary: { id: primary.id, tenantId: tenantA.id, mode: "INTERNAL", name: `${marker} primary` },
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
      },
      matches: {
        preMatch: { id: preMatch.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        overlapA: { id: overlapA.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        overlapB: { id: overlapB.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        nonOverlap: { id: nonOverlap.id, tournamentId: primary.id, lifecycle: "PRE_MATCH" },
        inProgress: { id: inProgress.id, tournamentId: primary.id, lifecycle: "IN_PROGRESS" },
        scoringActive: { id: scoringActive.id, tournamentId: primary.id, lifecycle: "SCORING_ACTIVE" },
        locked: { id: locked.id, tournamentId: primary.id, lifecycle: "LOCKED" },
        completed: { id: completed.id, tournamentId: primary.id, lifecycle: "COMPLETED" },
        dailyEnabled: { id: dailyEnabledMatch.id, tournamentId: dailyEnabled.id, lifecycle: "PRE_MATCH" },
        dailyDisabled: { id: dailyDisabledMatch.id, tournamentId: dailyDisabled.id, lifecycle: "PRE_MATCH" },
      },
    })
  );
  const valid = evaluateFixtureReceipt(receipt);
  if (!valid.ok) return valid;
  return proof(true, runId, { receipt });
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
  return proof(true, "receipt-scoped", {
    ids,
    unknownBaselineAutoClean: false,
    steps: [
      { command: "unassignViaTrustedServer", target: "receipt-owned active assignments" },
      { command: "deleteAuthUser", target: "provisioner-created disposable auth users" },
      {
        command: "archiveTournament",
        target: "canonical archive/cancel if supported; else retain disposable artifact",
      },
    ],
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
    return proof(true, "teardown planned only", { executed: false, ids: planned.ids });
  }
  const writers = options.writers || {};
  const coverage = evaluateWriterCoverage(writers);
  if (!coverage.ok) return coverage;
  for (const id of planned.ids) {
    if (typeof writers.unassignViaTrustedServer === "function") {
      await writers.unassignViaTrustedServer({ id, receiptRunId: receipt.runId });
    }
  }
  return proof(true, "teardown executed", { executed: true, ids: planned.ids });
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
        verdict: "REMOTE_FIXTURE_PROVISION_DENIED",
        executed: false,
      });
    }
    const coverage = evaluateWriterCoverage(options.writers || {});
    if (!coverage.ok) return coverage;
    if (mode === "provision") {
      return materializeReceiptFromWriters({
        writers: options.writers,
        allowExecute: true,
        runId: envMap.CORE13_FIXTURE_RUN_ID,
      });
    }
    const receiptPath = String(envMap.CORE13_FIXTURE_RECEIPT_PATH || "").trim();
    if (!receiptPath) return proof(false, "CORE13_FIXTURE_RECEIPT_PATH required");
    const loaded = loadFixtureReceiptFromPath(receiptPath);
    if (!loaded.ok) return loaded;
    return teardownFromReceipt({
      receipt: loaded.receipt,
      writers: options.writers,
      allowExecute: true,
      unknownBaselineAutoClean: false,
    });
  }
  return proof(false, `unknown mode ${mode}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && path.normalize(invokedPath) === path.normalize(selfPath)) {
  runFixtureProvisionerCli(process.argv.slice(2), process.env)
    .then((result) => {
      console.log(JSON.stringify({ ok: result.ok, verdict: result.verdict, detail: result.detail }, null, 2));
      if (!result.ok) process.exit(1);
    })
    .catch((err) => {
      console.error(`REFUSE: ${err?.message || err}`);
      process.exit(1);
    });
}
