/**
 * Court Operations canonical inventory / eligibility.
 * Sources Physical Court master + club operational access + cluster topology.
 * Does not read Club V3 blob, club storage loaders, or browser storage.
 *
 * tenantId is required explicitly — never invented from venueId.
 * court_clusters.venue_id is organization_parent_id_debt (compare to explicit
 * tenantId only; never invent caller tenantId from cluster.venue_id).
 */
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  COURT_ACCESS_AUTHORITY_TABLE,
  COURT_MASTER_TABLE,
} from "../constants/courtOperationsOwnership.js";
import {
  isCanonicalPhysicalCourtId,
  normalizeCanonicalPhysicalCourt,
} from "../contracts/canonicalPhysicalCourt.js";
import {
  evaluateClubOperationalAccess,
  normalizeClubOperationalAccess,
} from "../contracts/clubOperationalAccess.js";
import {
  COURT_OPERATIONS_SCOPE_CODE,
  requireCanonicalTenantId,
} from "../scope/courtOperationsScope.js";

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function fail(code, error, extra = {}) {
  return { ok: false, code, error, courts: [], ...extra };
}

/**
 * Organization parent id on a cluster row for filter comparison only.
 * Prefer tenant_id when present; else venue_id is documented org-parent debt.
 * Never used to invent a missing request.tenantId.
 */
function clusterOrgParentId(cluster) {
  const explicitTenant = trimId(cluster?.tenantId) || trimId(cluster?.tenant_id);
  if (explicitTenant) return explicitTenant;
  // COURT_CLUSTERS_VENUE_ID_SEMANTICS=organization_parent_id_debt
  return trimId(cluster?.venue_id) || trimId(cluster?.venueId);
}

function mapScopeFailure(result) {
  if (result.code === COURT_OPERATIONS_SCOPE_CODE.TENANT_VENUE_COLLAPSE_DENIED) {
    return fail(
      COURT_RESOURCE_CODE.TENANT_VENUE_COLLAPSE_DENIED,
      result.error || "venueId cannot substitute for tenantId."
    );
  }
  if (result.code === COURT_OPERATIONS_SCOPE_CODE.MISSING_TENANT_ID) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_TENANT_ID,
      result.error || "tenantId is required."
    );
  }
  return fail(result.code || COURT_RESOURCE_CODE.TENANT_MISMATCH, result.error || "Invalid tenant scope.");
}

function collectRequestedPhysicalCourtIds(request, clusterId) {
  const raw = [];
  if (Array.isArray(request.physicalCourtIds) && request.physicalCourtIds.length) {
    raw.push(...request.physicalCourtIds);
  } else if (trimId(request.physicalCourtId)) {
    raw.push(request.physicalCourtId);
  } else if (Array.isArray(request.selectedCourtIds) && request.selectedCourtIds.length) {
    raw.push(...request.selectedCourtIds);
  } else if (Array.isArray(request.courtIds) && request.courtIds.length) {
    raw.push(...request.courtIds);
  } else if (trimId(request.courtId)) {
    raw.push(request.courtId);
  }

  const ids = [...new Set(raw.map(trimId).filter(Boolean))];
  if (ids.length === 0) return { ok: true, ids: [] };
  if (clusterId && ids.some((id) => id === clusterId)) {
    return fail(
      COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED,
      "Cannot list a cluster id as a physical court."
    );
  }
  const invalid = ids.filter((id) => !isCanonicalPhysicalCourtId(id));
  if (invalid.length) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "Legacy court label/number cannot establish canonical identity — physicalCourtId is required.",
      { failed: invalid }
    );
  }
  return { ok: true, ids };
}

export function projectEligiblePhysicalCourt(court) {
  return Object.freeze({
    physicalCourtId: court.physicalCourtId,
    clusterId: court.clusterId,
    displayName: court.displayName,
    displayCode: court.displayCode,
    displayNumber: court.displayNumber,
    status: court.lifecycleStatus,
    sortOrder: court.sortOrder,
    identityAuthority: "physicalCourtId",
    clusterRole: "filter_topology_only",
    courtCountIsIdentity: false,
    displayLabelIsIdentity: false,
    compatibilityProjection: Object.freeze({
      id: court.physicalCourtId,
      name: court.displayName,
    }),
    id: court.physicalCourtId,
    name: court.displayName,
  });
}

/**
 * Canonical eligibility: tenant + club + optional cluster → physical courts.
 *
 * @param {object} request
 * @param {object} sources Court Master / Access / cluster snapshot.
 *   Ignored if present: Club V3 blob courts, browser storage, legacyBlobCourts.
 */
export function listEligiblePhysicalCourts(request = {}, sources = {}) {
  const tenantResult = requireCanonicalTenantId(request);
  if (!tenantResult.ok) return mapScopeFailure(tenantResult);
  const tenantId = tenantResult.tenantId;
  const clubId = trimId(request.clubId);
  const clusterId = trimId(request.clusterId);

  if (!clubId) {
    return fail(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required — no first-club fallback.");
  }

  const physicalCourts = Array.isArray(sources.physicalCourts) ? sources.physicalCourts : [];
  const accessRows = Array.isArray(sources.clubOperationalAccess)
    ? sources.clubOperationalAccess
    : Array.isArray(sources.accessRows)
      ? sources.accessRows
      : [];
  const clusters = Array.isArray(sources.clusters) ? sources.clusters : [];
  const clubs = sources.clubs;

  if (Array.isArray(clubs)) {
    const club = clubs.find((row) => trimId(row?.id) === clubId || trimId(row?.clubId) === clubId);
    if (!club) {
      return fail(COURT_RESOURCE_CODE.OUT_OF_SCOPE, "Unknown club scope — fail closed.");
    }
    const clubTenant = trimId(club.tenantId) || trimId(club.tenant_id);
    if (clubTenant && clubTenant !== tenantId) {
      return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "Cross-tenant club scope — fail closed.");
    }
  }

  if (clusterId) {
    const cluster = clusters.find(
      (row) => trimId(row?.id) === clusterId || trimId(row?.clusterId) === clusterId
    );
    if (!cluster) {
      return fail(
        COURT_RESOURCE_CODE.CLUSTER_MISMATCH,
        "Unknown clusterId — cluster is a filter only."
      );
    }
    const clusterParent = clusterOrgParentId(cluster);
    if (clusterParent && clusterParent !== tenantId) {
      return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "Cluster does not belong to tenant — fail closed.");
    }
  }

  const normalizedAccess = [];
  for (const value of accessRows) {
    try {
      normalizedAccess.push(normalizeClubOperationalAccess(value));
    } catch {
      continue;
    }
  }

  const clubAccess = normalizedAccess.filter((row) => row.clubId === clubId);
  if (clubAccess.some((row) => row.tenantId !== tenantId)) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "Cross-tenant operational access — fail closed.");
  }
  if (!Array.isArray(clubs) && clubAccess.length === 0) {
    return fail(COURT_RESOURCE_CODE.OUT_OF_SCOPE, "Unknown club/court scope — fail closed.");
  }

  const requested = collectRequestedPhysicalCourtIds(request, clusterId);
  if (requested.ok === false) return requested;

  const eligible = [];
  const seen = new Set();
  for (const rawCourt of physicalCourts) {
    let court;
    try {
      court = normalizeCanonicalPhysicalCourt(rawCourt);
    } catch {
      continue;
    }
    if (court.tenantId !== tenantId) continue;
    if (clusterId && court.clusterId !== clusterId) continue;
    if (court.lifecycleStatus !== "active") continue;
    if (clusterId && court.physicalCourtId === clusterId) continue;

    const access = evaluateClubOperationalAccess(
      { tenantId, clubId, physicalCourtId: court.physicalCourtId },
      normalizedAccess
    );
    if (access.reason === "CROSS_TENANT_ACCESS") {
      return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "Cross-tenant operational access — fail closed.");
    }
    if (!access.allowed) continue;
    if (seen.has(court.physicalCourtId)) continue;
    seen.add(court.physicalCourtId);
    eligible.push(projectEligiblePhysicalCourt(court));
  }

  eligible.sort(
    (a, b) => a.sortOrder - b.sortOrder || String(a.displayName).localeCompare(String(b.displayName))
  );

  if (requested.ids.length) {
    const byId = new Map(eligible.map((row) => [row.physicalCourtId, row]));
    const matched = [];
    const failed = [];
    for (const id of requested.ids) {
      const row = byId.get(id);
      if (!row) {
        failed.push({ physicalCourtId: id, code: COURT_RESOURCE_CODE.UNKNOWN_COURT });
        continue;
      }
      matched.push(row);
    }
    if (failed.length) {
      return fail(
        COURT_RESOURCE_CODE.UNKNOWN_COURT,
        "Requested physical court is not in club operational scope.",
        { failed }
      );
    }
    return {
      ok: true,
      code: COURT_RESOURCE_CODE.OK,
      courts: matched,
      inventorySource: COURT_MASTER_TABLE,
      accessAuthority: COURT_ACCESS_AUTHORITY_TABLE,
    };
  }

  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    courts: eligible,
    inventorySource: COURT_MASTER_TABLE,
    accessAuthority: COURT_ACCESS_AUTHORITY_TABLE,
  };
}

export function createCanonicalInventoryReader(sources) {
  return (request = {}) => listEligiblePhysicalCourts(request, sources);
}
