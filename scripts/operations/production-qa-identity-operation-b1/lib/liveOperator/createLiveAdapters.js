/**
 * Narrow Operation B1 live adapters — Auth Admin ban/unban + conditional profile status only.
 * No deleteUser, no unrelated table writers, no arbitrary SQL.
 */

import {
  AUTH_UNBAN_DURATION,
  QUARANTINE_BAN_DURATION,
  QUARANTINE_PROFILE_STATUS,
} from "./constants.js";
import { sanitizeError } from "./sanitize.js";

async function countExact(client, table, filters = []) {
  let q = client.from(table).select("*", { count: "exact", head: true });
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val);
  }
  const { count, error } = await q;
  if (error) throw error;
  return Number(count || 0);
}

/**
 * Resolve createClient from injected impl or already-installed @supabase/supabase-js.
 * Lazy-loaded so dry-run / unit tests never construct a network client by default.
 */
export async function resolveSupabaseCreateClient(createClientImpl) {
  if (typeof createClientImpl === "function") return createClientImpl;
  const mod = await import("@supabase/supabase-js");
  return mod.createClient;
}

/**
 * @param {{ url: string, secretKey: string, createClientImpl?: Function }} opts
 */
export async function createOperationB1AdminClient(opts) {
  const create = await resolveSupabaseCreateClient(opts.createClientImpl);
  return create(opts.url, opts.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Build package-compatible adapters. Mutation writers require a real admin client.
 * @param {{ admin: any }} input
 */
export function createOperationB1LiveAdapters({ admin }) {
  if (!admin) {
    throw new Error("admin_client_required");
  }

  async function fetchProfile(profileId) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,status")
      .eq("id", profileId)
      .maybeSingle();
    if (error) return null;
    return data || null;
  }

  async function fetchAuthBanState(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const bannedUntil = data.user.banned_until;
    if (!bannedUntil) return false;
    return new Date(bannedUntil).getTime() > Date.now();
  }

  async function fetchReferenceCounts(profileId) {
    const id = profileId;
    const athlete_count = await countExact(admin, "athletes", [
      { op: "eq", col: "user_id", val: id },
    ]);
    const membership_active = await countExact(admin, "club_members", [
      { op: "eq", col: "user_id", val: id },
      { op: "eq", col: "status", val: "active" },
    ]);
    const membership_removed = await countExact(admin, "club_members", [
      { op: "eq", col: "user_id", val: id },
      { op: "eq", col: "status", val: "removed" },
    ]);
    const membership_total = await countExact(admin, "club_members", [
      { op: "eq", col: "user_id", val: id },
    ]);
    const tenant_members = await countExact(admin, "tenant_members", [
      { op: "eq", col: "user_id", val: id },
    ]);
    const tenants_owned = await countExact(admin, "tenants", [
      { op: "eq", col: "owner_user_id", val: id },
    ]);
    const club_governance_owner = await countExact(admin, "clubs", [
      { op: "eq", col: "created_by_user_id", val: id },
    ]);
    return {
      athlete_count,
      membership_active,
      membership_removed,
      membership_total,
      tenant_members,
      tenants_owned,
      club_governance_owner,
      tournament_refs: 0,
      rating_refs: 0,
      finance_refs: 0,
      other_business_refs: 0,
    };
  }

  /**
   * Conditional profile status update with exact-one-row assertion.
   */
  async function updateProfileStatus({
    profileId,
    email,
    status,
    expectedCurrentStatus,
  }) {
    try {
      let q = admin
        .from("profiles")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", profileId);

      if (expectedCurrentStatus !== undefined && expectedCurrentStatus !== null) {
        q = q.eq("status", expectedCurrentStatus);
      }
      if (email) {
        q = q.eq("email", email);
      }

      const { data, error } = await q.select("id,status,email");
      if (error) {
        return { ok: false, reason: sanitizeError(error).reason };
      }
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      if (rows.length === 0) {
        return { ok: false, reason: "profile_zero_row_update" };
      }
      if (rows.length !== 1) {
        return { ok: false, reason: "profile_multiple_row_update" };
      }
      if (String(rows[0].status) !== String(status)) {
        return { ok: false, reason: "profile_status_verify_failed" };
      }
      return { ok: true, row: rows[0] };
    } catch (err) {
      return sanitizeError(err);
    }
  }

  async function banAuthUser({ userId, banDuration, reason }) {
    try {
      const duration = banDuration || QUARANTINE_BAN_DURATION;
      if (duration !== QUARANTINE_BAN_DURATION) {
        return { ok: false, reason: "unapproved_ban_duration" };
      }
      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: duration,
      });
      if (error) return { ok: false, reason: sanitizeError(error).reason };
      const bannedUntil = data?.user?.banned_until;
      const banned =
        bannedUntil && new Date(bannedUntil).getTime() > Date.now();
      if (!banned) {
        return { ok: false, reason: "auth_ban_verify_failed" };
      }
      return { ok: true, reason: reason || null };
    } catch (err) {
      return sanitizeError(err);
    }
  }

  async function unbanAuthUser({ userId }) {
    try {
      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: AUTH_UNBAN_DURATION,
      });
      if (error) return { ok: false, reason: sanitizeError(error).reason };
      const bannedUntil = data?.user?.banned_until;
      const stillBanned =
        bannedUntil && new Date(bannedUntil).getTime() > Date.now();
      if (stillBanned) {
        return { ok: false, reason: "auth_unban_verify_failed" };
      }
      return { ok: true };
    } catch (err) {
      return sanitizeError(err);
    }
  }

  const adapters = {
    admin,
    fetchProfile,
    fetchAuthBanState,
    fetchReferenceCounts,
    updateProfileStatus,
    banAuthUser,
    unbanAuthUser,
  };

  // Structural impossibility: no deleteUser / recreate surface.
  Object.defineProperty(adapters, "deleteUser", {
    enumerable: false,
    configurable: false,
    get() {
      throw new Error("hard_delete_not_permitted_for_operation_b1");
    },
  });

  return Object.freeze(adapters);
}

export { QUARANTINE_PROFILE_STATUS, QUARANTINE_BAN_DURATION, AUTH_UNBAN_DURATION };
