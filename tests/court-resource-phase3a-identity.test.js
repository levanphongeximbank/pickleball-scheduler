import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createCanonicalPhysicalCourt,
  updateCanonicalPhysicalCourt,
} from "../src/features/court-resource/contracts/canonicalPhysicalCourt.js";
import {
  evaluateClubOperationalAccess,
} from "../src/features/court-resource/contracts/clubOperationalAccess.js";
import {
  normalizeLegacyCourtIdentityMapping,
  resolveLegacyCourtIdentity,
} from "../src/features/court-resource/contracts/legacyCourtIdentityMapping.js";
import {
  reconcileClusterIdentity,
} from "../src/features/court-resource/services/clusterIdentityReconciliation.js";
import {
  runPhysicalCourtMigrationDryRun,
} from "../src/features/court-resource/services/physicalCourtMigrationDryRun.js";
import {
  projectCanonicalCourtToLegacy,
} from "../src/features/court-resource/services/legacyCourtCompatibilityProjection.js";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const baseCourt = {
  physicalCourtId: ID_A,
  tenantId: "tenant-a",
  clusterId: "cluster-a",
  displayName: "Sân 1",
  displayNumber: "1",
};
const key = {
  tenantId: "tenant-a",
  clubId: "club-a",
  sourceSystem: "club-data-v3",
  sourceVersion: "3",
  legacyClusterId: "legacy-cluster-a",
  legacyCourtId: "court-1",
};
const deterministicMapping = {
  ...key,
  classification: "deterministic",
  physicalCourtId: ID_A,
};

test("same labels at distinct facilities remain distinct physical identities", () => {
  const a = createCanonicalPhysicalCourt(baseCourt);
  const b = createCanonicalPhysicalCourt({
    ...baseCourt,
    physicalCourtId: ID_B,
    clusterId: "cluster-b",
  });
  assert.equal(a.displayName, b.displayName);
  assert.notEqual(a.physicalCourtId, b.physicalCourtId);
});

test("rename preserves UUID and immutable identity rejects reassignment", () => {
  const renamed = updateCanonicalPhysicalCourt(baseCourt, { displayName: "Centre Court" });
  assert.equal(renamed.physicalCourtId, ID_A);
  assert.equal(renamed.displayName, "Centre Court");
  assert.throws(
    () => updateCanonicalPhysicalCourt(baseCourt, { clusterId: "cluster-b" }),
    /immutable/
  );
});

test("one court can be shared by clubs A and B while subsets remain independent", () => {
  const access = [
    { tenantId: "tenant-a", clubId: "club-a", physicalCourtId: ID_A, status: "enabled" },
    { tenantId: "tenant-a", clubId: "club-b", physicalCourtId: ID_A, status: "enabled" },
    { tenantId: "tenant-a", clubId: "club-a", physicalCourtId: ID_B, status: "disabled" },
  ];
  assert.equal(evaluateClubOperationalAccess(
    { tenantId: "tenant-a", clubId: "club-a", physicalCourtId: ID_A },
    access
  ).allowed, true);
  assert.equal(evaluateClubOperationalAccess(
    { tenantId: "tenant-a", clubId: "club-b", physicalCourtId: ID_A },
    access
  ).allowed, true);
  assert.equal(evaluateClubOperationalAccess(
    { tenantId: "tenant-a", clubId: "club-b", physicalCourtId: ID_B },
    access
  ).allowed, false);
});

test("cross-tenant access evidence fails closed", () => {
  const result = evaluateClubOperationalAccess(
    { tenantId: "tenant-a", clubId: "club-a", physicalCourtId: ID_A },
    [{ tenantId: "tenant-b", clubId: "club-a", physicalCourtId: ID_A, status: "enabled" }]
  );
  assert.deepEqual(
    { allowed: result.allowed, reason: result.reason },
    { allowed: false, reason: "CROSS_TENANT_ACCESS" }
  );
});

test("cluster reconciliation requires durable public.court_clusters evidence", () => {
  const request = {
    tenantId: "tenant-a",
    venueId: "tenant-a",
    sourceSystem: "club-data-v3",
    sourceVersion: "3",
    legacyClusterId: "cluster-a",
  };
  assert.equal(reconcileClusterIdentity({
    ...request,
    durableClusters: [{ id: "cluster-a", venue_id: "tenant-a" }],
  }).classification, "deterministic");
  assert.equal(reconcileClusterIdentity({
    ...request,
    legacyClusterId: "tenant-a-main",
    durableClusters: [],
  }).classification, "unresolved_cluster");
  assert.equal(reconcileClusterIdentity({
    ...request,
    legacyClusterId: "",
    durableClusters: [{ id: "cluster-a", venue_id: "tenant-a" }],
  }).classification, "unresolved_cluster");
});

test("unstamped legacy courts dry-run as unresolved_cluster, never silently assigned", () => {
  const result = runPhysicalCourtMigrationDryRun({
    scope: { tenantId: "tenant-a", venueId: "tenant-a", clubId: "club-a" },
    durableClusters: [{ id: "cluster-a", venue_id: "tenant-a" }],
    legacyCourts: [{
      ...key,
      legacyClusterId: "",
    }],
  });
  assert.equal(result.records[0].classification, "unresolved_cluster");
  assert.equal(result.records[0].physicalCourtId, null);
  assert.equal(result.summary.UNRESOLVED_CLUSTER, 1);
  assert.deepEqual(result.writes, []);
});

test("explicit cluster mappings detect ambiguity and cross-scope provenance", () => {
  const request = {
    tenantId: "tenant-a",
    venueId: "tenant-a",
    sourceSystem: "blob",
    sourceVersion: "7",
    legacyClusterId: "old",
    durableClusters: [
      { id: "one", venue_id: "tenant-a" },
      { id: "two", venue_id: "tenant-a" },
    ],
  };
  assert.equal(reconcileClusterIdentity({
    ...request,
    clusterMappings: [
      { ...request, durableClusterId: "one" },
      { ...request, durableClusterId: "two" },
    ],
  }).classification, "ambiguous");
  assert.equal(reconcileClusterIdentity({
    ...request,
    clusterMappings: [{ ...request, tenantId: "tenant-b", durableClusterId: "one" }],
  }).classification, "invalid_scope");
});

test("provenance is mandatory and never defaulted", () => {
  assert.throws(
    () => normalizeLegacyCourtIdentityMapping({
      ...deterministicMapping,
      sourceSystem: undefined,
    }),
    /sourceSystem/
  );
  assert.throws(
    () => normalizeLegacyCourtIdentityMapping({
      ...deterministicMapping,
      sourceVersion: undefined,
    }),
    /sourceVersion/
  );
  assert.throws(
    () => normalizeLegacyCourtIdentityMapping({
      ...deterministicMapping,
      legacyClusterId: undefined,
    }),
    /legacyClusterId/
  );
});

test("deterministic duplicate mappings are idempotent", () => {
  const result = resolveLegacyCourtIdentity(key, [
    deterministicMapping,
    { ...deterministicMapping, version: 2, evidence: [{ type: "repeat" }] },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.physicalCourtId, ID_A);
  assert.equal(result.mappings.length, 2);
});

test("conflicting scoped mappings fail ambiguous", () => {
  const result = resolveLegacyCourtIdentity(key, [
    deterministicMapping,
    { ...deterministicMapping, physicalCourtId: ID_B },
  ]);
  assert.deepEqual(
    { ok: result.ok, classification: result.classification, reason: result.reason },
    { ok: false, classification: "ambiguous", reason: "CONFLICTING_MAPPINGS" }
  );
});

test("malformed duplicate mapping poisons resolution fail closed", () => {
  const result = resolveLegacyCourtIdentity(key, [
    deterministicMapping,
    { ...deterministicMapping, physicalCourtId: "not-a-uuid" },
  ]);
  assert.deepEqual(
    { ok: result.ok, classification: result.classification, reason: result.reason },
    { ok: false, classification: "invalid_scope", reason: "INVALID_MAPPING_RECORD" }
  );
});

test("legacy resolution includes source system, version and cluster", () => {
  assert.equal(resolveLegacyCourtIdentity(
    { ...key, sourceVersion: "4" },
    [deterministicMapping]
  ).reason, "MAPPING_NOT_FOUND");
  assert.equal(resolveLegacyCourtIdentity(
    { ...key, legacyClusterId: "other" },
    [deterministicMapping]
  ).reason, "MAPPING_NOT_FOUND");
  assert.equal(resolveLegacyCourtIdentity(
    { ...key, sourceSystem: "" },
    [deterministicMapping]
  ).classification, "invalid_scope");
});

test("cross-tenant mapping with the same provenance envelope fails closed", () => {
  const result = resolveLegacyCourtIdentity(key, [
    { ...deterministicMapping, tenantId: "tenant-b" },
  ]);
  assert.equal(result.classification, "invalid_scope");
  assert.equal(result.reason, "CROSS_TENANT_MAPPING");
});

test("dry-run reports classification counts separately from access status", () => {
  const result = runPhysicalCourtMigrationDryRun({
    scope: { tenantId: "tenant-a", venueId: "tenant-a", clubId: "club-a" },
    durableClusters: [{ id: "cluster-a", venue_id: "tenant-a" }],
    clusterMappings: [{
      tenantId: "tenant-a",
      venueId: "tenant-a",
      sourceSystem: "club-data-v3",
      sourceVersion: "3",
      legacyClusterId: "legacy-cluster-a",
      durableClusterId: "cluster-a",
    }],
    legacyCourts: [
      key,
      { ...key, legacyCourtId: "court-2" },
      { ...key, legacyCourtId: "court-3", sourceSystem: "" },
    ],
    existingMappings: [deterministicMapping],
    canonicalCourts: [baseCourt],
    existingAccess: [{
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: ID_A,
      status: "disabled",
    }],
  });
  assert.deepEqual(
    {
      total: result.summary.TOTAL_LEGACY_COURTS,
      deterministic: result.summary.DETERMINISTIC,
      review: result.summary.CANDIDATE_REVIEW,
      ambiguous: result.summary.AMBIGUOUS,
      unresolved: result.summary.UNRESOLVED_CLUSTER,
      invalid: result.summary.INVALID_SCOPE,
    },
    {
      total: 3,
      deterministic: 1,
      review: 1,
      ambiguous: 0,
      unresolved: 0,
      invalid: 1,
    }
  );
  assert.equal(result.records[0].classification, "deterministic");
  assert.equal(result.records[0].operationalAccess.allowed, false);
  assert.deepEqual(result.writes, []);
});

test("compatibility projection requires both deterministic mapping and access", () => {
  const denied = projectCanonicalCourtToLegacy({
    canonicalCourt: baseCourt,
    ...key,
    mappings: [deterministicMapping],
    accessRows: [{
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: ID_A,
      status: "disabled",
    }],
  });
  assert.equal(denied.code, "CLUB_OPERATIONAL_ACCESS_DENIED");

  const projected = projectCanonicalCourtToLegacy({
    canonicalCourt: baseCourt,
    ...key,
    mappings: [deterministicMapping],
    accessRows: [{
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: ID_A,
      status: "enabled",
    }],
  });
  assert.equal(projected.ok, true);
  assert.equal(projected.value.physicalCourtId, ID_A);
  assert.equal(projected.classification, "deterministic");
  assert.equal(projected.operationalAccess.allowed, true);
});

test("SQL package is additive, provenance-complete and rollback-owned", async () => {
  const root = new URL(
    "../docs/v5/migrations/court-resource-post427-canonical-reconciliation-01/",
    import.meta.url
  );
  const [apply, verify, rollback, readme] = await Promise.all([
    readFile(new URL("02_APPLY.sql", root), "utf8"),
    readFile(new URL("03_VERIFY.sql", root), "utf8"),
    readFile(new URL("04_ROLLBACK.sql", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
  ]);
  assert.match(apply, /source_system text NOT NULL/);
  assert.match(apply, /source_version text NOT NULL/);
  assert.match(apply, /legacy_cluster_id text NOT NULL/);
  assert.match(apply, /FORCE ROW LEVEL SECURITY/g);
  assert.match(apply, /CONFLICTING_MAPPING/);
  assert.doesNotMatch(apply, /CREATE TABLE\s+public\.court_reservations/i);
  assert.doesNotMatch(apply, /ALTER TABLE\s+public\.court_reservations/i);
  assert.match(verify, /exactly four package SELECT policies/);
  assert.doesNotMatch(rollback, /CASCADE/i);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.court_clusters/i);
  assert.match(readme, /Complete ownership manifest/);
});
