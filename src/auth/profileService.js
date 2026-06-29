import { normalizeUser } from "../models/user.js";
import { getSupabaseAuthClient, PROFILES_TABLE } from "./supabaseClient.js";

export function mapProfileRowToUser(row) {
  if (!row) {
    return null;
  }

  return normalizeUser({
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.displayName || "",
    role: row.role,
    venueId: row.venue_id || row.venueId || null,
    clubId: row.club_id || row.clubId || null,
    playerId: row.player_id || row.playerId || null,
    status: row.status || "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapAuthUserFallback(authUser, metadata = {}) {
  return normalizeUser({
    id: authUser.id,
    email: authUser.email || "",
    displayName: metadata.display_name || metadata.displayName || authUser.email || "",
    role: metadata.role || "",
    venueId: metadata.venue_id || metadata.venueId || null,
    clubId: metadata.club_id || metadata.clubId || null,
    playerId: metadata.player_id || metadata.playerId || null,
    status: "active",
  });
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
