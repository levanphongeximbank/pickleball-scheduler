/**
 * DP-07 — Eligible canonical REFEREE directory for Daily Play roster selection.
 *
 * Reuses existing identity authority (profiles + optional identity_list_users).
 * Does NOT invent a parallel referee identity table or expose auth secrets.
 *
 * Tenant binding: profiles.venue_id (= app tenantId).
 * Role authority: profiles.role = REFEREE (normalized).
 * Club filter: when clubId is set, keep venue-wide (club_id null) or matching club.
 */

import { getCurrentUser } from "../../../auth/authService.js";
import { can } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";
import { ROLES, normalizeRole, denormalizeRoleForDb } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  getSupabaseAuthClient,
  hasSupabaseConfig,
  PROFILES_TABLE,
} from "../../../auth/supabaseClient.js";
import { rpcListUsers } from "../../identity/services/identityRpcService.js";

export const REFEREE_DIRECTORY_SOURCE = Object.freeze({
  PROFILES: "profiles_rls",
  IDENTITY_RPC: "identity_list_users",
  MERGED: "merged",
  UNAVAILABLE: "unavailable",
});

function trimSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesSearch(candidate, search) {
  const q = trimSearch(search);
  if (!q) return true;
  const haystack = [candidate.displayName, candidate.email, candidate.phone]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
  return haystack.includes(q);
}

function isClubEligible(candidate, clubId) {
  if (!clubId) return true;
  if (!candidate.clubId) return true;
  return String(candidate.clubId) === String(clubId);
}

/**
 * Normalize a profile / identity user row into a safe selection candidate.
 * Never includes passwords, tokens, or session claims.
 */
export function normalizeCanonicalRefereeCandidate(row, tenantId) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const userId = String(row.id || row.userId || "").trim();
  if (!userId) {
    return null;
  }

  const role = normalizeRole(row.role || row.Role || "");
  if (role !== ROLES.REFEREE) {
    return null;
  }

  const status = String(row.status || "active").toLowerCase();
  if (status && status !== "active") {
    return null;
  }

  const rowTenantId = String(
    row.venue_id || row.venueId || row.tenant_id || row.tenantId || ""
  ).trim();
  if (tenantId && rowTenantId && rowTenantId !== String(tenantId)) {
    return null;
  }

  const displayName =
    String(row.display_name || row.displayName || "").trim() ||
    String(row.email || "").trim() ||
    "Trọng tài";

  return {
    userId,
    profileId: userId,
    displayName,
    email: String(row.email || "").trim(),
    phone: String(row.phone || "").trim(),
    tenantId: rowTenantId || String(tenantId || ""),
    clubId: row.club_id || row.clubId || null,
    role: ROLES.REFEREE,
    status: "active",
    hasAccount: true,
  };
}

export function filterCanonicalRefereeCandidates(
  candidates = [],
  { tenantId, clubId = null, search = "" } = {}
) {
  return (candidates || [])
    .map((row) => normalizeCanonicalRefereeCandidate(row, tenantId))
    .filter(Boolean)
    .filter((candidate) => !tenantId || candidate.tenantId === String(tenantId))
    .filter((candidate) => isClubEligible(candidate, clubId))
    .filter((candidate) => matchesSearch(candidate, search))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "vi")
    );
}

function mergeCandidates(primary = [], secondary = []) {
  const byId = new Map();
  for (const item of [...primary, ...secondary]) {
    if (!item?.userId) continue;
    byId.set(String(item.userId), item);
  }
  return [...byId.values()];
}

async function listFromProfiles({ tenantId, clubId, search, client }) {
  const query = client
    .from(PROFILES_TABLE)
    .select("id, email, display_name, phone, role, venue_id, club_id, status")
    .eq("venue_id", tenantId)
    .eq("status", "active")
    .eq("role", denormalizeRoleForDb(ROLES.REFEREE));

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message || String(error), candidates: [] };
  }

  const candidates = filterCanonicalRefereeCandidates(data || [], {
    tenantId,
    clubId,
    search,
  });
  return { ok: true, candidates, source: REFEREE_DIRECTORY_SOURCE.PROFILES };
}

async function listFromIdentityRpc({ tenantId, clubId, search }) {
  const rpcResult = await rpcListUsers({
    search: search || "",
    role: ROLES.REFEREE,
    status: "active",
    limit: 100,
  });

  if (!rpcResult.ok) {
    return {
      ok: false,
      code: rpcResult.code,
      error: rpcResult.error,
      candidates: [],
    };
  }

  const candidates = filterCanonicalRefereeCandidates(rpcResult.users || [], {
    tenantId,
    clubId,
    search,
  });
  return {
    ok: true,
    candidates,
    source: REFEREE_DIRECTORY_SOURCE.IDENTITY_RPC,
  };
}

/**
 * List eligible canonical REFEREE accounts for organizer selection.
 *
 * @param {{ tenantId: string, clubId?: string|null, search?: string, client?: object }} input
 */
export async function listEligibleCanonicalReferees(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const clubId = input.clubId ? String(input.clubId).trim() : null;
  const search = String(input.search || "").trim();

  const actor = input.actor || getCurrentUser();
  if (!actor?.id) {
    return {
      ok: false,
      code: "NOT_AUTHENTICATED",
      error: "Chưa đăng nhập.",
      referees: [],
      source: REFEREE_DIRECTORY_SOURCE.UNAVAILABLE,
    };
  }

  if (!tenantId) {
    return {
      ok: false,
      code: "TENANT_REQUIRED",
      error: "Thiếu tenant/venue để liệt kê trọng tài.",
      referees: [],
      source: REFEREE_DIRECTORY_SOURCE.UNAVAILABLE,
    };
  }

  // Defense: never list outside caller's venue when profile is venue-bound.
  const actorTenantId = String(actor.venueId || actor.tenantId || "").trim();
  if (
    actorTenantId &&
    actorTenantId !== tenantId &&
    normalizeRole(actor.role) !== ROLES.SUPER_ADMIN
  ) {
    return {
      ok: false,
      code: "CROSS_TENANT_DENIED",
      error: "Không được xem trọng tài ngoài tenant hiện tại.",
      referees: [],
      source: REFEREE_DIRECTORY_SOURCE.UNAVAILABLE,
    };
  }

  if (!hasSupabaseConfig() && !input.client) {
    return {
      ok: true,
      referees: [],
      source: REFEREE_DIRECTORY_SOURCE.UNAVAILABLE,
      warning:
        "Chưa kết nối identity — dùng mục Trọng tài khách / nhập tay nếu cần.",
    };
  }

  const client = input.client || getSupabaseAuthClient();
  if (!client) {
    return {
      ok: true,
      referees: [],
      source: REFEREE_DIRECTORY_SOURCE.UNAVAILABLE,
      warning:
        "Chưa kết nối identity — dùng mục Trọng tài khách / nhập tay nếu cần.",
    };
  }

  const profilesResult = await listFromProfiles({
    tenantId,
    clubId,
    search,
    client,
  });

  let referees = profilesResult.ok ? profilesResult.candidates : [];
  let source = profilesResult.ok
    ? REFEREE_DIRECTORY_SOURCE.PROFILES
    : REFEREE_DIRECTORY_SOURCE.UNAVAILABLE;
  let warning = profilesResult.ok
    ? null
    : profilesResult.error || "Không đọc được danh sách profiles.";

  const rbacOn = { rbacEnabled: isRbacEnabled() };
  const canManageUsers =
    !isRbacEnabled() ||
    can(actor, PERMISSIONS.USER_MANAGE, { venueId: tenantId }, rbacOn) ||
    normalizeRole(actor.role) === ROLES.SUPER_ADMIN;

  if (canManageUsers) {
    const rpcResult = await listFromIdentityRpc({ tenantId, clubId, search });
    if (rpcResult.ok) {
      referees = mergeCandidates(referees, rpcResult.candidates);
      source =
        profilesResult.ok && referees.length
          ? REFEREE_DIRECTORY_SOURCE.MERGED
          : REFEREE_DIRECTORY_SOURCE.IDENTITY_RPC;
      warning = null;
    } else if (!profilesResult.ok) {
      return {
        ok: false,
        code: rpcResult.code || "FORBIDDEN",
        error:
          rpcResult.error ||
          profilesResult.error ||
          "Không có quyền liệt kê tài khoản trọng tài.",
        referees: [],
        source: REFEREE_DIRECTORY_SOURCE.UNAVAILABLE,
      };
    }
  } else if (!profilesResult.ok) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error:
        "Không có quyền xem danh bạ trọng tài (cần quyền venue staff / quản lý người dùng).",
      referees: [],
      source: REFEREE_DIRECTORY_SOURCE.UNAVAILABLE,
    };
  }

  return {
    ok: true,
    referees,
    source,
    warning,
  };
}

/**
 * Annotate roster entries that reference a canonical user no longer eligible.
 */
export function annotateRosterEligibility(roster = [], eligibleCandidates = []) {
  const eligibleIds = new Set(
    (eligibleCandidates || []).map((item) => String(item.userId))
  );

  return (roster || []).map((entry) => {
    const canonicalUserId = String(
      entry.canonicalUserId || entry.refereeUserId || ""
    ).trim();
    if (!canonicalUserId) {
      return { ...entry, eligibility: entry.eligibility || "manual" };
    }
    if (eligibleIds.has(canonicalUserId)) {
      return { ...entry, eligibility: "eligible" };
    }
    return {
      ...entry,
      eligibility: "unavailable",
    };
  });
}
