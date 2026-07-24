/**
 * E2E-06 — Governance & Reliability Runtime targeted tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  COMPETITION_ENGINE_GOVERNANCE_RELIABILITY,
  DEGRADED_CONTINUATION,
  GOVERNANCE_ERROR_CODE,
  LIFECYCLE_PROJECTION,
  RELIABILITY_ISSUE_CODE,
  RUNTIME_HEALTH_STATE,
  buildGovernanceReliabilitySections,
  createCompetitionGovernanceReliabilityFacade,
  createCompetitionRuntimePorts,
  isGovernanceReliabilityError,
  snapshotInput,
} from "../src/features/competition-engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OWNED = path.join(
  ROOT,
  "src/features/competition-engine/operations/governance"
);

function actor(role = "TOURNAMENT_MANAGER", actorId = "gov-1") {
  return { actorId, role };
}

function readyRecord(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-e2e06",
    definition: {
      version: "def-1",
      ruleSetVersion: "rules-v1",
      configurationFingerprint: "cfg-1",
    },
    publication: {
      state: "OPERATIONAL_PLAN_PUBLISHED",
      revision: "pub-1",
      consistent: true,
      ready: true,
    },
    lifecycle: {
      state: LIFECYCLE_PROJECTION.ACTIVE,
      revision: "life-1",
      consistent: true,
    },
    workflow: { status: "RUNNING", revision: "wf-1", consistent: true },
    participantLock: { locked: true, required: false },
    scheduleCourt: { certified: true, required: false },
    checkIn: { ready: true },
    refereeAssignment: { ready: true },
    scoring: { ready: true, required: false },
    resultValidation: { ready: true, revision: "rv-1" },
    standings: { ready: true, fingerprint: "stand-1", required: false },
    qualification: { ready: true, required: false },
    finalResult: { ready: false, required: false },
    archive: { ready: false },
    audit: { evidencePresent: true, required: true },
    replay: {
      seed: "seed-e2e06",
      sourceFingerprint: "src-fp-1",
      target: "pool-knockout",
      required: false,
    },
    importExport: {
      ready: true,
      schemaVersion: "core22-v1",
      exportChecksum: "export-checksum-1",
      importChecksum: "import-checksum-1",
    },
    recovery: {
      checkpointPresent: true,
      checkpointFingerprint: "cp-1",
      required: false,
    },
    publicVisibility: { ready: true },
    dependencies: {
      identity: "AVAILABLE",
      workflow: "AVAILABLE",
      audit: "AVAILABLE",
      replay: "AVAILABLE",
      recovery: "AVAILABLE",
      recoveryCheckpoint: "AVAILABLE",
      ratingSnapshot: "AVAILABLE",
      venueCourt: "AVAILABLE",
      auditPersistence: "AVAILABLE",
      publicProjection: "AVAILABLE",
      importExport: "AVAILABLE",
    },
    evidenceRefs: ["ev-1"],
    ...overrides,
  };
}

function baseQuery(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-e2e06",
    actor: actor(),
    governanceRecord: readyRecord(),
    ...overrides,
  };
}

function createFacade(overrides = {}) {
  const ports =
    overrides.runtimePorts ||
    createCompetitionRuntimePorts({
      identity: {
        getPermissionsForRole: (role) => {
          const normalized = String(role || "").toUpperCase();
          if (
            normalized === "CASHIER" ||
            normalized === "UNKNOWN" ||
            normalized === "PLAYER"
          ) {
            return normalized === "PLAYER" ? [PERMISSIONS.TOURNAMENT_VIEW] : [];
          }
          return [
            PERMISSIONS.TOURNAMENT_VIEW,
            PERMISSIONS.TOURNAMENT_UPDATE,
            PERMISSIONS.DIRECTOR_USE,
            PERMISSIONS.MATCH_UPDATE,
            PERMISSIONS.SCHEDULING_RUN,
            PERMISSIONS.TOURNAMENT_CERTIFY,
          ];
        },
      },
      ...(overrides.runtimePortDeps || {}),
    });
  return createCompetitionGovernanceReliabilityFacade({
    runtimePorts: ports,
    ...overrides,
  });
}

test("marker — governance reliability facade metadata", () => {
  assert.equal(COMPETITION_ENGINE_GOVERNANCE_RELIABILITY.phase, "E2E-06");
  assert.equal(
    COMPETITION_ENGINE_GOVERNANCE_RELIABILITY.wiredToProductionRuntime,
    false
  );
  assert.equal(COMPETITION_ENGINE_GOVERNANCE_RELIABILITY.ownsEngines, false);
});

test("facade — valid tenant/competition + deterministic + immutable input", async () => {
  const facade = createFacade();
  const query = baseQuery();
  const before = snapshotInput(query);
  const a = await facade.getGovernanceState(query);
  const b = await facade.getGovernanceState(query);
  assert.equal(a.ok, true);
  assert.equal(a.result.healthState, RUNTIME_HEALTH_STATE.READY);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(query, before);
});

test("facade — missing tenant / competition / identity / permission / client grants / cross-tenant", async () => {
  const facade = createFacade();

  await assert.rejects(
    () => facade.getGovernanceState(baseQuery({ tenantId: "" })),
    (err) =>
      isGovernanceReliabilityError(err) &&
      err.code === GOVERNANCE_ERROR_CODE.MISSING_TENANT
  );

  await assert.rejects(
    () => facade.getGovernanceState(baseQuery({ competitionId: "" })),
    (err) =>
      isGovernanceReliabilityError(err) &&
      err.code === GOVERNANCE_ERROR_CODE.MISSING_COMPETITION
  );

  await assert.rejects(
    () =>
      facade.getGovernanceState(
        baseQuery({ actor: { role: "TOURNAMENT_MANAGER" } })
      ),
    (err) =>
      isGovernanceReliabilityError(err) &&
      err.code === GOVERNANCE_ERROR_CODE.MISSING_IDENTITY
  );

  await assert.rejects(
    () =>
      facade.getGovernanceState(
        baseQuery({ actor: actor("CASHIER", "cash-1") })
      ),
    (err) =>
      isGovernanceReliabilityError(err) &&
      err.code === GOVERNANCE_ERROR_CODE.PERMISSION_DENIED
  );

  await assert.rejects(
    () =>
      facade.getGovernanceState(
        baseQuery({
          actor: {
            actorId: "gov-1",
            role: "TOURNAMENT_MANAGER",
            grantedPermissions: [PERMISSIONS.TOURNAMENT_VIEW],
          },
        })
      ),
    (err) =>
      isGovernanceReliabilityError(err) &&
      err.code === GOVERNANCE_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED
  );

  await assert.rejects(
    () =>
      facade.getGovernanceState(
        baseQuery({
          governanceRecord: readyRecord({ tenantId: "other-tenant" }),
        })
      ),
    (err) =>
      isGovernanceReliabilityError(err) &&
      err.code === GOVERNANCE_ERROR_CODE.CROSS_TENANT_REJECTED
  );
});

test("reliability policy — READY / DEGRADED / BLOCKED / SUSPENDED / RECOVERING", async () => {
  const facade = createFacade();

  const ready = await facade.evaluateOperationReadiness(baseQuery());
  assert.equal(ready.result.healthState, RUNTIME_HEALTH_STATE.READY);

  const degraded = await facade.createDegradedModeProjection(
    baseQuery({
      governanceRecord: readyRecord({
        dependencies: {
          ...readyRecord().dependencies,
          ratingSnapshot: "UNAVAILABLE",
        },
      }),
    })
  );
  assert.equal(degraded.result.active, true);
  assert.equal(
    degraded.result.primaryContinuation,
    DEGRADED_CONTINUATION.CONTINUE_SAFE
  );
  assert.equal(degraded.result.silentSuccessForbidden, true);

  const blocked = await facade.evaluateOperationReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        audit: { evidencePresent: false, required: true },
      }),
    })
  );
  assert.equal(blocked.result.blocked, true);
  assert.equal(blocked.result.healthState, RUNTIME_HEALTH_STATE.BLOCKED);
  assert.ok(
    blocked.result.blockingIssues.some(
      (i) => i.code === RELIABILITY_ISSUE_CODE.AUDIT_EVIDENCE_MISSING
    )
  );

  const suspended = await facade.getGovernanceState(
    baseQuery({
      governanceRecord: readyRecord({
        lifecycle: {
          state: LIFECYCLE_PROJECTION.SUSPENDED,
          revision: "life-s",
          consistent: true,
        },
      }),
    })
  );
  assert.equal(suspended.result.healthState, RUNTIME_HEALTH_STATE.SUSPENDED);

  const recovering = await facade.getGovernanceState(
    baseQuery({
      governanceRecord: readyRecord({
        recovery: {
          checkpointPresent: true,
          checkpointFingerprint: "cp-1",
          inProgress: true,
        },
      }),
    })
  );
  assert.equal(recovering.result.healthState, RUNTIME_HEALTH_STATE.RECOVERING);
});

test("audit evidence — deterministic manifest, secrets excluded, no persistence", async () => {
  const facade = createFacade();
  const query = baseQuery({
    governanceRecord: readyRecord({
      secret: "do-not-leak",
      accessToken: "tok",
    }),
    operation: "governance.evidence.build",
    occurredAt: "2026-07-24T00:00:00.000Z",
    sequence: 3,
  });
  const a = await facade.buildReliabilityEvidence(query);
  const b = await facade.buildReliabilityEvidence(query);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.result.persistenceSideEffect, false);
  assert.equal(a.result.ownsAuditStorage, false);
  assert.equal(a.result.tenantId, "tenant-1");
  assert.equal(a.result.competitionId, "comp-e2e06");
  assert.equal(a.result.actor.actorId, "gov-1");
  const json = JSON.stringify(a.result);
  assert.equal(json.includes("do-not-leak"), false);
  assert.equal(json.includes("accessToken"), false);
  assert.ok(a.result.auditHandoff?.contentFingerprint);
});

test("replay — seed required, same plan, reorder stable, conflict blocked", async () => {
  const facade = createFacade();
  const eventsA = [
    { eventId: "e2", payload: 2 },
    { eventId: "e1", payload: 1 },
  ];
  const eventsB = [
    { eventId: "e1", payload: 1 },
    { eventId: "e2", payload: 2 },
  ];

  const missing = await facade.evaluateReplayReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        replay: { seed: null, required: true },
      }),
      seed: "",
    })
  );
  assert.equal(missing.result.ready, false);
  assert.ok(
    missing.result.issues.some(
      (i) => i.code === RELIABILITY_ISSUE_CODE.REPLAY_SEED_MISSING
    )
  );

  const planA = await facade.evaluateReplayReadiness(
    baseQuery({ events: eventsA })
  );
  const planB = await facade.evaluateReplayReadiness(
    baseQuery({ events: eventsB })
  );
  assert.equal(planA.result.ready, true);
  assert.equal(planA.result.planFingerprint, planB.result.planFingerprint);
  assert.deepEqual(planA.result.canonicalEventOrder, ["e1", "e2"]);
  assert.equal(planA.result.ownsReplayEngine, false);

  const conflict = await facade.evaluateReplayReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        replay: {
          seed: "seed-e2e06",
          lineageConflict: true,
        },
      }),
    })
  );
  assert.equal(conflict.result.ready, false);
  assert.ok(
    conflict.result.issues.some(
      (i) => i.code === RELIABILITY_ISSUE_CODE.REPLAY_LINEAGE_CONFLICT
    )
  );
});

test("import/export — checksum, schema, duplicate, dry-run, private fields, cross-tenant", async () => {
  const facade = createFacade();

  const missingChecksum = await facade.evaluateImportReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        importExport: { ready: true, schemaVersion: "core22-v1" },
      }),
      checksum: "",
    })
  );
  assert.equal(missingChecksum.result.ready, false);
  assert.ok(
    missingChecksum.result.issues.some(
      (i) => i.code === RELIABILITY_ISSUE_CODE.IMPORT_CHECKSUM_MISSING
    )
  );

  const schema = await facade.evaluateImportReadiness(
    baseQuery({
      checksum: "abc",
      packageSchemaVersion: "other-v9",
      expectedSchemaVersion: "core22-v1",
    })
  );
  assert.equal(schema.result.ready, false);
  assert.ok(
    schema.result.issues.some(
      (i) => i.code === RELIABILITY_ISSUE_CODE.IMPORT_SCHEMA_MISMATCH
    )
  );

  const dup = await facade.evaluateImportReadiness(
    baseQuery({ checksum: "abc", duplicateIdentity: true })
  );
  assert.equal(dup.result.ready, false);

  const okImport = await facade.evaluateImportReadiness(
    baseQuery({ checksum: "abc", dryRun: true })
  );
  assert.equal(okImport.result.ready, true);
  assert.equal(okImport.result.dryRun, true);

  const cross = await facade.evaluateImportReadiness(
    baseQuery({ checksum: "abc", packageTenantId: "other" })
  );
  assert.equal(cross.result.ready, false);

  const exportOk = await facade.evaluateExportReadiness(baseQuery());
  const exportOk2 = await facade.evaluateExportReadiness(baseQuery());
  assert.equal(exportOk.result.ready, true);
  assert.equal(exportOk.result.fingerprint, exportOk2.result.fingerprint);
  assert.equal(exportOk.result.privateFieldsExcluded, true);

  const exportPublicRisk = await facade.evaluateExportReadiness(
    baseQuery({
      visibilityScope: "PUBLIC",
      privateFields: ["email"],
    })
  );
  assert.equal(exportPublicRisk.result.ready, false);
});

test("recovery — checkpoint, authority, conflict, no mutation / no direct match resume", async () => {
  const facade = createFacade();

  const missing = await facade.evaluateRecoveryReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        recovery: { checkpointPresent: false },
      }),
    })
  );
  assert.equal(missing.result.ready, false);
  assert.equal(missing.result.mutatesState, false);
  assert.equal(missing.result.directMatchResume, false);

  const conflict = await facade.evaluateRecoveryReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        recovery: { checkpointPresent: true, conflict: true },
      }),
    })
  );
  assert.equal(conflict.result.ready, false);

  const ok = await facade.evaluateRecoveryReadiness(
    baseQuery({
      resumeTarget: "workflow:resume",
      idempotencyKey: "idem-1",
      reason: "interrupt",
    })
  );
  assert.equal(ok.result.ready, true);
  assert.equal(ok.result.idempotent, true);
  assert.equal(ok.result.core23Handoff, true);

  // Player lacks elevated recovery permissions.
  await assert.rejects(
    () =>
      facade.evaluateRecoveryReadiness(
        baseQuery({ actor: actor("PLAYER", "p-1") })
      ),
    (err) =>
      isGovernanceReliabilityError(err) &&
      err.code === GOVERNANCE_ERROR_CODE.PERMISSION_DENIED
  );
});

test("archive/completion — ACTIVE blocked, COMPLETED ready, CANCELLED path, no purge", async () => {
  const facade = createFacade();

  const active = await facade.evaluateArchiveReadiness(baseQuery());
  assert.equal(active.result.ready, false);
  assert.ok(
    active.result.issues.some(
      (i) => i.code === RELIABILITY_ISSUE_CODE.ARCHIVE_ACTIVE_BLOCKED
    )
  );
  assert.equal(active.result.deleteOrPurge, false);
  assert.equal(active.result.mutatesArchive, false);

  const completed = await facade.evaluateArchiveReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        lifecycle: {
          state: LIFECYCLE_PROJECTION.COMPLETED,
          revision: "life-c",
          consistent: true,
        },
        finalResult: { ready: true },
        audit: { evidencePresent: true },
      }),
    })
  );
  assert.equal(completed.result.ready, true);

  const cancelled = await facade.evaluateCompletionReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        lifecycle: {
          state: LIFECYCLE_PROJECTION.CANCELLED,
          revision: "life-x",
          consistent: true,
        },
      }),
    })
  );
  assert.equal(cancelled.result.ready, true);
  assert.equal(cancelled.result.path, "CANCELLED");

  const suspendedArchive = await facade.evaluateArchiveReadiness(
    baseQuery({
      governanceRecord: readyRecord({
        lifecycle: {
          state: LIFECYCLE_PROJECTION.SUSPENDED,
          revision: "life-s",
          consistent: true,
        },
      }),
    })
  );
  assert.equal(suspendedArchive.result.ready, false);
});

test("presentation — governance sections view-model", async () => {
  const facade = createFacade();
  const state = await facade.getGovernanceState(baseQuery());
  const sections = buildGovernanceReliabilitySections(state.result);
  assert.equal(sections.length, 15);
  assert.equal(sections[0].id, "overall-health");
  assert.equal(sections[sections.length - 1].id, "recommended-actions");
});

test("certification readiness — e2e07 projection without production claim", async () => {
  const facade = createFacade();
  const cert = await facade.createCertificationReadinessProjection(baseQuery());
  assert.equal(cert.result.productionReadyClaimForbidden, true);
  assert.ok(Array.isArray(cert.result.deferredToE2E07));
  assert.ok(
    cert.result.deferredCapabilities.some((c) => c.id === "OPS-11")
  );
});

test("architecture — no supabase / Date.now / Math.random / parallel engines in owned boundary", () => {
  /** @type {string[]} */
  const files = [];
  /**
   * @param {string} dir
   */
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  }
  walk(OWNED);

  const banned = [
    /@supabase/,
    /Date\.now\s*\(/,
    /Math\.random\s*\(/,
    /randomUUID\s*\(/,
    /from\s+["'].*operations\/organizer/,
    /from\s+["'].*operations\/player/,
    /from\s+["'].*operations\/referee/,
    /from\s+["'].*operations\/public/,
    /from\s+["'].*presentation\/organizer/,
    /from\s+["'].*presentation\/player/,
    /from\s+["'].*presentation\/referee/,
    /from\s+["'].*presentation\/public/,
  ];

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const pattern of banned) {
      assert.equal(
        pattern.test(src),
        false,
        `${path.relative(ROOT, file)} matched ${pattern}`
      );
    }
  }
});

test("incident projection — competition-scoped, not platform incident owner", async () => {
  const facade = createFacade();
  const incident = await facade.createIncidentProjection(
    baseQuery({
      governanceRecord: readyRecord({
        audit: { evidencePresent: false, required: true },
      }),
    })
  );
  assert.equal(incident.result.ownsPlatformIncidentManagement, false);
  assert.equal(incident.result.platformOwner, "platform-governance-operations");
  assert.ok(incident.result.count >= 1);
});
