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

const PHASE3A_SQL_ROOT = new URL(
  "../docs/v5/migrations/court-resource-post427-canonical-reconciliation-01/",
  import.meta.url
);

const IDENTITY_GUARD_COMMON_FIELDS = new Set([
  "tenant_id",
  "created_at",
  "version",
  "updated_at",
]);

const IDENTITY_GUARD_TABLE_FIELDS = {
  physical_court_id: new Set([
    "court_resource_physical_courts",
    "court_resource_club_operational_access",
    "court_resource_legacy_court_identity_mappings",
  ]),
  cluster_id: new Set([
    "court_resource_physical_courts",
    "court_resource_cluster_identity_mappings",
  ]),
  access_id: new Set(["court_resource_club_operational_access"]),
  club_id: new Set([
    "court_resource_club_operational_access",
    "court_resource_legacy_court_identity_mappings",
  ]),
  cluster_mapping_id: new Set(["court_resource_cluster_identity_mappings"]),
  mapping_id: new Set(["court_resource_legacy_court_identity_mappings"]),
  source_system: new Set([
    "court_resource_cluster_identity_mappings",
    "court_resource_legacy_court_identity_mappings",
  ]),
  source_version: new Set([
    "court_resource_cluster_identity_mappings",
    "court_resource_legacy_court_identity_mappings",
  ]),
  legacy_cluster_id: new Set([
    "court_resource_cluster_identity_mappings",
    "court_resource_legacy_court_identity_mappings",
  ]),
  legacy_court_id: new Set(["court_resource_legacy_court_identity_mappings"]),
};

function extractIdentityGuard(applySql) {
  const start = applySql.indexOf(
    "CREATE FUNCTION public.court_resource_identity_guard()"
  );
  const end = applySql.indexOf("$$;", start);
  assert.ok(start >= 0 && end > start, "identity guard function missing");
  return applySql.slice(start, end);
}

function stripSqlLineComments(sql) {
  return sql.replace(/--[^\n]*/g, "");
}

function extractTableBranches(fn, tableName) {
  const src = stripSqlLineComments(fn);
  const re = new RegExp(
    `(?:IF|ELSIF)\\s+TG_TABLE_NAME\\s*=\\s*'${tableName}'\\s+THEN([\\s\\S]*?)(?=\\s+ELSIF\\s+TG_TABLE_NAME|\\s+END IF;)`,
    "g"
  );
  return [...src.matchAll(re)].map((match) => match[1]);
}

function collectIdentityGuardFieldHazards(fn) {
  const src = stripSqlLineComments(fn);
  const tokenRe = /(?:ELSIF|IF)\s+([\s\S]*?)\s+THEN|\bELSE\b|\bEND IF\b/gi;
  const stack = [];
  const hazards = [];
  let lastIndex = 0;
  let match;

  function activeTables() {
    return stack.map((frame) => frame.table).filter(Boolean);
  }

  function checkFields(text, contextTables) {
    const fieldRe = /(?:NEW|OLD)\.([A-Za-z_][A-Za-z0-9_]*)/g;
    let fieldMatch;
    while ((fieldMatch = fieldRe.exec(text))) {
      const field = fieldMatch[1];
      if (IDENTITY_GUARD_COMMON_FIELDS.has(field)) continue;
      const owners = IDENTITY_GUARD_TABLE_FIELDS[field];
      if (!owners) continue;
      if (!contextTables.some((table) => owners.has(table))) {
        hazards.push({
          field,
          contextTables: [...contextTables],
          snippet: text
            .slice(Math.max(0, fieldMatch.index - 48), fieldMatch.index + 48)
            .replace(/\s+/g, " ")
            .trim(),
        });
      }
    }
  }

  while ((match = tokenRe.exec(src))) {
    checkFields(src.slice(lastIndex, match.index), activeTables());
    const token = match[0];
    if (/^END IF\b/i.test(token)) {
      stack.pop();
    } else if (/^ELSE$/i.test(token.trim())) {
      if (stack.length) stack[stack.length - 1] = { table: null };
    } else {
      const condition = match[1] ?? "";
      const tableMatch = condition.match(/TG_TABLE_NAME\s*=\s*'([^']+)'/);
      const table = tableMatch ? tableMatch[1] : null;
      if (/^\s*ELSIF\b/i.test(token)) {
        const parentTables = stack
          .slice(0, -1)
          .map((frame) => frame.table)
          .filter(Boolean);
        checkFields(condition, parentTables);
        if (stack.length) stack[stack.length - 1] = { table };
        else stack.push({ table });
      } else {
        checkFields(condition, activeTables());
        stack.push({ table });
      }
    }
    lastIndex = tokenRe.lastIndex;
  }
  checkFields(src.slice(lastIndex), activeTables());
  return hazards;
}

test("SQL package is additive, provenance-complete and rollback-owned", async () => {
  const [apply, verify, rollback, readme] = await Promise.all([
    readFile(new URL("02_APPLY.sql", PHASE3A_SQL_ROOT), "utf8"),
    readFile(new URL("03_VERIFY.sql", PHASE3A_SQL_ROOT), "utf8"),
    readFile(new URL("04_ROLLBACK.sql", PHASE3A_SQL_ROOT), "utf8"),
    readFile(new URL("README.md", PHASE3A_SQL_ROOT), "utf8"),
  ]);
  assert.match(apply, /source_system text NOT NULL/);
  assert.match(apply, /source_version text NOT NULL/);
  assert.match(apply, /legacy_cluster_id text NOT NULL/);
  assert.match(apply, /FORCE ROW LEVEL SECURITY/g);
  assert.match(apply, /CONFLICTING_MAPPING/);
  assert.doesNotMatch(apply, /CREATE TABLE\s+public\.court_reservations/i);
  assert.doesNotMatch(apply, /ALTER TABLE\s+public\.court_reservations/i);
  assert.match(verify, /exactly four package SELECT policies/);
  assert.match(verify, /nested table discriminator/);
  assert.match(verify, /READ ONLY/);
  assert.doesNotMatch(verify, /\bINSERT INTO\b|\bUPDATE\s+public\.|\bDELETE FROM\b/i);
  assert.doesNotMatch(rollback, /CASCADE/i);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.court_clusters/i);
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.court_resource_identity_guard\(\)/);
  assert.match(readme, /Complete ownership manifest/);
});

test("identity guard isolates table-specific NEW/OLD fields after table discriminator", async () => {
  const apply = await readFile(new URL("02_APPLY.sql", PHASE3A_SQL_ROOT), "utf8");
  const guard = extractIdentityGuard(apply);
  const physicalBranches = extractTableBranches(
    guard,
    "court_resource_physical_courts"
  );
  const accessBranches = extractTableBranches(
    guard,
    "court_resource_club_operational_access"
  );
  const clusterBranches = extractTableBranches(
    guard,
    "court_resource_cluster_identity_mappings"
  );
  const legacyBranches = extractTableBranches(
    guard,
    "court_resource_legacy_court_identity_mappings"
  );

  assert.equal(physicalBranches.length, 2);
  assert.match(physicalBranches.join("\n"), /NEW\.cluster_id/);
  assert.match(physicalBranches.join("\n"), /NEW\.physical_court_id/);
  assert.match(
    physicalBranches.join("\n"),
    /COURT_RESOURCE_IMMUTABLE_PHYSICAL_IDENTITY/
  );

  assert.equal(accessBranches.length, 2);
  assert.match(accessBranches.join("\n"), /NEW\.access_id/);
  assert.match(accessBranches.join("\n"), /NEW\.club_id/);
  assert.match(accessBranches.join("\n"), /NEW\.physical_court_id/);
  assert.doesNotMatch(accessBranches.join("\n"), /NEW\.cluster_id\b/);
  assert.match(
    accessBranches.join("\n"),
    /COURT_RESOURCE_IMMUTABLE_ACCESS_IDENTITY/
  );
  assert.match(accessBranches.join("\n"), /COURT_RESOURCE_INVALID_ACCESS_SCOPE/);

  assert.equal(clusterBranches.length, 2);
  assert.match(
    clusterBranches.join("\n"),
    /IF NEW\.cluster_id IS NOT NULL THEN/
  );
  assert.match(
    clusterBranches.join("\n"),
    /COURT_RESOURCE_IMMUTABLE_CLUSTER_PROVENANCE/
  );
  assert.doesNotMatch(
    guard,
    /TG_TABLE_NAME\s*=\s*'court_resource_cluster_identity_mappings'\s+AND\s+NEW\.cluster_id/
  );

  assert.equal(legacyBranches.length, 2);
  for (const branch of legacyBranches) {
    assert.doesNotMatch(branch, /NEW\.cluster_id\b/);
    assert.doesNotMatch(branch, /OLD\.cluster_id\b/);
  }
  assert.match(legacyBranches.join("\n"), /NEW\.mapping_id/);
  assert.match(legacyBranches.join("\n"), /NEW\.legacy_court_id/);
  assert.match(legacyBranches.join("\n"), /NEW\.physical_court_id/);
  assert.match(
    legacyBranches.join("\n"),
    /COURT_RESOURCE_IMMUTABLE_LEGACY_PROVENANCE/
  );
  assert.match(
    legacyBranches.join("\n"),
    /COURT_RESOURCE_INVALID_MAPPING_SCOPE/
  );

  assert.doesNotMatch(
    stripSqlLineComments(guard),
    /TG_TABLE_NAME\s*=\s*'[^']+'\s+AND\s+\(?\s*(?:NEW|OLD)\./
  );
  assert.deepEqual(collectIdentityGuardFieldHazards(guard), []);
  assert.match(guard, /COURT_RESOURCE_CROSS_TENANT_SCOPE/);
  assert.match(guard, /NEW\.version\s*:=\s*OLD\.version\s*\+\s*1/);
  assert.match(guard, /COURT_RESOURCE_IMMUTABLE_IDENTITY_SCOPE/);

  const stage3Defect = `
CREATE FUNCTION public.court_resource_identity_guard()
BEGIN
  IF TG_TABLE_NAME = 'court_resource_physical_courts' THEN
    SELECT venue_id INTO v_scope_tenant FROM public.court_clusters WHERE id = NEW.cluster_id;
  ELSIF TG_TABLE_NAME = 'court_resource_cluster_identity_mappings'
        AND NEW.cluster_id IS NOT NULL THEN
    SELECT venue_id INTO v_scope_tenant FROM public.court_clusters WHERE id = NEW.cluster_id;
  ELSIF TG_TABLE_NAME = 'court_resource_legacy_court_identity_mappings' THEN
    SELECT tenant_id INTO v_scope_tenant FROM public.clubs WHERE id = NEW.club_id;
  END IF;
END
`;
  const defectHazards = collectIdentityGuardFieldHazards(stage3Defect);
  assert.ok(
    defectHazards.some((item) => item.field === "cluster_id"),
    "regression must flag NEW.cluster_id on the cluster-mapping AND expression"
  );
});
