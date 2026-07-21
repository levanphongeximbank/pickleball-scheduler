/**
 * CORE-06 Phase 1F — adapter, mapping, persistence contract, parity, certification.
 * Capability-local only — no Production wiring.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isLineupFormatAdapter,
  LINEUP_FORMAT_ADAPTER_KIND,
  matchesLineupPersistenceTransactionPort,
  LINEUP_PERSISTENCE_GUARANTEES,
  compareLineupShadowResults,
  certifyCore06Phase1F,
  LINEUP_CERTIFICATION_VERDICT,
  LINEUP_CERT_AXIS,
  createLineupCertificationReport,
  createDefaultLineupHardeningPolicy,
  LINEUP_RUNTIME_ERROR_CODE,
  LINEUP_VISIBILITY_STATE,
  projectLineupForViewer,
  LineupRuntimeError,
  LINEUP_ACCEPTED_DIFFERENCE_CODE,
  LINEUP_ACCEPTED_DIFFERENCE_REGISTRY,
  isLineupAcceptedDifferenceCode,
  LINEUP_SHADOW_CLASSIFICATION,
} from "../src/features/competition-core/lineups/index.js";

import {
  createFixtureLineupFormatAdapter,
  mapTeamTournamentLineupInputToCanonical,
  mapCanonicalLineupResultToTeamTournament,
  CANONICAL_FIELDS_NOT_IN_LEGACY,
  TT_CORE06_COMPATIBILITY_MATRIX,
  findCompatibilityRow,
  createInMemoryLineupPersistenceTransactionPort,
  LINEUP_PERSISTENCE_TX_IMPL_KIND,
  LINEUP_PARITY_SCENARIOS,
  summarizeParityCatalog,
  validateParityCatalog,
} from "../src/features/competition-core/lineups/integration/index.js";

import * as lineupsPublic from "../src/features/competition-core/lineups/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LINEUPS_ROOT = path.join(ROOT, "src/features/competition-core/lineups");
const FIXED_NOW = "2026-07-21T12:00:00.000Z";

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function baseFixture(overrides = {}) {
  return {
    tenantId: "tenant-1",
    tournamentId: "comp-1",
    matchupId: "mu-1",
    teamId: "team-1",
    status: "draft",
    actorId: "captain-1",
    actorRole: "CAPTAIN",
    source: "fixture",
    evaluatedAt: FIXED_NOW,
    expectedVersion: 1,
    idempotencyKey: "idem-f1",
    selections: [
      { discipline: "md", index: 0, playerId: "p-1" },
      { discipline: "md", index: 1, playerId: "p-2" },
    ],
    lineupLockAt: "2026-07-21T18:00:00.000Z",
    ...overrides,
  };
}

// ---------- Adapter contract ----------

test("1F adapter: fixture adapter satisfies LineupFormatAdapter contract", () => {
  const adapter = createFixtureLineupFormatAdapter();
  assert.equal(isLineupFormatAdapter(adapter), true);
  assert.equal(adapter.kind, LINEUP_FORMAT_ADAPTER_KIND);
});

test("1F adapter: resolveAggregateIdentity is deterministic", () => {
  const adapter = createFixtureLineupFormatAdapter();
  const a = adapter.resolveAggregateIdentity(baseFixture());
  const b = adapter.resolveAggregateIdentity(baseFixture());
  assert.equal(a.ok, true);
  assert.deepEqual(a.value, b.value);
  assert.equal(a.value.identityKey, "comp-1::LINEUP::mu-1::team-1");
});

test("1F adapter: mapCreateCommand succeeds for valid fixture", () => {
  const mapped = createFixtureLineupFormatAdapter().mapCreateCommand(
    baseFixture()
  );
  assert.equal(mapped.ok, true);
  assert.equal(mapped.value.commandType, "createLineup");
});

test("1F adapter: mapSubmit/Lock/Publish command types", () => {
  const adapter = createFixtureLineupFormatAdapter();
  assert.equal(adapter.mapSubmitCommand(baseFixture()).value.commandType, "submit");
  assert.equal(adapter.mapLockCommand(baseFixture()).value.commandType, "lock");
  assert.equal(
    adapter.mapPublishCommand(baseFixture()).value.commandType,
    "publish"
  );
});

test("1F adapter: correction requires reason and does not infer auth", () => {
  const adapter = createFixtureLineupFormatAdapter();
  const missing = adapter.mapCorrectionCommand(baseFixture());
  assert.equal(missing.ok, false);
  assert.equal(
    missing.code,
    LINEUP_RUNTIME_ERROR_CODE.LINEUP_OVERRIDE_REASON_REQUIRED
  );
  const withReason = adapter.mapCorrectionCommand(
    baseFixture({ reason: "repair", correctionAuthorized: false })
  );
  assert.equal(withReason.ok, true);
  assert.equal(withReason.value.correctionAuthorized, false);
});

test("1F adapter: random fallback requires seed", () => {
  const adapter = createFixtureLineupFormatAdapter();
  assert.equal(adapter.mapRandomFallbackCommand(baseFixture()).ok, false);
  const ok = adapter.mapRandomFallbackCommand(
    baseFixture({ ownerSeed: "seed-1" })
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.value.seed, "seed-1");
});

test("1F adapter: mapExpectedVersion never synthesizes", () => {
  const adapter = createFixtureLineupFormatAdapter();
  const withV = adapter.mapExpectedVersion(baseFixture({ expectedVersion: 4 }));
  assert.equal(withV.value.expectedVersion, 4);
  assert.equal(withV.value.synthesize, false);
  const missing = adapter.mapExpectedVersion(
    baseFixture({ expectedVersion: undefined })
  );
  assert.equal(missing.value.expectedVersion, null);
  assert.equal(missing.value.synthesize, false);
});

test("1F adapter: idempotency context requires key and aggregate", () => {
  const adapter = createFixtureLineupFormatAdapter();
  const fail = adapter.mapIdempotencyContext(
    baseFixture({ idempotencyKey: "" })
  );
  assert.equal(fail.ok, false);
  const ok = adapter.mapIdempotencyContext(
    baseFixture({ commandType: "submit" })
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.value.aggregateIdentity, "comp-1::LINEUP::mu-1::team-1");
});

test("1F adapter: hardening policy does not invent correction auth", () => {
  const adapter = createFixtureLineupFormatAdapter();
  const mapped = adapter.mapHardeningPolicy({});
  assert.equal(mapped.value.allowsLockedCorrection, false);
  const allowed = adapter.mapHardeningPolicy({ allowsLockedCorrection: true });
  assert.equal(allowed.value.allowsLockedCorrection, true);
});

// ---------- Legacy → canonical ----------

test("1F map in: happy path maps tournament/matchup fields", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(baseFixture());
  assert.equal(mapped.ok, true);
  assert.equal(mapped.value.competitionId, "comp-1");
  assert.equal(mapped.value.contextId, "mu-1");
  assert.equal(mapped.value.visibilityState, LINEUP_VISIBILITY_STATE.PRIVATE);
});

test("1F map in: missing tenant fails closed", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ tenantId: "" })
  );
  assert.equal(mapped.ok, false);
  assert.equal(mapped.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_SCOPE_REQUIRED);
});

test("1F map in: missing competition fails closed", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ tournamentId: "", competitionId: "" })
  );
  assert.equal(mapped.ok, false);
});

test("1F map in: missing evaluatedAt fails closed", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ evaluatedAt: "", commandTime: "", policyTime: "" })
  );
  assert.equal(mapped.ok, false);
  assert.equal(mapped.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED);
});

test("1F map in: ambiguous identity fails", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ identityKey: "totally-wrong" })
  );
  assert.equal(mapped.ok, false);
  assert.equal(mapped.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_MISMATCH);
});

test("1F map in: unsupported legacy status fails", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ status: "mystery_state" })
  );
  assert.equal(mapped.ok, false);
  assert.equal(
    mapped.code,
    LINEUP_RUNTIME_ERROR_CODE.UNSUPPORTED_LINEUP_STATUS
  );
});

test("1F map in: withdrawn maps to VOIDED", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ status: "withdrawn" })
  );
  assert.equal(mapped.ok, true);
  assert.equal(mapped.value.status, "VOIDED");
});

test("1F map in: does not infer reveal from locked status", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ status: "locked" })
  );
  assert.equal(mapped.value.status, "LOCKED");
  assert.equal(mapped.value.visibilityState, LINEUP_VISIBILITY_STATE.PRIVATE);
  assert.equal(mapped.value.revealEligible, false);
});

test("1F map in: preserves idempotency key, actor, source, evaluatedAt", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(baseFixture());
  assert.equal(mapped.value.command.idempotencyKey, "idem-f1");
  assert.equal(mapped.value.command.actorId, "captain-1");
  assert.equal(mapped.value.command.evaluatedAt, FIXED_NOW);
  assert.equal(mapped.value.command.source, "fixture");
});

test("1F map in: does not mutate input fixture", () => {
  const input = baseFixture();
  const snap = JSON.stringify(input);
  mapTeamTournamentLineupInputToCanonical(input);
  assert.equal(JSON.stringify(input), snap);
});

// ---------- Canonical → legacy ----------

test("1F map out: preserves lifecycle and revision", () => {
  const out = mapCanonicalLineupResultToTeamTournament({
    ok: true,
    value: {
      competitionId: "comp-1",
      contextId: "mu-1",
      teamId: "team-1",
      tenantId: "tenant-1",
      status: "LOCKED",
      revision: 5,
      visibilityState: "PRIVATE",
      slots: [{ person: { id: "p-1" } }],
    },
    details: {
      mutationPhase: "LOCKED",
      revealEligible: true,
      revealPhase: "REVEAL_READY",
    },
  });
  assert.equal(out.ok, true);
  assert.equal(out.value.status, "locked");
  assert.equal(out.value.revision, 5);
  assert.equal(out.value.lockState, true);
  assert.equal(out.value.revealEligible, true);
  assert.equal(out.value.mutationPhase, "LOCKED");
  assert.equal(out.value.revealPhase, "REVEAL_READY");
  assert.equal(out.value.selections, null);
});

test("1F map out: does not collapse LOCKED and REVEAL_READY", () => {
  const out = mapCanonicalLineupResultToTeamTournament({
    ok: true,
    value: { status: "LOCKED", revision: 2, visibilityState: "PRIVATE" },
    details: { mutationPhase: "LOCKED", revealEligible: true, revealPhase: "REVEAL_READY" },
  });
  assert.notEqual(out.value.mutationPhase, out.value.revealPhase);
  assert.equal(out.value.lockState, true);
  assert.equal(out.value.revealEligible, true);
});

test("1F map out: hides selections without authorization", () => {
  const out = mapCanonicalLineupResultToTeamTournament({
    ok: true,
    value: {
      status: "PUBLISHED",
      revision: 1,
      slots: [{ person: { id: "secret" } }],
    },
  });
  assert.equal(out.value.selections, null);
});

test("1F map out: error path is deterministic", () => {
  const out = mapCanonicalLineupResultToTeamTournament({
    ok: false,
    code: LINEUP_RUNTIME_ERROR_CODE.LINEUP_STALE_COMMAND,
    message: "stale",
    details: { replayed: false },
  });
  assert.equal(out.value.ok, false);
  assert.equal(out.value.errorCode, LINEUP_RUNTIME_ERROR_CODE.LINEUP_STALE_COMMAND);
  assert.equal(out.value.selections, null);
});

test("1F map out: fingerprints omitted by default", () => {
  const out = mapCanonicalLineupResultToTeamTournament({
    ok: true,
    value: { status: "DRAFT", revision: 1 },
    details: { commandFingerprint: "abc", resultFingerprint: "def" },
  });
  assert.equal("commandFingerprint" in out.value, false);
  assert.ok(CANONICAL_FIELDS_NOT_IN_LEGACY.includes("commandFingerprint"));
});

test("1F map out: replayed flag preserved", () => {
  const out = mapCanonicalLineupResultToTeamTournament({
    ok: true,
    value: { status: "SUBMITTED", revision: 2 },
    details: { replayed: true, idempotencyKey: "k" },
  });
  assert.equal(out.value.replayed, true);
  assert.equal(out.value.idempotencyKey, "k");
});

// ---------- Compatibility matrix ----------

test("1F compatibility: matrix is non-empty and classifies concepts", () => {
  assert.ok(TT_CORE06_COMPATIBILITY_MATRIX.length >= 20);
  assert.ok(findCompatibilityRow("tenant"));
  assert.equal(findCompatibilityRow("visibilityState").classification, "canonical_only_field");
});

// ---------- Persistence contract ----------

test("1F persistence: in-memory TX port matches contract", () => {
  const port = createInMemoryLineupPersistenceTransactionPort();
  assert.equal(matchesLineupPersistenceTransactionPort(port), true);
  assert.equal(LINEUP_PERSISTENCE_GUARANTEES.noPartialAuditWrite, true);
});

test("1F persistence: commitCommand increments version and appends audit", async () => {
  const port = createInMemoryLineupPersistenceTransactionPort();
  const result = await port.commitCommand({
    identityKey: "agg-1",
    expectedVersion: null,
    commandType: "create",
    evaluatedAt: FIXED_NOW,
    nextAggregate: { identityKey: "agg-1", revision: 1, status: "DRAFT" },
    actor: { actorId: "a1" },
    source: "test",
  });
  assert.equal(result.ok, true);
  assert.equal(result.resultingVersion, 1);
  assert.equal(port._audits.length, 1);
});

test("1F persistence: expectedVersion conflict fails closed", async () => {
  const port = createInMemoryLineupPersistenceTransactionPort();
  await port.commitCommand({
    identityKey: "agg-2",
    nextAggregate: { identityKey: "agg-2", revision: 1, status: "DRAFT" },
  });
  await assert.rejects(
    () =>
      port.commitCommand({
        identityKey: "agg-2",
        expectedVersion: 99,
        nextAggregate: {
          identityKey: "agg-2",
          revision: 2,
          status: "SUBMITTED",
        },
      }),
    (err) =>
      err instanceof LineupRuntimeError &&
      err.code === LINEUP_RUNTIME_ERROR_CODE.LINEUP_VERSION_CONFLICT
  );
  const loaded = await port.loadForUpdate({ identityKey: "agg-2" });
  assert.equal(loaded.revision, 1);
});

test("1F persistence: concurrent claim conflicts", async () => {
  const port = createInMemoryLineupPersistenceTransactionPort();
  const claim = {
    idempotencyKey: "race",
    aggregateIdentity: "agg",
    commandType: "submit",
    canonicalPayloadFingerprint: "fp",
    expectedVersion: 1,
  };
  const a = await port.claimIdempotency(claim);
  const b = await port.claimIdempotency(claim);
  assert.equal(a.claimed, true);
  assert.equal(b.conflict, true);
});

test("1F persistence: release clears pending claim", async () => {
  const port = createInMemoryLineupPersistenceTransactionPort();
  await port.claimIdempotency({
    idempotencyKey: "rel-1",
    aggregateIdentity: "agg",
    commandType: "submit",
    canonicalPayloadFingerprint: "fp",
  });
  assert.equal(await port.releaseIdempotency({ idempotencyKey: "rel-1" }), true);
  const again = await port.claimIdempotency({
    idempotencyKey: "rel-1",
    aggregateIdentity: "agg",
    commandType: "submit",
    canonicalPayloadFingerprint: "fp",
  });
  assert.equal(again.claimed, true);
});

// ---------- Shadow ----------

test("1F shadow: matching dimensions classify MATCH", () => {
  const cmp = compareLineupShadowResults({
    legacy: {
      aggregateIdentity: "a",
      lineupSlots: [],
      participantAssignments: [],
      lifecycleStatus: "LOCKED",
      lockState: true,
      visibilityState: "PRIVATE",
      revealEligibility: false,
      version: 2,
      deadlineOutcome: "LOCKED",
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "lock",
    },
    canonical: {
      aggregateIdentity: "a",
      lineupSlots: [],
      participantAssignments: [],
      lifecycleStatus: "LOCKED",
      lockState: true,
      visibilityState: "PRIVATE",
      revealEligibility: false,
      version: 2,
      deadlineOutcome: "LOCKED",
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "lock",
    },
  });
  assert.equal(cmp.hasBlockingDifference, false);
  assert.ok(cmp.totals.matched >= 10);
});

test("1F shadow: visibility difference is accepted by default", () => {
  const cmp = compareLineupShadowResults({
    legacy: {
      aggregateIdentity: "a",
      lineupSlots: null,
      participantAssignments: null,
      lifecycleStatus: "PUBLISHED",
      lockState: false,
      visibilityState: null,
      revealEligibility: null,
      version: 1,
      deadlineOutcome: null,
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "publish",
    },
    canonical: {
      aggregateIdentity: "a",
      lineupSlots: null,
      participantAssignments: null,
      lifecycleStatus: "PUBLISHED",
      lockState: false,
      visibilityState: "PUBLIC",
      revealEligibility: true,
      version: 1,
      deadlineOutcome: null,
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "publish",
    },
  });
  assert.equal(cmp.hasBlockingDifference, false);
  assert.ok(cmp.totals.acceptedDifferences >= 1);
});

test("1F shadow: version mismatch is blocking", () => {
  const cmp = compareLineupShadowResults({
    legacy: {
      aggregateIdentity: "a",
      lineupSlots: null,
      participantAssignments: null,
      lifecycleStatus: "DRAFT",
      lockState: false,
      visibilityState: "PRIVATE",
      revealEligibility: false,
      version: 1,
      deadlineOutcome: null,
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "create",
    },
    canonical: {
      aggregateIdentity: "a",
      lineupSlots: null,
      participantAssignments: null,
      lifecycleStatus: "DRAFT",
      lockState: false,
      visibilityState: "PRIVATE",
      revealEligibility: false,
      version: 9,
      deadlineOutcome: null,
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "create",
    },
  });
  assert.equal(cmp.hasBlockingDifference, true);
});

// ---------- Parity catalog ----------

test("1F parity: catalog has at least 25 scenarios", () => {
  assert.ok(LINEUP_PARITY_SCENARIOS.length >= 25);
});

test("1F parity: summary has zero blocking differences", () => {
  const summary = summarizeParityCatalog();
  assert.equal(summary.blockingDifferences, 0);
  assert.equal(summary.total, LINEUP_PARITY_SCENARIOS.length);
  assert.ok(summary.matched + summary.acceptedDifferences + summary.insufficientData === summary.total);
});

test("1F parity: each scenario has required fields", () => {
  for (const s of LINEUP_PARITY_SCENARIOS) {
    assert.ok(s.id && s.title && s.expectedCanonicalBehavior);
    assert.ok(s.expectedLegacyBehavior && s.parityClassification && s.rationale);
  }
});

// ---------- Certification ----------

test("1F certification: report certifies for adapter implementation", () => {
  const report = certifyCore06Phase1F();
  assert.equal(report.capability, "CORE-06");
  assert.equal(report.phase, "1F");
  assert.equal(report.productionWiring, LINEUP_CERT_AXIS.NOT_PERFORMED);
  assert.equal(report.adapterBoundary, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.legacyMapping, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.canonicalMapping, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.persistenceContract, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.concurrencyReadiness, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.idempotencyReadiness, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.visibilityReadiness, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.deadlineReadiness, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.auditReadiness, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.capabilityReadiness, LINEUP_CERT_AXIS.PASS);
  assert.equal(report.adapterImplementationReadiness, LINEUP_CERT_AXIS.PASS);
  assert.equal(
    report.shadowReadiness,
    LINEUP_CERT_AXIS.PASS_WITH_KNOWN_DIFFERENCES
  );
  assert.equal(
    report.writerCutoverReadiness,
    LINEUP_CERT_AXIS.BLOCKED_PENDING_RNG_DECISION
  );
  assert.equal(report.legacyRetirementReadiness, LINEUP_CERT_AXIS.BLOCKED);
  assert.equal(report.parityScenarios.blockingDifferences, 0);
  assert.equal(
    report.parityScenarios.total,
    report.parityScenarios.matched +
      report.parityScenarios.acceptedDifferences +
      report.parityScenarios.insufficientData +
      report.parityScenarios.blockingDifferences
  );
  assert.equal(report.details.rngParityClass, "SEMANTIC_ONLY");
  assert.equal(
    report.finalVerdict,
    LINEUP_CERTIFICATION_VERDICT.CERTIFIED_FOR_ADAPTER_IMPLEMENTATION
  );
});

test("1F certification: blocking parity forces BLOCKED verdict via factory path", () => {
  const blocked = createLineupCertificationReport({
    adapterBoundary: LINEUP_CERT_AXIS.PASS,
    legacyMapping: LINEUP_CERT_AXIS.PASS,
    canonicalMapping: LINEUP_CERT_AXIS.PASS,
    persistenceContract: LINEUP_CERT_AXIS.PASS,
    concurrencyReadiness: LINEUP_CERT_AXIS.PASS,
    idempotencyReadiness: LINEUP_CERT_AXIS.PASS,
    visibilityReadiness: LINEUP_CERT_AXIS.PASS,
    deadlineReadiness: LINEUP_CERT_AXIS.PASS,
    auditReadiness: LINEUP_CERT_AXIS.PASS,
    parityScenarios: {
      total: 1,
      matched: 0,
      acceptedDifferences: 0,
      blockingDifferences: 1,
      insufficientData: 0,
    },
  });
  assert.equal(blocked.finalVerdict, LINEUP_CERTIFICATION_VERDICT.BLOCKED);
});

// ---------- Security ----------

test("1F security: default hardening denies locked correction", () => {
  assert.equal(createDefaultLineupHardeningPolicy().allowsLockedCorrection(), false);
});

test("1F security: projection rejects cross-tenant", () => {
  const proj = projectLineupForViewer({
    lineup: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      teamId: "team-1",
      visibilityState: LINEUP_VISIBILITY_STATE.PUBLIC,
      slots: [],
    },
    relationship: "PUBLIC",
    viewerScope: { tenantId: "other", competitionId: "comp-1", role: "PUBLIC" },
    competitionScope: { tenantId: "other", competitionId: "comp-1" },
    revealState: { authorized: true, ready: true },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
});

test("1F security: OWN_TEAM mismatch fails closed", () => {
  const proj = projectLineupForViewer({
    lineup: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      teamId: "team-1",
      visibilityState: LINEUP_VISIBILITY_STATE.TEAM_VISIBLE,
      slots: [{ person: { id: "x" } }],
    },
    relationship: "OWN_TEAM",
    viewerScope: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      teamId: "team-9",
      role: "CAPTAIN",
    },
    competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
    evaluatedAt: FIXED_NOW,
  });
  assert.equal(proj.visible, false);
  assert.equal(JSON.stringify(proj).includes('"id":"x"'), false);
});

test("1F security: adapter cannot authorize by role alone", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ actorRole: "BTC", correctionAuthorized: false, reason: "x" })
  );
  assert.equal(mapped.value.command.correctionAuthorized, false);
});

// ---------- Architecture ----------

test("1F architecture: Phase 1F modules do not import Team Tournament", () => {
  const dirs = [
    path.join(LINEUPS_ROOT, "adapters"),
    path.join(LINEUPS_ROOT, "persistence"),
    path.join(LINEUPS_ROOT, "shadow"),
    path.join(LINEUPS_ROOT, "certification"),
    path.join(LINEUPS_ROOT, "contracts/lineupFormatAdapter.js"),
    path.join(LINEUPS_ROOT, "contracts/persistenceTransaction.js"),
    path.join(LINEUPS_ROOT, "contracts/shadowComparison.js"),
    path.join(LINEUPS_ROOT, "contracts/certificationReport.js"),
    path.join(LINEUPS_ROOT, "contracts/mappingResult.js"),
  ];
  for (const entry of dirs) {
    const files = entry.endsWith(".js") ? [entry] : listJsFiles(entry);
    for (const file of files) {
      if (file.includes("LegacyLineupAdapter")) continue;
      const text = readFileSync(file, "utf8");
      assert.equal(
        text.includes("features/team-tournament"),
        false,
        file
      );
    }
  }
});

test("1F architecture: no Production wiring of certification or fixture adapter", () => {
  const roots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/features/team-tournament"),
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of listJsFiles(root)) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("certifyCore06Phase1F"), false, file);
      assert.equal(text.includes("createFixtureLineupFormatAdapter"), false, file);
      assert.equal(
        text.includes("mapTeamTournamentLineupInputToCanonical"),
        false,
        file
      );
    }
  }
});

test("1F architecture: docs exist", () => {
  const doc = path.join(
    ROOT,
    "docs/competition-engine/core-06/12_PHASE_1F_ADAPTER_CERTIFICATION.md"
  );
  assert.ok(existsSync(doc));
  const text = readFileSync(doc, "utf8");
  assert.match(text, /Adapter boundary/);
  assert.match(text, /Cutover stages/);
  assert.match(text, /Rollback requirements/);
  assert.match(text, /writerCutoverReadiness/);
  assert.match(text, /does not mean Team Tournament V6 has been replaced/i);
});

// ---------- Static safety ----------

test("1F safety: no Date.now / Math.random / SQL / dual-write in Phase 1F modules", () => {
  const dirs = [
    path.join(LINEUPS_ROOT, "adapters/mapTeamTournamentInput.js"),
    path.join(LINEUPS_ROOT, "adapters/mapCanonicalToTeamTournament.js"),
    path.join(LINEUPS_ROOT, "adapters/createFixtureLineupFormatAdapter.js"),
    path.join(LINEUPS_ROOT, "adapters/teamTournamentCompatibility.js"),
    path.join(LINEUPS_ROOT, "persistence"),
    path.join(LINEUPS_ROOT, "shadow"),
    path.join(LINEUPS_ROOT, "certification"),
    path.join(LINEUPS_ROOT, "integration"),
    path.join(LINEUPS_ROOT, "contracts/acceptedDifferences.js"),
  ];
  for (const entry of dirs) {
    const files = entry.endsWith(".js") ? [entry] : listJsFiles(entry);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(/Date\.now\s*\(/.test(text), false, file);
      assert.equal(/new\s+Date\s*\(\s*\)/.test(text), false, file);
      assert.equal(/Math\.random\s*\(/.test(text), false, file);
      assert.equal(/localeCompare\s*\(/.test(text), false, file);
      assert.equal(/service_role|Bearer\s|dual-write|supabase\.from/i.test(text), false, file);
    }
  }
});

// ---------- Targeted re-verification ----------

test("1F export boundary: main barrel does not expose fixture/TT/in-memory/parity", () => {
  const forbidden = [
    "createFixtureLineupFormatAdapter",
    "mapTeamTournamentLineupInputToCanonical",
    "mapCanonicalLineupResultToTeamTournament",
    "TT_CORE06_COMPATIBILITY_MATRIX",
    "createInMemoryLineupPersistenceTransactionPort",
    "LINEUP_PARITY_SCENARIOS",
    "LINEUP_PERSISTENCE_TX_IMPL_KIND",
  ];
  for (const name of forbidden) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(lineupsPublic, name),
      false,
      name
    );
  }
  assert.equal(typeof lineupsPublic.isLineupFormatAdapter, "function");
  assert.equal(typeof lineupsPublic.certifyCore06Phase1F, "function");
  assert.equal(typeof lineupsPublic.compareLineupShadowResults, "function");
  assert.equal(typeof lineupsPublic.matchesLineupPersistenceTransactionPort, "function");
});

test("1F export boundary: fixture adapter is TEST_ONLY via integration path", () => {
  const adapter = createFixtureLineupFormatAdapter();
  assert.equal(isLineupFormatAdapter(adapter), true);
  assert.equal(LINEUP_PERSISTENCE_TX_IMPL_KIND, "TEST_ONLY_IN_MEMORY");
});

test("1F accepted differences: allowlist has exactly 8 codes", () => {
  assert.equal(Object.keys(LINEUP_ACCEPTED_DIFFERENCE_CODE).length, 8);
  assert.equal(Object.keys(LINEUP_ACCEPTED_DIFFERENCE_REGISTRY).length, 8);
  for (const code of Object.values(LINEUP_ACCEPTED_DIFFERENCE_CODE)) {
    assert.equal(isLineupAcceptedDifferenceCode(code), true);
    assert.ok(LINEUP_ACCEPTED_DIFFERENCE_REGISTRY[code]);
  }
});

test("1F accepted differences: unknown code cannot silently become ACCEPTED", () => {
  assert.equal(isLineupAcceptedDifferenceCode("MADE_UP_DIFF"), false);
  const cmp = compareLineupShadowResults({
    legacy: {
      aggregateIdentity: "a",
      lineupSlots: ["x"],
      participantAssignments: null,
      lifecycleStatus: "DRAFT",
      lockState: false,
      visibilityState: "PRIVATE",
      revealEligibility: false,
      version: 1,
      deadlineOutcome: null,
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "create",
    },
    canonical: {
      aggregateIdentity: "a",
      lineupSlots: ["y"],
      participantAssignments: null,
      lifecycleStatus: "DRAFT",
      lockState: false,
      visibilityState: "PRIVATE",
      revealEligibility: false,
      version: 1,
      deadlineOutcome: null,
      randomFallbackResult: null,
      reasonOrErrorCode: null,
      auditCommandType: "create",
    },
    accepted: { lineupSlots: "CALLER_SAYS_OK" },
  });
  assert.equal(cmp.hasBlockingDifference, true);
  const dim = cmp.dimensions.find((d) => d.dimension === "lineupSlots");
  assert.equal(
    dim.classification,
    LINEUP_SHADOW_CLASSIFICATION.BLOCKING_DIFFERENCE
  );
});

test("1F parity: unknown accepted differenceCode fails catalog validation", () => {
  const bad = [
    {
      id: "BAD1",
      title: "bad",
      expectedLegacyBehavior: "x",
      expectedCanonicalBehavior: "y",
      parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
      differenceCode: "NOT_ALLOWLISTED",
      rationale: "caller label",
    },
  ];
  const validation = validateParityCatalog(bad);
  assert.equal(validation.ok, false);
  assert.ok(
    validation.issues.some((i) => i.code === "UNKNOWN_ACCEPTED_DIFFERENCE")
  );
  const summary = summarizeParityCatalog(bad);
  assert.ok(summary.blockingDifferences >= 1);
});

test("1F parity: duplicate scenario IDs are rejected", () => {
  const dup = [
    {
      id: "P1",
      title: "a",
      expectedLegacyBehavior: "x",
      expectedCanonicalBehavior: "y",
      parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
      rationale: "ok",
    },
    {
      id: "P1",
      title: "b",
      expectedLegacyBehavior: "x",
      expectedCanonicalBehavior: "y",
      parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
      rationale: "dup",
    },
  ];
  const validation = validateParityCatalog(dup);
  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((i) => i.code === "DUPLICATE_SCENARIO_ID"));
  const report = certifyCore06Phase1F({ scenarios: dup });
  assert.equal(report.finalVerdict, LINEUP_CERTIFICATION_VERDICT.BLOCKED);
});

test("1F certification: zero-scenario catalog cannot pass", () => {
  const report = certifyCore06Phase1F({ scenarios: [] });
  assert.equal(report.finalVerdict, LINEUP_CERTIFICATION_VERDICT.BLOCKED);
  assert.equal(report.capabilityReadiness, LINEUP_CERT_AXIS.FAIL);
});

test("1F certification: writer cutover blocked by unresolved RNG parity", () => {
  const report = certifyCore06Phase1F();
  assert.equal(
    report.writerCutoverReadiness,
    LINEUP_CERT_AXIS.BLOCKED_PENDING_RNG_DECISION
  );
  assert.equal(
    report.details.rngDifferenceCode,
    LINEUP_ACCEPTED_DIFFERENCE_CODE.RNG_SEMANTIC_ONLY
  );
  assert.notEqual(
    report.finalVerdict,
    "READY_FOR_CANONICAL_WRITER_CUTOVER"
  );
});

test("1F tenant: mapper requires explicit tenantId and never invents one", () => {
  const missing = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ tenantId: "" })
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_SCOPE_REQUIRED);
  const roleOnly = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ tenantId: undefined, actorRole: "DIRECTOR" })
  );
  assert.equal(roleOnly.ok, false);
});

test("1F reveal: eligibility does not force visibility transition", () => {
  const mapped = mapTeamTournamentLineupInputToCanonical(
    baseFixture({ status: "submitted", revealEligible: true })
  );
  assert.equal(mapped.ok, true);
  assert.equal(mapped.value.status, "SUBMITTED");
  assert.equal(mapped.value.visibilityState, LINEUP_VISIBILITY_STATE.PRIVATE);
  assert.equal(mapped.value.revealEligible, true);

  const out = mapCanonicalLineupResultToTeamTournament({
    ok: true,
    value: {
      status: "SUBMITTED",
      revision: 1,
      visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
      slots: [{ person: { id: "secret" } }],
    },
    details: { revealEligible: true, mutationPhase: "OPEN", revealPhase: null },
  });
  assert.equal(out.value.revealEligible, true);
  assert.equal(out.value.visibilityState, LINEUP_VISIBILITY_STATE.PRIVATE);
  assert.equal(out.value.selections, null);
});
