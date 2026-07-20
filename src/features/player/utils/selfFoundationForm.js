/**
 * Phase 1G-A — Self foundation form helpers (Athlete edit surface).
 *
 * Canonical birth_date / birth_year rule:
 * - birthDate (YYYY-MM-DD) is authoritative when present.
 * - Changing birthDate always derives birthYear from that date (never invent date from year).
 * - birthYear alone is allowed when birthDate is empty.
 * - When both are present, years must match; conflict is rejected before save.
 * - Durable write path still re-validates via normalizeAndValidateWritePatch.
 */
import { DEFAULT_PRIVACY_SETTINGS, normalizePrivacySettings } from "../constants/privacy.js";
import { HANDEDNESS, HANDEDNESS_VALUES } from "../constants/handedness.js";
import { emptyActivityRegion, normalizeActivityRegion } from "../adapters/activityRegionAdapter.js";
import {
  deriveBirthYearForRead,
  validateBirthDate,
  validateBirthDateYearConsistency,
  validateBirthYear,
} from "./birthDate.js";
import { validateHandedness } from "../adapters/handednessAdapter.js";
import { validateActivityRegion } from "../adapters/activityRegionAdapter.js";
import { validatePrivacySettings } from "../constants/privacy.js";

export const SELF_FOUNDATION_PRIVACY_KEYS = Object.freeze([
  "publicProfileEnabled",
  "showPhone",
  "showEmail",
  "showBirthDate",
  "showBirthYear",
  "showActivityRegion",
  "showClubMemberships",
  "showGender",
  "showHandedness",
]);

export const SELF_FOUNDATION_PRIVACY_LABELS = Object.freeze({
  publicProfileEnabled: "Hồ sơ công khai",
  showPhone: "Hiện số điện thoại",
  showEmail: "Hiện email",
  showBirthDate: "Hiện ngày sinh",
  showBirthYear: "Hiện năm sinh",
  showActivityRegion: "Hiện khu vực hoạt động",
  showClubMemberships: "Hiện thành viên CLB",
  showGender: "Hiện giới tính",
  showHandedness: "Hiện tay thuận",
});

export const SELF_FOUNDATION_HANDEDNESS_OPTIONS = Object.freeze([
  { value: HANDEDNESS.RIGHT, label: "Tay phải" },
  { value: HANDEDNESS.LEFT, label: "Tay trái" },
  { value: HANDEDNESS.AMBIDEXTROUS, label: "Hai tay" },
  { value: HANDEDNESS.UNKNOWN, label: "Không rõ" },
]);

/**
 * @param {object|null|undefined} profile — normalizePlayerProfile output
 */
export function buildSelfFoundationFormState(profile) {
  const region = normalizeActivityRegion(profile?.activityRegion) || emptyActivityRegion();
  let privacy;
  try {
    privacy = profile?.privacySettings
      ? normalizePrivacySettings(profile.privacySettings)
      : { ...DEFAULT_PRIVACY_SETTINGS };
  } catch {
    privacy = { ...DEFAULT_PRIVACY_SETTINGS };
  }

  const birthDate = profile?.birthDate || "";
  const birthYear =
    profile?.birthYear != null
      ? String(profile.birthYear)
      : birthDate
        ? String(deriveBirthYearForRead(birthDate, null) || "")
        : "";

  return {
    birthDate: birthDate || "",
    birthYear,
    handedness: profile?.handedness || HANDEDNESS.UNKNOWN,
    activityRegion: {
      countryCode: region.countryCode || "",
      provinceCode: region.provinceCode || "",
      provinceName: region.provinceName || "",
      city: region.city || "",
      district: region.district || "",
    },
    privacySettings: { ...privacy },
  };
}

/**
 * When birthDate changes: derive birthYear from date (authoritative).
 * @param {string} birthDate
 * @param {string} previousBirthYear
 */
export function applyBirthDateChange(birthDate, previousBirthYear = "") {
  const nextDate = birthDate == null ? "" : String(birthDate).trim();
  if (!nextDate) {
    return { birthDate: "", birthYear: previousBirthYear };
  }
  const derived = deriveBirthYearForRead(nextDate, null);
  return {
    birthDate: nextDate,
    birthYear: derived != null ? String(derived) : previousBirthYear,
  };
}

/**
 * Client validate + build updateSelfProfile patch for foundation fields.
 * Strips any verification / privileged keys.
 *
 * @param {object} form
 * @returns {{ ok: true, patch: object } | { ok: false, error: string, code: string, errors: object[] }}
 */
export function buildSelfFoundationUpdatePatch(form) {
  const birthDateRaw = form?.birthDate === "" || form?.birthDate == null ? null : form.birthDate;
  const birthYearRaw =
    form?.birthYear === "" || form?.birthYear == null ? null : Number(form.birthYear);

  const birthDateResult = validateBirthDate(birthDateRaw);
  if (!birthDateResult.ok) {
    return {
      ok: false,
      code: birthDateResult.errors[0]?.code || "VALIDATION_ERROR",
      error: birthDateResult.errors[0]?.message || "Ngày sinh không hợp lệ.",
      errors: birthDateResult.errors,
    };
  }

  const birthYearResult = validateBirthYear(birthYearRaw);
  if (!birthYearResult.ok) {
    return {
      ok: false,
      code: birthYearResult.errors[0]?.code || "VALIDATION_ERROR",
      error: birthYearResult.errors[0]?.message || "Năm sinh không hợp lệ.",
      errors: birthYearResult.errors,
    };
  }

  // Authoritative date: if date present, force year from date before consistency check.
  let nextBirthDate = birthDateResult.value;
  let nextBirthYear = birthYearResult.value;
  if (nextBirthDate) {
    nextBirthYear = deriveBirthYearForRead(nextBirthDate, null);
  }

  const consistency = validateBirthDateYearConsistency(nextBirthDate, nextBirthYear);
  if (!consistency.ok) {
    return {
      ok: false,
      code: consistency.errors[0]?.code || "BIRTH_DATE_YEAR_CONFLICT",
      error: "Năm sinh không khớp với ngày sinh.",
      errors: consistency.errors,
    };
  }

  const handednessResult = validateHandedness(form?.handedness, { strict: true });
  if (!handednessResult.ok) {
    return {
      ok: false,
      code: handednessResult.errors[0]?.code || "VALIDATION_ERROR",
      error: handednessResult.errors[0]?.message || "Tay thuận không hợp lệ.",
      errors: handednessResult.errors,
    };
  }

  const regionInput = form?.activityRegion;
  const regionPayload =
    regionInput && typeof regionInput === "object"
      ? {
          countryCode: regionInput.countryCode || null,
          provinceCode: regionInput.provinceCode || null,
          provinceName: regionInput.provinceName || null,
          city: regionInput.city || null,
          district: regionInput.district || null,
        }
      : null;
  const regionResult = validateActivityRegion(regionPayload);
  if (!regionResult.ok) {
    return {
      ok: false,
      code: regionResult.errors[0]?.code || "VALIDATION_ERROR",
      error: regionResult.errors[0]?.message || "Khu vực hoạt động không hợp lệ.",
      errors: regionResult.errors,
    };
  }

  const privacyResult = validatePrivacySettings(form?.privacySettings);
  if (!privacyResult.ok) {
    return {
      ok: false,
      code: privacyResult.errors[0]?.code || "VALIDATION_ERROR",
      error: privacyResult.errors[0]?.message || "Cài đặt quyền riêng tư không hợp lệ.",
      errors: privacyResult.errors,
    };
  }

  const patch = {
    birthDate: nextBirthDate,
    birthYear: nextBirthYear,
    handedness: handednessResult.value,
    activityRegion: regionResult.value,
    privacySettings: privacyResult.value,
  };

  // Hard strip — never allow verification injection through this helper.
  delete patch.verificationStatus;
  delete patch.identityVerificationStatus;
  delete patch.identity_verification_status;

  return { ok: true, patch, errors: [] };
}

/**
 * Reject patches that attempt to set verification fields (defense in depth for callers).
 * @param {object} patch
 */
export function stripVerificationFromSelfPatch(patch = {}) {
  const next = { ...patch };
  delete next.verificationStatus;
  delete next.identityVerificationStatus;
  delete next.identity_verification_status;
  return next;
}

export { HANDEDNESS_VALUES, HANDEDNESS };
