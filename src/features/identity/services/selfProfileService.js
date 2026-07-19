import { getCurrentUser } from "../../../auth/authService.js";
import { fetchProfileByUserId } from "../../../auth/profileService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeUser } from "../../../models/user.js";
import { saveAuthSession } from "../../../auth/authStorage.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";
import { normalizeProfileGender } from "../utils/profileGender.js";

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
  birthDate,
  handedness,
  activityRegion,
  privacySettings,
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
  if (birthDate !== undefined) patch.birthDate = birthDate;
  if (handedness !== undefined) patch.handedness = handedness;
  if (activityRegion !== undefined) patch.activityRegion = activityRegion;
  if (privacySettings !== undefined) patch.privacySettings = privacySettings;

  // Canonical authenticated runtime path — Player Management durable write (RLS/session).
  if (hasSupabaseConfig()) {
    const { updateAuthenticatedSelfPlayerProfile } = await import(
      "../../player/services/updateAuthenticatedSelfPlayerProfile.js"
    );
    return updateAuthenticatedSelfPlayerProfile(patch);
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
