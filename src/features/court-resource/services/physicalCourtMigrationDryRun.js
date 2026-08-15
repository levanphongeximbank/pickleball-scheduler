import { evaluateClubOperationalAccess } from "../contracts/clubOperationalAccess.js";
import { resolveLegacyCourtIdentity } from "../contracts/legacyCourtIdentityMapping.js";
import { reconcileClusterIdentity } from "./clusterIdentityReconciliation.js";

const COUNTS = Object.freeze([
  "deterministic",
  "candidate_review",
  "ambiguous",
  "unresolved_cluster",
  "invalid_scope",
]);

function text(value) {
  return value == null ? "" : String(value).trim();
}

function classify(record, context) {
  const identity = {
    tenantId: text(record.tenantId ?? context.scope.tenantId),
    venueId: text(record.venueId ?? context.scope.venueId),
    clubId: text(record.clubId ?? context.scope.clubId),
    sourceSystem: text(record.sourceSystem),
    sourceVersion: text(record.sourceVersion),
    legacyClusterId: text(record.legacyClusterId),
    legacyCourtId: text(record.legacyCourtId),
  };
  if (
    !Object.values(identity).every(Boolean) ||
    identity.tenantId !== text(context.scope.tenantId) ||
    identity.venueId !== text(context.scope.venueId) ||
    identity.clubId !== text(context.scope.clubId)
  ) {
    return Object.freeze({
      ...identity,
      classification: "invalid_scope",
      physicalCourtId: null,
      clusterId: null,
      operationalAccess: null,
      evidence: Object.freeze([{ type: "INVALID_IDENTITY_PROVENANCE_OR_SCOPE" }]),
    });
  }

  const cluster = reconcileClusterIdentity({
    ...identity,
    durableClusters: context.durableClusters,
    clusterMappings: context.clusterMappings,
  });
  if (!cluster.ok) {
    return Object.freeze({
      ...identity,
      classification: cluster.classification,
      physicalCourtId: null,
      clusterId: null,
      operationalAccess: null,
      evidence: cluster.evidence,
    });
  }

  const mapping = resolveLegacyCourtIdentity(identity, context.existingMappings);
  if (!mapping.ok) {
    return Object.freeze({
      ...identity,
      classification: mapping.classification,
      physicalCourtId: null,
      clusterId: cluster.clusterId,
      operationalAccess: null,
      evidence: Object.freeze([...cluster.evidence, { type: mapping.reason }]),
    });
  }

  const court = context.canonicalCourts.find(
    (item) => text(item.physicalCourtId) === mapping.physicalCourtId
  );
  if (
    !court ||
    text(court.tenantId) !== identity.tenantId ||
    text(court.clusterId) !== cluster.clusterId
  ) {
    return Object.freeze({
      ...identity,
      classification: court ? "invalid_scope" : "candidate_review",
      physicalCourtId: null,
      clusterId: cluster.clusterId,
      operationalAccess: null,
      evidence: Object.freeze([
        ...cluster.evidence,
        { type: court ? "MAPPED_COURT_SCOPE_MISMATCH" : "MAPPED_CANONICAL_COURT_NOT_FOUND" },
      ]),
    });
  }
  return Object.freeze({
    ...identity,
    classification: "deterministic",
    physicalCourtId: mapping.physicalCourtId,
    clusterId: cluster.clusterId,
    operationalAccess: evaluateClubOperationalAccess(
      {
        tenantId: identity.tenantId,
        clubId: identity.clubId,
        physicalCourtId: mapping.physicalCourtId,
      },
      context.existingAccess
    ),
    evidence: Object.freeze([...cluster.evidence, { type: "EXPLICIT_VERSIONED_MAPPING" }]),
  });
}

export function runPhysicalCourtMigrationDryRun(input = {}) {
  if (input.dryRun === false) {
    throw new Error("Phase 3A migration is dry-run only.");
  }
  const legacyCourts = Array.isArray(input.legacyCourts) ? input.legacyCourts : [];
  const context = {
    scope: input.scope && typeof input.scope === "object" ? input.scope : {},
    durableClusters: Array.isArray(input.durableClusters) ? input.durableClusters : [],
    clusterMappings: Array.isArray(input.clusterMappings) ? input.clusterMappings : [],
    existingMappings: Array.isArray(input.existingMappings) ? input.existingMappings : [],
    canonicalCourts: Array.isArray(input.canonicalCourts) ? input.canonicalCourts : [],
    existingAccess: Array.isArray(input.existingAccess) ? input.existingAccess : [],
  };
  const records = Object.freeze(legacyCourts.map((record) => classify(record, context)));
  const summary = Object.fromEntries(COUNTS.map((key) => [key, 0]));
  summary.totalLegacyCourts = records.length;
  for (const record of records) summary[record.classification] += 1;
  summary.TOTAL_LEGACY_COURTS = summary.totalLegacyCourts;
  summary.DETERMINISTIC = summary.deterministic;
  summary.CANDIDATE_REVIEW = summary.candidate_review;
  summary.AMBIGUOUS = summary.ambiguous;
  summary.UNRESOLVED_CLUSTER = summary.unresolved_cluster;
  summary.INVALID_SCOPE = summary.invalid_scope;
  return Object.freeze({
    dryRun: true,
    summary: Object.freeze(summary),
    records,
    writes: Object.freeze([]),
  });
}

export const physicalCourtMigrationDryRun = runPhysicalCourtMigrationDryRun;
