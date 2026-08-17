import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isClubScopedRole, isVenueScopedRole } from "../../../auth/roles.js";
import { loadVenues, saveVenues } from "../../../data/venue.js";
import { upsertTenantRecord } from "../../../data/tenantRegistry.js";
import { normalizeTenant, TENANT_STATUS } from "../../../models/tenant.js";
import { normalizeVenue } from "../../../models/venue.js";
import { sanitizeBillingTenantId } from "../../billing/services/billingTenantResolver.js";
import {
  fetchSupabaseVenues,
  validateBillingTenantOnSupabase,
} from "../../billing/services/billingVenueService.js";
import { getTenantById } from "./tenantService.js";
import { resolveTenantIdFromUser } from "../guards/tenantGuard.js";
import { applyTeamPortalRouteScope } from "../../team-tournament/routing/teamPortalRouteScope.js";
import { stampLegacyVenueTenantId } from "../../../core/platform/app/legacyTenantVenueBridge.js";
import { ensureTenantVenueLocalBootstrap } from "../../venue/services/tenantVenueBootstrap.js";
import {
  PLATFORM_TENANT_MODE,
  isCloudCanonicalTenantAuthority,
  refreshPlatformTenantAuthority,
} from "../../../core/platform/app/platformTenantAuthority.js";

/**
 * profiles.venue_id is the actor home venue. Until Phase B, billing/RLS still
 * keys many policies by venue id; Wave 3 treats that as provisional tenant bridge.
 */
export function canTrustProfileVenue(user, tenantId) {
  const resolvedId = sanitizeBillingTenantId(tenantId);
  const profileTenantId = sanitizeBillingTenantId(
    user?.tenantId || resolveTenantIdFromUser(user)
  );

  if (!resolvedId || !profileTenantId || !user || !hasSupabaseConfig()) {
    return false;
  }

  return profileTenantId === resolvedId;
}

export function buildProfileBackedTenant(tenantId, user) {
  const id = sanitizeBillingTenantId(tenantId);
  if (!id) {
    return null;
  }

  return normalizeTenant({
    id,
    name: String(user?.displayName || user?.email || id).trim() || id,
    status: TENANT_STATUS.ACTIVE,
    ownerUserId: user?.id || null,
  });
}

export function resolveTenantRecord(tenantId, user = null) {
  const local = getTenantById(tenantId);
  if (local) {
    return local;
  }

  if (canTrustProfileVenue(user, tenantId)) {
    return buildProfileBackedTenant(tenantId, user);
  }

  return null;
}

/**
 * Fetch venues.id from Supabase and mirror into local venue registry + tenant registry.
 */
export async function hydrateProfileVenueToLocalRegistry(tenantId) {
  const id = sanitizeBillingTenantId(tenantId);
  if (!id || !hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE" };
  }

  if (getTenantById(id)) {
    return { ok: true, hydrated: false, tenantId: id };
  }

  if (isCloudCanonicalTenantAuthority()) {
    return { ok: false, code: "TENANT_NOT_FOUND", tenantId: id };
  }

  const lookup = await validateBillingTenantOnSupabase(null, id);
  if (!lookup.ok) {
    return lookup;
  }

  const venueRow = lookup.venue || { id };
  const status = String(venueRow.status || TENANT_STATUS.ACTIVE).toLowerCase();
  const tenant = normalizeTenant({
    id,
    name: venueRow.name || id,
    status:
      status === TENANT_STATUS.SUSPENDED
        ? TENANT_STATUS.SUSPENDED
        : status === TENANT_STATUS.INACTIVE
          ? TENANT_STATUS.INACTIVE
          : status === TENANT_STATUS.TRIAL
            ? TENANT_STATUS.TRIAL
            : TENANT_STATUS.ACTIVE,
  });
  upsertTenantRecord(tenant);

  // Pre-Phase-B cloud venues have no tenant_id column — bridge stamps tenantId = venue.id.
  const venue = normalizeVenue(
    stampLegacyVenueTenantId({
      id: venueRow.id || id,
      tenantId: venueRow.tenant_id || id,
      name: venueRow.name || id,
      status: tenant.status,
      timezone: venueRow.timezone,
      ownerId: venueRow.owner_id || venueRow.ownerId,
      note: venueRow.note,
    })
  );

  const venues = loadVenues().filter((item) => item.id !== venue.id);
  saveVenues([...venues, venue]);
  ensureTenantVenueLocalBootstrap();

  return { ok: true, hydrated: true, tenantId: id, tenant, venue };
}

function mapSupabaseVenueStatus(raw) {
  const status = String(raw || TENANT_STATUS.ACTIVE).toLowerCase();
  if (status === TENANT_STATUS.SUSPENDED) {
    return TENANT_STATUS.SUSPENDED;
  }
  if (status === TENANT_STATUS.INACTIVE) {
    return TENANT_STATUS.INACTIVE;
  }
  if (status === TENANT_STATUS.TRIAL) {
    return TENANT_STATUS.TRIAL;
  }
  return TENANT_STATUS.ACTIVE;
}

/**
 * Phase 42L / Wave 3 — mirror Supabase public.venues into local venue registry.
 * Tenant identity hydrates from public.platform_tenants when that schema is
 * readable. Venue rows must not invent a second Tenant authority.
 */
export async function hydrateSupabaseVenuesToLocalRegistry(client) {
  if (!hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE", tenantIds: [], venues: [] };
  }

  const tenantAuthority = await refreshPlatformTenantAuthority();
  const cloudCanonical = Boolean(tenantAuthority?.claimedCloud);

  const result = await fetchSupabaseVenues(client);
  if (!result.ok) {
    return {
      ...result,
      tenantIds: cloudCanonical ? (tenantAuthority.tenants || []).map((row) => row.id) : [],
      venues: [],
      tenantAuthorityMode: tenantAuthority?.mode || PLATFORM_TENANT_MODE.UNPROBED,
      claimedCloud: cloudCanonical,
    };
  }

  const incoming = result.venues || [];
  if (!incoming.length && !cloudCanonical) {
    return {
      ok: true,
      hydrated: false,
      hydratedCount: 0,
      tenantIds: [],
      venues: [],
      tenantAuthorityMode: tenantAuthority?.mode || PLATFORM_TENANT_MODE.UNPROBED,
      claimedCloud: false,
    };
  }

  const merged = new Map(loadVenues().map((item) => [item.id, item]));
  let hydratedCount = 0;
  const tenantIds = new Set(
    cloudCanonical ? (tenantAuthority.tenants || []).map((row) => row.id) : []
  );

  for (const venue of incoming) {
    const id = sanitizeBillingTenantId(venue.id);
    if (!id) {
      continue;
    }

    const status = mapSupabaseVenueStatus(venue.status);
    const explicitTenantId = sanitizeBillingTenantId(venue.tenant_id || venue.tenantId);
    const tenantId = cloudCanonical
      ? explicitTenantId
      : explicitTenantId || id;
    if (tenantId && !cloudCanonical) {
      tenantIds.add(tenantId);
      upsertTenantRecord(
        normalizeTenant({
          id: tenantId,
          name: venue.name || tenantId,
          status,
        })
      );
    }

    const nextVenue = normalizeVenue(
      stampLegacyVenueTenantId({
        id,
        tenantId: tenantId || undefined,
        name: venue.name || id,
        status,
        timezone: venue.timezone,
        ownerId: venue.owner_id || venue.ownerId,
        note: venue.note,
      })
    );

    const prev = merged.get(id);
    if (
      !prev ||
      prev.name !== nextVenue.name ||
      prev.status !== nextVenue.status ||
      prev.tenantId !== nextVenue.tenantId
    ) {
      hydratedCount += 1;
    }
    merged.set(id, nextVenue);
  }

  saveVenues([...merged.values()]);
  ensureTenantVenueLocalBootstrap();

  return {
    ok: true,
    hydrated: hydratedCount > 0 || cloudCanonical,
    hydratedCount,
    tenantIds: [...tenantIds],
    venues: incoming,
    tenantAuthorityMode: tenantAuthority?.mode || PLATFORM_TENANT_MODE.UNPROBED,
    claimedCloud: cloudCanonical,
  };
}

export function resolveRouteAccessScope({
  user,
  activeClubId,
  activeClub,
  activeClusterId = null,
  pathname = null,
}) {
  const profileVenueId = sanitizeBillingTenantId(user?.venueId);
  const profileTenantId = sanitizeBillingTenantId(user?.tenantId);
  const clubVenueId = sanitizeBillingTenantId(activeClub?.venueId);
  const clubTenantId = sanitizeBillingTenantId(activeClub?.tenantId);
  const clubScoped = Boolean(user?.role && isClubScopedRole(user.role));
  const clubId = clubScoped
    ? user?.clubId || null
    : user?.clubId || activeClubId || null;
  const tournamentId = user?.tournamentId || user?.tournament_id || null;
  const teamId = user?.teamId || user?.team_id || null;
  const clusterId = activeClusterId || null;

  const tenantId = profileTenantId || clubTenantId || null;
  const venueId = profileVenueId || clubVenueId || null;

  if (user?.role && isVenueScopedRole(user.role) && (venueId || tenantId)) {
    return applyTeamPortalRouteScope(
      pathname,
      {
        clubId,
        venueId: venueId || null,
        tenantId: tenantId || null,
        clusterId,
        playerId: user?.playerId || null,
        tournamentId,
        teamId,
      },
      { user }
    );
  }

  return applyTeamPortalRouteScope(
    pathname,
    {
      clubId: clubScoped ? clubId : clubId || activeClubId || null,
      venueId,
      tenantId,
      clusterId,
      playerId: user?.playerId || null,
      tournamentId,
      teamId,
    },
    { user }
  );
}
