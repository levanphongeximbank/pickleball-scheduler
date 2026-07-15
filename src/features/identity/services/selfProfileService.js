import { getCurrentUser } from "../../../auth/authService.js";
import { fetchProfileByUserId, updateProfileRowById } from "../../../auth/profileService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeUser } from "../../../models/user.js";
import { saveAuthSession, saveAuthSessionFromCloudProfile } from "../../../auth/authStorage.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";
import {
  normalizeProfileGender,
  sanitizeProfileWritePayload,
  shouldLogProfileQa,
} from "../utils/profileGender.js";

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

function resolveBirthYear(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}

/** Self-editable columns only — never rewrite role/venue/status via upsert insert path. */
export function buildSelfProfileUpdatePatch(existingProfile, patch) {
  const nextGender =
    patch.gender !== undefined
      ? patch.gender
      : normalizeProfileGender(existingProfile?.gender) ?? existingProfile?.gender ?? null;

  const nextBirthYear =
    patch.birthYear !== undefined
      ? patch.birthYear
      : existingProfile?.birth_year ?? null;

  return {
    display_name: patch.displayName,
    phone: patch.phone,
    avatar_url: patch.avatarUrl,
    gender: nextGender,
    birth_year: nextBirthYear,
    updated_at: new Date().toISOString(),
  };
}

function logQaPayload(label, payload, result = null) {
  if (!shouldLogProfileQa() || typeof console === "undefined") {
    return;
  }
  console.info(`[profile-qa] ${label}`, {
    payload: sanitizeProfileWritePayload(payload),
    ok: result?.ok ?? null,
    code: result?.code ?? null,
    affected: result?.profile ? 1 : result?.ok ? 1 : 0,
    canonicalGender: result?.profile?.gender ?? result?.user?.gender ?? null,
    canonicalBirthYear: result?.profile?.birth_year ?? result?.user?.birthYear ?? null,
  });
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
    const gender = normalizeProfileGender(profile.gender) || profile.gender || "";
    return {
      ok: true,
      user: normalizeUser({
        ...result.user,
        phone: profile.phone || "",
        avatarUrl: profile.avatar_url || "",
        gender,
        birthYear: profile.birth_year ?? null,
      }),
      profile,
    };
  }

  return {
    ok: true,
    user: normalizeUser({
      ...user,
      phone: user.phone || "",
      avatarUrl: user.avatarUrl || "",
      gender: normalizeProfileGender(user.gender) || user.gender || "",
    }),
  };
}

export async function updateSelfProfile({
  displayName,
  phone,
  avatarUrl,
  gender,
  birthYear,
} = {}) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  const patch = {
    displayName: displayName !== undefined ? String(displayName).trim() : user.displayName,
    phone: phone !== undefined ? String(phone).trim() : user.phone || "",
    avatarUrl: avatarUrl !== undefined ? String(avatarUrl).trim() : user.avatarUrl || "",
  };

  if (gender !== undefined) {
    patch.gender = normalizeProfileGender(gender);
  }
  if (birthYear !== undefined) {
    patch.birthYear = resolveBirthYear(birthYear);
  }

  if (hasSupabaseConfig()) {
    const existing = await fetchProfileByUserId(user.id);
    if (!existing.ok) {
      return existing;
    }

    // Self-only mutation — never allow writing another user's id.
    if (String(existing.profile?.id || "") !== String(user.id)) {
      return { ok: false, error: "Không thể cập nhật hồ sơ người khác.", code: "FORBIDDEN" };
    }

    const row = buildSelfProfileUpdatePatch(existing.profile, patch);
    logQaPayload("updateSelfProfile:request", row);

    const result = await updateProfileRowById(user.id, row);
    logQaPayload("updateSelfProfile:response", row, result);
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
      phone: result.profile?.phone || patch.phone,
      avatarUrl: result.profile?.avatar_url || patch.avatarUrl,
      gender: normalizeProfileGender(result.profile?.gender) || result.profile?.gender || "",
      birthYear: result.profile?.birth_year ?? null,
    });
    // Replace session with canonical cloud row — avoid stale gender snapshot.
    saveAuthSessionFromCloudProfile(merged, { provider: "supabase" });

    return {
      ok: true,
      user: merged,
      profile: result.profile,
    };
  }

  const devUpdated = updateDevSelfProfile(user.id, patch);
  const nextUser = normalizeUser({
    ...user,
    ...patch,
    gender: patch.gender !== undefined ? patch.gender || "" : user.gender || "",
    birthYear: patch.birthYear !== undefined ? patch.birthYear : user.birthYear ?? null,
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
  return updateSelfProfile({ gender, birthYear });
}
