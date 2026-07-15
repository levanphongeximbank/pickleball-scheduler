import { getPlayerGenderKey } from "../../../models/player.js";

/** Canonical values stored on public.profiles.gender (Phase 31). */
export const PROFILE_GENDER = Object.freeze({
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
});

export const PROFILE_GENDER_OPTIONS = Object.freeze([
  { value: PROFILE_GENDER.MALE, label: "Nam" },
  { value: PROFILE_GENDER.FEMALE, label: "Nữ" },
  { value: PROFILE_GENDER.OTHER, label: "Khác" },
]);

const FORM_VALUES = new Set(Object.values(PROFILE_GENDER));

/**
 * Normalize any UI/DB/assessment gender to profiles.gender canonical value.
 * Empty / unknown → null (clears column when business rule allows).
 */
export function normalizeProfileGender(value) {
  if (value == null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const key = getPlayerGenderKey(raw);
  if (key === "male" || key === "female" || key === "other") {
    return key;
  }

  return null;
}

/** RadioGroup / select value for profile form (never Vietnamese labels as values). */
export function toProfileGenderFormValue(value) {
  const normalized = normalizeProfileGender(value);
  return normalized && FORM_VALUES.has(normalized) ? normalized : "";
}

export function sanitizeProfileWritePayload(payload = {}) {
  const keys = Object.keys(payload || {}).sort();
  const out = {};
  for (const key of keys) {
    if (/token|password|secret|authorization/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    const value = payload[key];
    if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else {
      out[key] = typeof value;
    }
  }
  return out;
}

export function shouldLogProfileQa() {
  try {
    const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
    return Boolean(env.DEV || env.VITE_ENABLE_AUTH_DEBUG === "true");
  } catch {
    return false;
  }
}
