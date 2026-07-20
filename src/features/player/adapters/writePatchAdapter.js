/**
 * Normalize + validate a Player Management write patch.
 * Does not persist. Does not invent birthDate from birthYear.
 */
import { normalizePlayerGender } from "./genderAdapter.js";
import { validateHandedness } from "./handednessAdapter.js";
import { validateActivityRegion } from "./activityRegionAdapter.js";
import { validatePrivacySettings } from "../constants/privacy.js";
import {
  PLAYER_FORBIDDEN_WRITE_FIELDS,
  PLAYER_WRITABLE_FIELDS,
  WRITE_ERROR_CODES,
} from "../constants/writableFields.js";
import {
  deriveBirthYearForRead,
  validateBirthDate,
  validateBirthDateYearConsistency,
  validateBirthYear,
} from "../utils/birthDate.js";

/**
 * @param {object} patch
 * @param {object} [options]
 * @param {object|null} [options.existing] — existing profile for merge checks
 * @param {Date|string} [options.referenceDate]
 */
export function normalizeAndValidateWritePatch(patch, options = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.EMPTY_PATCH,
      errors: [{ code: WRITE_ERROR_CODES.EMPTY_PATCH, message: "patch must be an object" }],
      normalized: null,
      forbiddenFields: [],
    };
  }

  const keys = Object.keys(patch);
  if (keys.length === 0) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.EMPTY_PATCH,
      errors: [{ code: WRITE_ERROR_CODES.EMPTY_PATCH, message: "patch is empty" }],
      normalized: null,
      forbiddenFields: [],
    };
  }

  const forbiddenFields = keys.filter((k) => PLAYER_FORBIDDEN_WRITE_FIELDS.includes(k));
  // Also reject unknown non-writable keys (except explicit null clears of writable)
  const unknown = keys.filter(
    (k) => !PLAYER_WRITABLE_FIELDS.includes(k) && !PLAYER_FORBIDDEN_WRITE_FIELDS.includes(k)
  );
  if (forbiddenFields.length || unknown.length) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.FORBIDDEN_FIELD,
      errors: [...forbiddenFields, ...unknown].map((field) => ({
        code: WRITE_ERROR_CODES.FORBIDDEN_FIELD,
        field,
        message: `Field '${field}' is not writable via Player Management`,
      })),
      normalized: null,
      forbiddenFields: [...forbiddenFields, ...unknown],
    };
  }

  const errors = [];
  const normalized = {};
  const existing = options.existing || {};

  if ("displayName" in patch) {
    normalized.displayName =
      patch.displayName == null || patch.displayName === ""
        ? null
        : String(patch.displayName).trim();
  }
  if ("fullName" in patch) {
    normalized.fullName =
      patch.fullName == null || patch.fullName === "" ? null : String(patch.fullName).trim();
  }
  if ("phone" in patch) {
    normalized.phone =
      patch.phone == null || patch.phone === "" ? null : String(patch.phone).trim();
  }
  if ("avatarUrl" in patch) {
    normalized.avatarUrl =
      patch.avatarUrl == null || patch.avatarUrl === "" ? null : String(patch.avatarUrl).trim();
  }
  if ("gender" in patch) {
    if (patch.gender == null || patch.gender === "") {
      normalized.gender = null;
    } else {
      normalized.gender = normalizePlayerGender(patch.gender);
    }
  }
  if ("profileStatus" in patch) {
    const status = patch.profileStatus == null ? null : String(patch.profileStatus).trim().toLowerCase();
    if (status && !["active", "inactive", "archived"].includes(status)) {
      errors.push({
        code: WRITE_ERROR_CODES.VALIDATION_ERROR,
        field: "profileStatus",
        message: `Unsupported profileStatus: ${patch.profileStatus}`,
      });
    } else {
      normalized.profileStatus = status;
    }
  }

  let nextBirthDate = "birthDate" in patch ? patch.birthDate : existing.birthDate;
  let nextBirthYear = "birthYear" in patch ? patch.birthYear : existing.birthYear;

  if ("birthDate" in patch) {
    const r = validateBirthDate(patch.birthDate, options);
    if (!r.ok) errors.push(...r.errors);
    else {
      normalized.birthDate = r.value;
      nextBirthDate = r.value;
    }
  }

  if ("birthYear" in patch) {
    const r = validateBirthYear(patch.birthYear, options);
    if (!r.ok) errors.push(...r.errors);
    else {
      normalized.birthYear = r.value;
      nextBirthYear = r.value;
    }
  }

  // If only birthDate provided, derive birthYear for consistency — never invent birthDate from year
  if (
    "birthDate" in patch &&
    !("birthYear" in patch) &&
    normalized.birthDate &&
    errors.length === 0
  ) {
    normalized.birthYear = deriveBirthYearForRead(normalized.birthDate, null);
    nextBirthYear = normalized.birthYear;
  }

  const consistency = validateBirthDateYearConsistency(
    typeof nextBirthDate === "string" || nextBirthDate == null ? nextBirthDate : null,
    nextBirthYear == null || nextBirthYear === "" ? null : Number(nextBirthYear)
  );
  if (!consistency.ok) errors.push(...consistency.errors);

  if ("handedness" in patch) {
    const r = validateHandedness(patch.handedness, { strict: true });
    if (!r.ok) errors.push(...r.errors);
    else normalized.handedness = r.value;
  }

  if ("activityRegion" in patch) {
    const r = validateActivityRegion(patch.activityRegion);
    if (!r.ok) errors.push(...r.errors);
    else normalized.activityRegion = r.value;
  }

  if ("privacySettings" in patch) {
    const r = validatePrivacySettings(patch.privacySettings);
    if (!r.ok) errors.push(...r.errors);
    else normalized.privacySettings = r.value;
  }

  // verificationStatus / identityVerificationStatus are forbidden on this path
  // (see PLAYER_PRIVILEGED_WRITE_FIELDS). Use updatePlayerVerificationStatus (Phase 1H-A).

  if (errors.length) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.VALIDATION_ERROR,
      errors,
      normalized: null,
      forbiddenFields: [],
    };
  }

  if (Object.keys(normalized).length === 0) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.EMPTY_PATCH,
      errors: [{ code: WRITE_ERROR_CODES.EMPTY_PATCH, message: "No effective field changes" }],
      normalized: null,
      forbiddenFields: [],
    };
  }

  return {
    ok: true,
    code: null,
    errors: [],
    normalized,
    forbiddenFields: [],
  };
}
