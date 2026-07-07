import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isClubScopedRole, isVenueScopedRole } from "../../../auth/roles.js";
import { loadVenues, saveVenues } from "../../../data/venue.js";
import { normalizeTenant, TENANT_STATUS } from "../../../models/tenant.js";
import { sanitizeBillingTenantId } from "../../billing/services/billingTenantResolver.js";
import { validateBillingTenantOnSupabase } from "../../billing/services/billingVenueService.js";
import { getTenantById } from "./tenantService.js";
import { resolveTenantIdFromUser } from "../guards/tenantGuard.js";

/**
 * profiles.venue_id is the billing/RLS tenant id on Supabase staging/production.
 * Local venue registry (pickleball-venues-v1) may not contain that row yet.
 */
export function canTrustProfileVenue(user, tenantId) {
  const resolvedId = sanitizeBillingTenantId(tenantId);
  const profileVenueId = sanitizeBillingTenantId(resolveTenantIdFromUser(user));

  if (!resolvedId || !profileVenueId || !user || !hasSupabaseConfig()) {
    return false;
  }

  return profileVenueId === resolvedId;
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
 * Fetch venues.id from Supabase and mirror into local registry (display/bootstrap only).
 */
export async function hydrateProfileVenueToLocalRegistry(tenantId) {
  const id = sanitizeBillingTenantId(tenantId);
  if (!id || !hasSupabaseConfig()) {
    return { ok: false, code: "NO_SUPABASE" };
  }

  if (getTenantById(id)) {
    return { ok: true, hydrated: false, tenantId: id };
  }

  const lookup = await validateBillingTenantOnSupabase(null, id);
  if (!lookup.ok) {
    return lookup;
  }

  const venue = lookup.venue || { id };
  const status = String(venue.status || TENANT_STATUS.ACTIVE).toLowerCase();
  const tenant = normalizeTenant({
    id: venue.id,
    name: venue.name || id,
    status:
      status === TENANT_STATUS.SUSPENDED
        ? TENANT_STATUS.SUSPENDED
        : status === TENANT_STATUS.INACTIVE
          ? TENANT_STATUS.INACTIVE
          : status === TENANT_STATUS.TRIAL
            ? TENANT_STATUS.TRIAL
            : TENANT_STATUS.ACTIVE,
  });

  const venues = loadVenues().filter((item) => item.id !== id);
  saveVenues([...venues, tenant]);

  return { ok: true, hydrated: true, tenantId: id, tenant };
}

export function resolveRouteAccessScope({ user, activeClubId, activeClub }) {
  const profileVenueId = sanitizeBillingTenantId(user?.venueId || user?.tenantId);
  const clubVenueId = sanitizeBillingTenantId(
    activeClub?.venueId || activeClub?.tenantId
  );
  const clubScoped = Boolean(user?.role && isClubScopedRole(user.role));
  const clubId = clubScoped
    ? user?.clubId || null
    : user?.clubId || activeClubId || null;
  const tournamentId = user?.tournamentId || user?.tournament_id || null;
  const teamId = user?.teamId || user?.team_id || null;

  if (user?.role && isVenueScopedRole(user.role) && profileVenueId) {
    return {
      clubId,
      venueId: profileVenueId,
      tenantId: profileVenueId,
      playerId: user?.playerId || null,
      tournamentId,
      teamId,
    };
  }

  const venueId = profileVenueId || clubVenueId || null;

  return {
    clubId: clubScoped ? clubId : clubId || activeClubId || null,
    venueId,
    tenantId: venueId,
    playerId: user?.playerId || null,
    tournamentId,
    teamId,
  };
}
