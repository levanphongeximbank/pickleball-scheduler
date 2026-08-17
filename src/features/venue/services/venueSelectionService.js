/**
 * Wave 3 — Venue selection / invalidation (physical resource family).
 * Club is NOT a venue child authority.
 */

import { clearActiveVenueId, loadActiveVenueId, saveActiveVenueId } from "../../../data/venueSession.js";
import { setActiveClusterId, getActiveClusterId, loadCourtClusters } from "../../../data/courtCluster.js";
import { listVenues } from "../../../domain/venueService.js";
import {
  clusterBelongsToVenue,
  filterVenuesForSelectedTenant,
  trimScopeId,
  venueBelongsToTenant,
} from "../../../core/platform/app/tenantVenueIdentity.js";
import {
  logPlatformContextEvent,
  PLATFORM_CONTEXT_EVENT,
} from "../../../core/platform/app/platformContextDiagnostics.js";
import { ensureTenantVenueLocalBootstrap } from "./tenantVenueBootstrap.js";

export function listVenuesForTenant(tenantId) {
  ensureTenantVenueLocalBootstrap();
  return filterVenuesForSelectedTenant(listVenues(), tenantId);
}

export function getVenueByIdForTenant(venueId, tenantId) {
  const id = trimScopeId(venueId);
  if (!id) return null;
  const venue = listVenues().find((row) => row.id === id) || null;
  if (!venue) return null;
  if (tenantId && !venueBelongsToTenant(venue, tenantId)) {
    return null;
  }
  return venue;
}

/**
 * Tenant switch: clear venue if it does not belong to next tenant; always clear cluster.
 */
export function invalidatePhysicalResourceForTenantSwitch(nextTenantId) {
  const tenantId = trimScopeId(nextTenantId);
  const preferredVenueId = loadActiveVenueId();
  let venueInvalidated = false;

  if (preferredVenueId) {
    const venue = getVenueByIdForTenant(preferredVenueId, tenantId);
    if (!tenantId || !venue) {
      clearActiveVenueId();
      venueInvalidated = true;
    }
  }

  setActiveClusterId(null);

  return {
    venueInvalidated,
    preferredVenueId: venueInvalidated ? null : preferredVenueId || null,
  };
}

/**
 * Venue switch: clear cluster (and court selection is page-local).
 * Must NOT mutate tenant or club identity.
 */
export function invalidatePhysicalResourceForVenueSwitch() {
  setActiveClusterId(null);
  return { clusterCleared: true };
}

/**
 * Club switch: never rewrite tenant/venue/cluster identities.
 * Clear cluster only when current cluster is proven invalid for selected venue
 * or explicit club.registeredClusterId conflicts.
 */
export function revalidatePhysicalResourceAccessForClubSwitch({
  club = null,
  selectedVenueId = null,
  selectedTenantId = null,
} = {}) {
  const venueId = trimScopeId(selectedVenueId);
  const activeClusterId = getActiveClusterId();
  if (!activeClusterId) {
    return { clearCluster: false, reason: null };
  }

  const clusters = loadCourtClusters();
  const cluster = clusters.find((row) => row.id === activeClusterId) || null;
  if (!clusterBelongsToVenue(cluster, venueId, selectedTenantId)) {
    setActiveClusterId(null);
    return { clearCluster: true, reason: "CLUSTER_VENUE_MISMATCH" };
  }

  const registeredClusterId = trimScopeId(
    club?.registeredClusterId ?? club?.registered_cluster_id
  );
  if (registeredClusterId && registeredClusterId !== activeClusterId) {
    // Explicit club↔cluster binding conflicts with current selection.
    setActiveClusterId(null);
    return { clearCluster: true, reason: "CLUB_CLUSTER_ACCESS_CONFLICT" };
  }

  return { clearCluster: false, reason: null };
}

export function commitVenueSwitch({
  venueId,
  tenantId,
  user = null,
  catalog = null,
} = {}) {
  const nextVenueId = trimScopeId(venueId);
  const nextTenantId = trimScopeId(tenantId);
  if (!nextVenueId) {
    return { ok: false, error: "Venue không hợp lệ.", code: "VENUE_INVALID" };
  }
  if (!nextTenantId) {
    return { ok: false, error: "Tenant chưa chọn — không thể chọn venue.", code: "TENANT_REQUIRED" };
  }

  const venues = Array.isArray(catalog) ? catalog : listVenuesForTenant(nextTenantId);
  const venue = venues.find((row) => row.id === nextVenueId) || null;
  if (!venue || !venueBelongsToTenant(venue, nextTenantId)) {
    return { ok: false, error: "Venue không thuộc tenant đang chọn.", code: "VENUE_TENANT_MISMATCH" };
  }

  if (!user?.id) {
    return { ok: false, error: "Cần phiên người dùng để lưu venue.", code: "AUTH_REQUIRED" };
  }

  saveActiveVenueId(nextVenueId, user.id, { tenantId: nextTenantId });
  invalidatePhysicalResourceForVenueSwitch();

  logPlatformContextEvent(PLATFORM_CONTEXT_EVENT.EXPLICIT_VENUE_SWITCH, {
    hasNextVenue: true,
  });

  return { ok: true, venueId: nextVenueId, tenantId: nextTenantId, venue };
}

export function resolveActiveVenueId({
  user = null,
  selectedTenantId = null,
  venues = null,
} = {}) {
  const tenantId = trimScopeId(selectedTenantId);
  if (!tenantId) {
    return null;
  }
  const catalog = Array.isArray(venues) ? venues : listVenuesForTenant(tenantId);
  const preferred = loadActiveVenueId(user?.id);
  if (preferred && catalog.some((row) => row.id === preferred && venueBelongsToTenant(row, tenantId))) {
    return preferred;
  }

  // Profile home venue when it belongs to selected tenant.
  const homeVenueId = trimScopeId(user?.venueId);
  if (homeVenueId && catalog.some((row) => row.id === homeVenueId && venueBelongsToTenant(row, tenantId))) {
    return homeVenueId;
  }

  // Deterministic 0/1 behavior: auto-select only when exactly one venue.
  if (catalog.length === 1) {
    return catalog[0].id;
  }

  return null;
}
