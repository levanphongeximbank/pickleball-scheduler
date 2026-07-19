/**
 * Map Player Management camelCase write patches ↔ public.profiles snake_case columns.
 * Only maps durable Phase 1C + existing self-editable profile columns.
 * Does not map identity_verification_status (privileged path only).
 */

/** Top-level camelCase fields this durable writer may send to profiles. */
export const DURABLE_PROFILES_WRITABLE_FIELDS = Object.freeze([
  "displayName",
  "phone",
  "avatarUrl",
  "gender",
  "birthYear",
  "birthDate",
  "handedness",
  "activityRegion",
  "privacySettings",
]);

/** Phase 1C foundation columns (Owner-approved mutable set for this wave). */
export const PHASE_1C_FOUNDATION_FIELDS = Object.freeze([
  "birthDate",
  "handedness",
  "activityRegion",
  "privacySettings",
]);

/**
 * Build a profiles UPDATE row from a validated camelCase patch.
 * Omits undefined keys (preserve). Includes explicit null where present.
 *
 * @param {object} patch — validated camelCase patch
 * @returns {{ row: object, mappedFields: string[], skippedFields: string[] }}
 */
export function buildProfilesUpdateRow(patch = {}) {
  const row = {};
  const mappedFields = [];
  const skippedFields = [];

  for (const key of Object.keys(patch || {})) {
    if (!DURABLE_PROFILES_WRITABLE_FIELDS.includes(key)) {
      skippedFields.push(key);
      continue;
    }

    if (key === "displayName") {
      row.display_name = patch.displayName;
      mappedFields.push(key);
    } else if (key === "phone") {
      row.phone = patch.phone;
      mappedFields.push(key);
    } else if (key === "avatarUrl") {
      row.avatar_url = patch.avatarUrl;
      mappedFields.push(key);
    } else if (key === "gender") {
      row.gender = patch.gender;
      mappedFields.push(key);
    } else if (key === "birthYear") {
      row.birth_year = patch.birthYear;
      mappedFields.push(key);
    } else if (key === "birthDate") {
      row.birth_date = patch.birthDate;
      mappedFields.push(key);
    } else if (key === "handedness") {
      row.handedness = patch.handedness;
      mappedFields.push(key);
    } else if (key === "activityRegion") {
      row.activity_region = patch.activityRegion;
      mappedFields.push(key);
    } else if (key === "privacySettings") {
      row.privacy_settings = patch.privacySettings;
      mappedFields.push(key);
    }
  }

  if (mappedFields.length > 0) {
    row.updated_at = new Date().toISOString();
  }

  return { row, mappedFields, skippedFields };
}
