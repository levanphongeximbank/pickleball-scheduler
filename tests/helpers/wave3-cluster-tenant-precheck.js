/**
 * Wave 3 court_clusters.tenant_id precheck / backfill classification.
 * Mirrors docs/platform-core-wave3-tenant-venue-separation/sql/01_PRECHECK.sql
 * and the 03_BACKFILL parent-venue alignment rule. Local/static only.
 */

export const COURT_CLUSTERS_TENANT_COLUMN_STATE = {
  ABSENT_EXPECTED_TO_BE_CREATED_BY_02: "ABSENT_EXPECTED_TO_BE_CREATED_BY_02",
  PRESENT_COMPATIBLE: "PRESENT_COMPATIBLE",
  PRESENT_INCOMPATIBLE: "PRESENT_INCOMPATIBLE",
};

export const PRODUCTION_PRECHECK_EVIDENCE_2026_08 = {
  venuesCount: 1,
  profilesCount: 61,
  courtClustersCount: 1,
  clubsCount: 1,
  tenantSubscriptionsCount: 1,
  platformTenantsExists: false,
  venuesTenantIdExists: false,
  profilesTenantIdExists: false,
  courtClustersTenantIdExists: false,
  profileHomeVenueOrphans: 0,
  clubTenantBootstrapOrphans: 0,
  subscriptionTenantBootstrapOrphans: 0,
  clusterOrphanParentVenues: 0,
  clusterTenantParentBootstrapMismatches: 0,
  slugCollisions: 0,
  restoreReadiness: "UNKNOWN",
};

function columnPresent(value) {
  return value === true || value === "YES";
}

export function classifyCourtClustersTenantColumnState({
  exists,
  dataType,
  existingFkTable,
} = {}) {
  if (!columnPresent(exists)) {
    return {
      state: COURT_CLUSTERS_TENANT_COLUMN_STATE.ABSENT_EXPECTED_TO_BE_CREATED_BY_02,
      courtClustersTenantIdExists: "NO",
      dataCorruption: false,
      expectedPreSchema: true,
      blocker: false,
      pipeline: [
        "EXPECTED_PRE_SCHEMA",
        "CREATED_BY_02",
        "BACKFILLED_BY_03",
        "VERIFIED_BY_05",
      ],
    };
  }

  const typeOk = dataType == null || dataType === "text";
  const fkOk = !existingFkTable || existingFkTable === "platform_tenants";
  if (!typeOk || !fkOk) {
    return {
      state: COURT_CLUSTERS_TENANT_COLUMN_STATE.PRESENT_INCOMPATIBLE,
      courtClustersTenantIdExists: "YES",
      dataCorruption: false,
      expectedPreSchema: false,
      blocker: true,
      pipeline: [],
    };
  }

  return {
    state: COURT_CLUSTERS_TENANT_COLUMN_STATE.PRESENT_COMPATIBLE,
    courtClustersTenantIdExists: "YES",
    dataCorruption: false,
    expectedPreSchema: false,
    blocker: false,
    pipeline: [
      "PRESENT_COMPATIBLE",
      "IDEMPOTENT_02",
      "BACKFILLED_BY_03",
      "VERIFIED_BY_05",
    ],
  };
}

export function collectWave3PrecheckBlockers(evidence = {}) {
  const column = classifyCourtClustersTenantColumnState({
    exists: evidence.courtClustersTenantIdExists,
    dataType: evidence.clusterTenantDataType,
    existingFkTable: evidence.clusterTenantFkTable,
  });
  const blockers = [];

  if (column.blocker) {
    blockers.push(column.state);
  }
  if ((evidence.clusterOrphanParentVenues || 0) > 0) {
    blockers.push("CLUSTER_ORPHAN_PARENT_VENUES");
  }
  if (
    column.courtClustersTenantIdExists === "YES" &&
    columnPresent(evidence.venuesTenantIdExists) &&
    (evidence.clusterTenantParentBootstrapMismatches || 0) > 0
  ) {
    blockers.push("CLUSTER_TENANT_PARENT_MISMATCH");
  }
  if ((evidence.slugCollisions || 0) > 0) {
    blockers.push("SLUG_COLLISIONS");
  }
  if ((evidence.profileHomeVenueOrphans || 0) > 0) {
    blockers.push("PROFILE_HOME_VENUE_ORPHANS");
  }
  if ((evidence.clubTenantBootstrapOrphans || 0) > 0) {
    blockers.push("CLUB_TENANT_BOOTSTRAP_ORPHANS");
  }
  if ((evidence.subscriptionTenantBootstrapOrphans || 0) > 0) {
    blockers.push("SUBSCRIPTION_TENANT_BOOTSTRAP_ORPHANS");
  }

  return {
    columnState: column.state,
    column,
    blockers,
    blocked: blockers.length > 0,
    dataCorruption: false,
    resourceSchemaPackageReady: !blockers.length,
    productionBackupGate:
      evidence.restoreReadiness && evidence.restoreReadiness !== "READY"
        ? "STILL_REQUIRED"
        : evidence.restoreReadiness === "READY"
          ? "READY"
          : "STILL_REQUIRED",
  };
}

export function alignClusterTenantFromParentVenue(clusters, venues) {
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  return clusters.map((cluster) => {
    const parent = venueById.get(cluster.venueId);
    if (!parent) {
      return { ...cluster, orphanVenue: true, mismatch: false };
    }
    const current = cluster.tenantId;
    const blank = current == null || String(current).trim() === "";
    if (blank) {
      return {
        ...cluster,
        tenantId: parent.tenantId,
        orphanVenue: false,
        alignedFromParent: true,
        mismatch: false,
      };
    }
    return {
      ...cluster,
      orphanVenue: false,
      alignedFromParent: false,
      mismatch: current !== parent.tenantId,
    };
  });
}

export function identitiesRemainDistinct({ tenantId, venueId, clusterId, courtId }) {
  return {
    tenantEqualsVenue: tenantId === venueId,
    venueEqualsCluster: venueId === clusterId,
    clusterEqualsCourt: clusterId === courtId,
  };
}

export function simulateWave3PackageSequence({
  clusterTenantColumnExists,
  venues,
  clusters,
} = {}) {
  const after02 = {
    clusterTenantColumnExists: true,
    createdBy02: !clusterTenantColumnExists,
  };
  const tenants = venues.map((venue) => ({
    id: venue.id,
    name: venue.name || venue.id,
  }));
  const stampedVenues = venues.map((venue) => ({
    ...venue,
    tenantId: venue.tenantId || venue.id,
  }));
  const aligned = alignClusterTenantFromParentVenue(clusters, stampedVenues);
  const orphan = aligned.filter((row) => row.orphanVenue).length;
  const mismatch = aligned.filter((row) => row.mismatch).length;
  const missing = aligned.filter(
    (row) => row.tenantId == null || String(row.tenantId).trim() === ""
  ).length;
  const ok = orphan === 0 && mismatch === 0 && missing === 0;
  return {
    ok,
    after02,
    tenants,
    stampedVenues,
    aligned,
    orphan,
    mismatch,
    missing,
    verify: ok
      ? {
          COURT_CLUSTERS_TENANT_ID_EXISTS: "YES",
          CLUSTERS_MISSING_TENANT: 0,
          CLUSTERS_ORPHAN_VENUE: 0,
          CLUSTERS_TENANT_MISMATCH_PARENT_VENUE: 0,
          COURT_CLUSTERS_TENANT_FK: "VALID",
          COURT_CLUSTERS_TENANT_INDEX: "VALID",
        }
      : null,
  };
}
