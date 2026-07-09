import { DEFAULT_TENANT_ID } from "../../../models/tenant.js";
import {
  buildDefaultClusterId,
  normalizeCourtCluster,
} from "../../../models/courtCluster.js";
import { sanitizeBillingTenantId } from "../../billing/services/billingTenantResolver.js";
import { fetchSupabaseVenues } from "../../billing/services/billingVenueService.js";
import { fetchProfileByUserId } from "../../../auth/profileService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isValidProfileUserId } from "./profileUserId.js";

export function isLegacyClusterVenueId(venueId) {
  const normalized = String(venueId || "").trim();
  if (!normalized) {
    return true;
  }
  return normalized === DEFAULT_TENANT_ID || !sanitizeBillingTenantId(normalized);
}

export function needsLegacyClusterMigration(cluster, cloudVenueId) {
  if (!cluster || !cloudVenueId) {
    return false;
  }

  if (cluster.id === buildDefaultClusterId(DEFAULT_TENANT_ID)) {
    return true;
  }

  if (isLegacyClusterVenueId(cluster.venueId)) {
    return true;
  }

  return cluster.venueId !== cloudVenueId && cluster.slug === "main";
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

export async function resolveCloudVenueIdForClusterOps({
  selectedVenueId,
  actor = null,
  assigneeUserId = null,
} = {}) {
  let fromSelected = sanitizeBillingTenantId(selectedVenueId);

  // Tránh nhầm id cụm sân (vd. venue-prod-main-pickleball-nam-long-sports) thành venue_id
  if (fromSelected && hasSupabaseConfig()) {
    const venueResult = await fetchSupabaseVenues();
    if (venueResult.ok && venueResult.venues?.length) {
      const exact = venueResult.venues.find((venue) => venue.id === fromSelected);
      if (!exact) {
        const prefixMatch = venueResult.venues.find(
          (venue) =>
            fromSelected === venue.id ||
            fromSelected.startsWith(`${venue.id}-`)
        );
        fromSelected = prefixMatch?.id || null;
      }
    }
  }

  if (fromSelected) {
    return fromSelected;
  }

  const fromActor = sanitizeBillingTenantId(actor?.venueId || actor?.tenantId);
  if (fromActor) {
    return fromActor;
  }

  if (assigneeUserId && isValidProfileUserId(assigneeUserId)) {
    const profileResult = await fetchProfileByUserId(assigneeUserId);
    const fromAssignee = sanitizeBillingTenantId(profileResult?.user?.venueId);
    if (fromAssignee) {
      return fromAssignee;
    }
  }

  if (!hasSupabaseConfig()) {
    return null;
  }

  const venueResult = await fetchSupabaseVenues();
  if (!venueResult.ok || !venueResult.venues?.length) {
    return null;
  }

  if (venueResult.venues.length === 1) {
    return venueResult.venues[0].id;
  }

  const selectedName = String(selectedVenueId || "").trim().toLowerCase();
  if (selectedName) {
    const matched = venueResult.venues.find((venue) =>
      String(venue.name || "")
        .toLowerCase()
        .includes(selectedName)
    );
    if (matched?.id) {
      return matched.id;
    }
  }

  return venueResult.venues[0]?.id || null;
}
