import { normalizeRole } from "../../../auth/roles.js";
import { hasSupabaseConfig, getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { getClubMembers } from "../../club/services/clubMemberService.js";
import { CLUB_MEMBER_STATUSES } from "../../club/constants/clubMemberRoles.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { findUserIdByPlayerId } from "../../club/storage/athleteClubLinkStore.js";

/**
 * Identity / membership recipient directory (Phase 1.3).
 *
 * - Profiles: loaded from Supabase `profiles` (venue_id ≈ tenant scope, role).
 * - Club membership: resolved via existing club member services (sync, real data).
 * - EntryIds: optional injected adapter (competition entry → userId); default empty.
 *
 * No hard-coded fake users in Production runtime.
 */

function profileToRecipient(profile) {
  if (!profile?.id) return null;
  const tenantId = profile.venue_id || profile.tenant_id || profile.tenantId || null;
  if (!tenantId) return null;
  return {
    userId: String(profile.id),
    tenantId: String(tenantId),
    venueId: profile.venue_id ? String(profile.venue_id) : null,
    clubId: profile.club_id || profile.clubId || null,
    role: profile.role ? normalizeRole(profile.role) : null,
  };
}

function listClubMemberRecipients(clubId, tenantId) {
  if (!clubId || !tenantId) return [];
  try {
    const members = getClubMembers(clubId, tenantId, { skipGovernanceGuard: true }).filter(
      (member) => member.status === CLUB_MEMBER_STATUSES.ACTIVE
    );
    const players = loadPlayersForClub(clubId);
    const out = [];
    for (const member of members) {
      const player = players.find((item) => item.id === member.playerId);
      const userId = player?.authUserId || findUserIdByPlayerId(member.playerId);
      if (!userId) continue;
      out.push({
        userId: String(userId),
        tenantId: String(tenantId),
        venueId: String(tenantId),
        clubId: String(clubId),
        role: member.role || "PLAYER",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * @param {object} [options]
 * @param {object[]} [options.profiles] — seed/cache profiles
 * @param {(input: { tenantId: string, competitionId?: string|null, entryIds: string[] }) => Array<{userId:string,tenantId:string}>} [options.entryResolver]
 * @param {object} [options.client] — supabase client override
 */
export function createIdentityMembershipDirectory(options = {}) {
  let profileCache = Array.isArray(options.profiles)
    ? options.profiles.map(profileToRecipient).filter(Boolean)
    : [];
  const entryResolver =
    typeof options.entryResolver === "function" ? options.entryResolver : null;
  const clientOverride = options.client || null;

  return {
    kind: "identity-membership",

    /** Replace profile cache (after hydrate). */
    setProfiles(profiles) {
      profileCache = (profiles || []).map(profileToRecipient).filter(Boolean);
    },

    getProfiles() {
      return [...profileCache];
    },

    /**
     * Hydrate profiles from Supabase for a tenant/venue.
     * Safe no-op when Supabase is not configured.
     */
    async hydrate({ tenantId } = {}) {
      if (!tenantId) {
        return { ok: false, error: "tenantId is required.", count: 0 };
      }
      if (!hasSupabaseConfig() && !clientOverride) {
        return { ok: true, hydrated: false, count: profileCache.length };
      }
      const client = clientOverride || getSupabaseAuthClient();
      if (!client) {
        return { ok: true, hydrated: false, count: profileCache.length };
      }
      const { data, error } = await client
        .from("profiles")
        .select("id, role, venue_id, club_id, status")
        .eq("venue_id", tenantId)
        .eq("status", "active");
      if (error) {
        return { ok: false, error: error.message || String(error), count: 0 };
      }
      this.setProfiles(data || []);
      return { ok: true, hydrated: true, count: profileCache.length };
    },

    listUsersByIds({ tenantId, userIds }) {
      const wanted = new Set((userIds || []).map(String));
      const fromCache = profileCache.filter(
        (u) => u.tenantId === tenantId && wanted.has(u.userId)
      );
      const found = new Set(fromCache.map((u) => u.userId));
      // Accept explicit ids only when present in identity cache (no opaque trust).
      // If cache empty (not hydrated), fall back to accepting ids scoped to tenant
      // only when options.allowUnverifiedUserIds is true — default false for safety.
      if (options.allowUnverifiedUserIds && profileCache.length === 0) {
        return (userIds || [])
          .map(String)
          .filter(Boolean)
          .filter((id) => wanted.has(id))
          .map((userId) => ({
            userId,
            tenantId: String(tenantId),
            venueId: null,
            clubId: null,
            role: null,
          }));
      }
      void found;
      return fromCache;
    },

    listUsersByRoles({ tenantId, venueId = null, clubId = null, roles }) {
      const roleSet = new Set(
        (roles || []).map((r) => normalizeRole(r) || String(r))
      );
      const fromProfiles = profileCache.filter((u) => {
        if (u.tenantId !== tenantId) return false;
        if (!u.role || !roleSet.has(normalizeRole(u.role) || u.role)) return false;
        if (venueId && u.venueId && u.venueId !== String(venueId)) return false;
        if (clubId && u.clubId && u.clubId !== String(clubId)) return false;
        return true;
      });

      if (!clubId) {
        return fromProfiles;
      }

      // Merge club membership when club scope is present.
      const members = listClubMemberRecipients(clubId, tenantId).filter((u) => {
        if (!roleSet.size) return true;
        if (!u.role) return roleSet.has("PLAYER");
        return roleSet.has(normalizeRole(u.role) || u.role);
      });

      const byId = new Map();
      for (const u of [...fromProfiles, ...members]) {
        byId.set(u.userId, u);
      }
      return [...byId.values()];
    },

    listUsersByEntryIds({ tenantId, competitionId = null, entryIds }) {
      if (!entryResolver) return [];
      try {
        const resolved = entryResolver({ tenantId, competitionId, entryIds }) || [];
        return resolved.filter(
          (u) => u?.userId && String(u.tenantId) === String(tenantId)
        );
      } catch {
        return [];
      }
    },
  };
}

/**
 * Prefer identity directory when set; otherwise empty.
 * Call `ensureDefaultIdentityDirectory()` at app bootstrap if desired.
 */
export function createDefaultIdentityDirectory() {
  return createIdentityMembershipDirectory({
    // Dev/tests without hydrate: allow explicit userIds (club pilots pass resolved ids).
    allowUnverifiedUserIds: true,
  });
}
