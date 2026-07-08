import { getCurrentUser } from "../../../auth/authService.js";
import { fetchProfileByUserId, upsertProfileRow } from "../../../auth/profileService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeUser } from "../../../models/user.js";
import { saveAuthSession } from "../../../auth/authStorage.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

const DEV_REGISTRY_KEY = "pickleball-dev-user-registry-v1";

function updateDevSelfProfile(userId, patch) {
  try {
    const raw = localStorage.getItem(DEV_REGISTRY_KEY);
    const registry = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(registry) ? registry : [];
    const idx = list.findIndex((item) => item.id === userId);
    if (idx < 0) {
      return null;
    }
    const next = normalizeUser({ ...list[idx], ...patch });
    list[idx] = next;
    localStorage.setItem(DEV_REGISTRY_KEY, JSON.stringify(list));
    return next;
  } catch {
    return null;
  }
}

export async function fetchSelfProfile() {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  if (hasSupabaseConfig()) {
    const result = await fetchProfileByUserId(user.id);
    if (!result.ok) {
      return result;
    }

    const profile = result.profile || {};
    return {
      ok: true,
      user: normalizeUser({
        ...result.user,
        phone: profile.phone || "",
        avatarUrl: profile.avatar_url || "",
        gender: profile.gender || "",
        birthYear: profile.birth_year ?? null,
      }),
    };
  }

  return {
    ok: true,
    user: normalizeUser({
      ...user,
      phone: user.phone || "",
      avatarUrl: user.avatarUrl || "",
    }),
  };
}

export async function updateSelfProfile({ displayName, phone, avatarUrl } = {}) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  const patch = {
    displayName: displayName !== undefined ? String(displayName).trim() : user.displayName,
    phone: phone !== undefined ? String(phone).trim() : user.phone || "",
    avatarUrl: avatarUrl !== undefined ? String(avatarUrl).trim() : user.avatarUrl || "",
  };

  if (hasSupabaseConfig()) {
    const existing = await fetchProfileByUserId(user.id);
    if (!existing.ok) {
      return existing;
    }

    const row = {
      id: user.id,
      email: user.email,
      display_name: patch.displayName,
      phone: patch.phone,
      avatar_url: patch.avatarUrl,
      role: existing.profile?.role,
      venue_id: existing.profile?.venue_id,
      club_id: existing.profile?.club_id,
      player_id: existing.profile?.player_id,
      status: existing.profile?.status,
      updated_at: new Date().toISOString(),
    };

    const result = await upsertProfileRow(row);
    if (!result.ok) {
      return result;
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: "profile",
      resourceId: user.id,
    });

    const merged = normalizeUser({
      ...result.user,
      phone: patch.phone,
      avatarUrl: patch.avatarUrl,
    });
    saveAuthSession(merged, { provider: "supabase" });

    return {
      ok: true,
      user: merged,
    };
  }

  const devUpdated = updateDevSelfProfile(user.id, patch);
  const nextUser = normalizeUser({
    ...user,
    ...patch,
    ...(devUpdated || {}),
  });

  saveAuthSession(nextUser, { provider: "dev" });

  await writeAuditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resourceType: "profile",
    resourceId: user.id,
  });

  return { ok: true, user: nextUser };
}

export async function updateSelfDemographics({ gender, birthYear } = {}) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  const patch = {};
  if (gender !== undefined) {
    patch.gender = String(gender || "").trim() || null;
  }
  if (birthYear !== undefined) {
    const year = Number(birthYear);
    patch.birthYear = Number.isFinite(year) ? year : null;
  }

  if (!Object.keys(patch).length) {
    return { ok: true, user: normalizeUser(user) };
  }

  if (hasSupabaseConfig()) {
    const existing = await fetchProfileByUserId(user.id);
    if (!existing.ok) {
      return existing;
    }

    const row = {
      id: user.id,
      email: user.email,
      display_name: existing.profile?.display_name || user.displayName,
      phone: existing.profile?.phone || "",
      avatar_url: existing.profile?.avatar_url || "",
      role: existing.profile?.role,
      venue_id: existing.profile?.venue_id,
      club_id: existing.profile?.club_id,
      player_id: existing.profile?.player_id,
      status: existing.profile?.status,
      gender: patch.gender ?? existing.profile?.gender ?? null,
      birth_year: patch.birthYear ?? existing.profile?.birth_year ?? null,
      updated_at: new Date().toISOString(),
    };

    const result = await upsertProfileRow(row);
    if (!result.ok) {
      return result;
    }

    const merged = normalizeUser({
      ...result.user,
      gender: row.gender || "",
      birthYear: row.birth_year ?? null,
    });
    saveAuthSession(merged, { provider: "supabase" });
    return { ok: true, user: merged };
  }

  const devUpdated = updateDevSelfProfile(user.id, patch);
  const nextUser = normalizeUser({
    ...user,
    ...patch,
    ...(devUpdated || {}),
  });
  saveAuthSession(nextUser, { provider: "dev" });
  return { ok: true, user: nextUser };
}
