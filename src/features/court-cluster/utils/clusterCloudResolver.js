import { DEFAULT_TENANT_ID } from "../../../models/tenant.js";
import {
  buildDefaultClusterId,
  normalizeCourtCluster,
} from "../../../models/courtCluster.js";
import { sanitizeBillingTenantId } from "../../billing/services/billingTenantResolver.js";
import { fetchSupabaseVenues } from "../../billing/services/billingVenueService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";

export const ADMIN_ALL_TENANTS_MUTATION_ID = "__all_tenants__";

const AMBIGUOUS_CLUSTER_MUTATION_TARGETS = new Set([
  ADMIN_ALL_TENANTS_MUTATION_ID,
  DEFAULT_TENANT_ID,
  "default",
]);

export function isAmbiguousClusterMutationTarget(venueId) {
  const normalized = String(venueId || "").trim();
  if (!normalized) {
    return true;
  }
  if (AMBIGUOUS_CLUSTER_MUTATION_TARGETS.has(normalized)) {
    return true;
  }
  return !sanitizeBillingTenantId(normalized);
}

export function resolveConcreteClusterVenueId(venueId) {
  if (isAmbiguousClusterMutationTarget(venueId)) {
    return null;
  }
  return sanitizeBillingTenantId(venueId);
}

export function isLegacyClusterVenueId(venueId) {
  return isAmbiguousClusterMutationTarget(venueId);
}

export function needsLegacyClusterMigration(cluster, cloudVenueId) {
  if (!cluster || !resolveConcreteClusterVenueId(cloudVenueId)) {
    return false;
  }

  if (cluster.id === buildDefaultClusterId(DEFAULT_TENANT_ID)) {
    return true;
  }

  return isLegacyClusterVenueId(cluster.venueId);
}

export function migrateLegacyClusterRecord(cluster, cloudVenueId) {
  const normalized = normalizeCourtCluster(cluster);
  if (!needsLegacyClusterMigration(normalized, cloudVenueId)) {
    return normalized;
  }

  const isMainCluster =
    normalized.slug === "main" ||
    normalized.id.endsWith("-main") ||
    normalized.id === buildDefaultClusterId(normalized.venueId);

  const nextId = isMainCluster
    ? buildDefaultClusterId(cloudVenueId)
    : `${cloudVenueId}-${normalized.slug || "cluster"}`;

  return normalizeCourtCluster({
    ...normalized,
    id: nextId,
    venueId: cloudVenueId,
  });
}

/**
 * Mutation target for one cluster. Persisted row ownership wins over UI scope.
 * Never invents a target from venue list order, header context, or home profile.
 */
export function resolveClusterMutationVenueId({
  cluster = null,
  selectedVenueId = null,
  persistedVenueId = null,
} = {}) {
  const fromRow = resolveConcreteClusterVenueId(
    persistedVenueId || cluster?.venueId
  );
  if (fromRow) {
    return fromRow;
  }
  return resolveConcreteClusterVenueId(selectedVenueId);
}

export function prepareClusterForCloudPersist(cluster, selectedVenueId = null) {
  if (!cluster) {
    return { ok: false, code: "CLUSTER_NOT_FOUND", error: "Không tìm thấy cụm sân." };
  }

  const normalized = normalizeCourtCluster(cluster);
  const cloudVenueId = resolveClusterMutationVenueId({
    cluster: normalized,
    selectedVenueId,
  });

  if (!cloudVenueId) {
    return {
      ok: false,
      code: "VENUE_ID_REQUIRED",
      error:
        "Cụm sân thiếu tổ chức cloud hợp lệ. Không dùng Tất cả / Default Tenant làm mục tiêu ghi.",
      cluster: normalized,
    };
  }

  return {
    ok: true,
    venueId: cloudVenueId,
    cluster: migrateLegacyClusterRecord(normalized, cloudVenueId),
  };
}

export async function resolveCloudVenueIdForClusterOps({
  selectedVenueId,
  persistedVenueId = null,
  cluster = null,
} = {}) {
  const resolved = resolveClusterMutationVenueId({
    cluster,
    selectedVenueId,
    persistedVenueId,
  });

  if (!resolved) {
    return null;
  }

  if (hasSupabaseConfig()) {
    const venueResult = await fetchSupabaseVenues();
    if (venueResult.ok && Array.isArray(venueResult.venues) && venueResult.venues.length > 0) {
      const exact = venueResult.venues.find((venue) => venue.id === resolved);
      if (!exact) {
        return null;
      }
    }
  }

  return resolved;
}
