import { normalizeUser, USER_STATUS } from "../models/user.js";
import { ROLES, denormalizeRoleForDb } from "./roles.js";
import { formatAuthError } from "./authErrors.js";
import { getSupabaseAuthClient, PROFILES_TABLE } from "./supabaseClient.js";
import { isSecureRuntime } from "./runtime.js";
import { resolveAssignedClusterIdsForUser } from "../features/court-cluster/services/courtClusterService.js";
import { projectCanonicalActorFromProfileRow } from "../features/identity/services/canonicalActorProjection.js";

/**
 * Mapping auth.users ↔ public.profiles (docs/supabase-rbac.sql).
 * userId = profiles.id = auth.users.id
 */
export const PROFILE_FIELD_MAP = Object.freeze({
  userId: "id",
  email: "email",
  displayName: "display_name",
  role: "role",
  clubId: "club_id",
  tenantId: "tenant_id",
  venueId: "venue_id",
  status: "status",
});

export function mapProfileRowToUser(row) {
  if (!row) {
    return null;
  }

  return projectCanonicalActorFromProfileRow(row, {
    assignedClusterIds: resolveAssignedClusterIdsForUser({ id: row.id }),
  });
}

export function mapAuthUserFallback(authUser, metadata = {}) {
  return normalizeUser({
    id: authUser.id,
    email: authUser.email || "",
    displayName: metadata.display_name || metadata.displayName || authUser.email || "",
    role: metadata.role || "",
    tenantId: metadata.tenant_id || metadata.tenantId || null,
    venueId: metadata.venue_id || metadata.venueId || null,
    clubId: metadata.club_id || metadata.clubId || null,
    playerId: metadata.player_id || metadata.playerId || null,
    status: metadata.status || "",
    identityIncomplete: !metadata.status,
    mustChangePassword: Boolean(metadata.must_change_password ?? metadata.mustChangePassword),
  });
}

/** Trường user được tự sửa (RLS + trigger v3.5.7 / Phase 31 demographics). */
export const SELF_EDITABLE_PROFILE_FIELDS = Object.freeze([
  "display_name",
  "player_id",
  "phone",
  "avatar_url",
  "gender",
  "birth_year",
]);

export function mapUserToSelfProfilePatch(user) {
  const normalized = normalizeUser(user);
  if (!normalized.id) {
    return null;
  }

  return {
    display_name: normalized.displayName,
    player_id: normalized.playerId,
    phone: normalized.phone || "",
    avatar_url: normalized.avatarUrl || "",
    gender: normalized.gender || null,
    birth_year: normalized.birthYear ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** Chuẩn bị row profiles từ user app (staff invite / admin). */
export function mapUserToProfileRow(user) {
  const normalized = normalizeUser(user);
  if (!normalized.id) {
    return null;
  }

  return {
    id: normalized.id,
    email: normalized.email,
    display_name: normalized.displayName,
    role: denormalizeRoleForDb(normalized.role || ROLES.PLAYER),
    tenant_id: normalized.tenantId || null,
    venue_id: normalized.venueId || null,
    club_id: normalized.clubId,
    player_id: normalized.playerId,
    status: normalized.status || "active",
    must_change_password: Boolean(normalized.mustChangePassword),
    updated_at: new Date().toISOString(),
  };
}

export async function fetchProfileByUserId(userId) {
  const client = getSupabaseAuthClient();

  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const { data, error } = await client
    .from(PROFILES_TABLE)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, code: "PROFILE_FETCH_FAILED" };
  }

  if (!data) {
    return { ok: false, error: "Không tìm thấy profile.", code: "PROFILE_NOT_FOUND" };
  }

  const user = mapProfileRowToUser(data);
  if (!user.role) {
    return { ok: false, error: "Profile thiếu role.", code: "PROFILE_INVALID" };
  }

  return { ok: true, user, profile: data };
}

export async function upsertProfileRow(profile) {
  const client = getSupabaseAuthClient();

  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const { data, error } = await client
    .from(PROFILES_TABLE)
    .upsert(profile, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message, code: "PROFILE_UPSERT_FAILED" };
  }

  return { ok: true, user: mapProfileRowToUser(data), profile: data };
}

/**
 * Self-profile UPDATE only (no INSERT path). Avoids upsert RLS failures on Production
 * when profiles_self_insert is not granted to authenticated self-updates.
 */
export async function updateProfileRowById(userId, patch) {
  const client = getSupabaseAuthClient();

  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const targetId = String(userId || "").trim();
  if (!targetId) {
    return { ok: false, error: "Thiếu user id.", code: "INVALID_USER" };
  }

  const { data, error } = await client
    .from(PROFILES_TABLE)
    .update(patch)
    .eq("id", targetId)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message, code: "PROFILE_UPDATE_FAILED" };
  }

  return { ok: true, user: mapProfileRowToUser(data), profile: data };
}

/**
 * Quyết định user app từ Supabase auth + profile row.
 * RBAC bật → bắt buộc profile hợp lệ (không fallback PLAYER/metadata).
 */
export function resolveAuthUserFromProfile(authUser, profileResult, { rbacEnabled = false } = {}) {
  const enforceProfile = rbacEnabled || isSecureRuntime();

  if (profileResult.ok) {
    const actor = profileResult.user;
    if (enforceProfile && (actor.identityIncomplete || !actor.status)) {
      return {
        ok: false,
        error: "Hồ sơ thiếu trạng thái định danh.",
        code: "IDENTITY_INCOMPLETE",
      };
    }
    if (enforceProfile && actor.status !== USER_STATUS.ACTIVE) {
      return {
        ok: false,
        error: "Tài khoản chưa được kích hoạt hoặc đã bị khóa.",
        code: "PROFILE_SUSPENDED",
      };
    }

    return { ok: true, user: actor, provider: "supabase" };
  }

  if (enforceProfile) {
    return {
      ok: false,
      error: formatAuthError(profileResult.error, profileResult.code),
      code: profileResult.code || "PROFILE_REQUIRED",
    };
  }

  const fallback = mapAuthUserFallback(authUser, authUser.user_metadata || {});
  if (!fallback.role) {
    fallback.role = ROLES.PLAYER;
  }

  return {
    ok: true,
    user: fallback,
    provider: "supabase",
    warning: profileResult.code === "PROFILE_NOT_FOUND" ? "Dùng metadata fallback" : null,
  };
}
