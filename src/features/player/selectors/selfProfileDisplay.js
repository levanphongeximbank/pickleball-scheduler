/**
 * Phase 1F-A — User-facing display labels for self profile foundation fields.
 * Never show raw DB enums when a label exists.
 */
import { HANDEDNESS } from "../constants/handedness.js";
import { IDENTITY_VERIFICATION_STATUS } from "../constants/verification.js";
import { DEFAULT_PRIVACY_SETTINGS } from "../constants/privacy.js";

export const UNKNOWN_LABEL = "Chưa cập nhật";

const HANDEDNESS_LABELS = Object.freeze({
  [HANDEDNESS.RIGHT]: "Tay phải",
  [HANDEDNESS.LEFT]: "Tay trái",
  [HANDEDNESS.AMBIDEXTROUS]: "Hai tay",
  [HANDEDNESS.UNKNOWN]: "Không rõ",
});

const VERIFICATION_LABELS = Object.freeze({
  [IDENTITY_VERIFICATION_STATUS.UNVERIFIED]: "Chưa xác minh",
  [IDENTITY_VERIFICATION_STATUS.PENDING]: "Đang chờ xác minh",
  [IDENTITY_VERIFICATION_STATUS.VERIFIED]: "Đã xác minh",
  [IDENTITY_VERIFICATION_STATUS.REJECTED]: "Từ chối xác minh",
});

const PRIVACY_FLAG_LABELS = Object.freeze({
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

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatBirthYearDisplay(value) {
  if (value == null || value === "") return UNKNOWN_LABEL;
  const year = Number(value);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return UNKNOWN_LABEL;
  return String(Math.trunc(year));
}

/**
 * @param {unknown} value — ISO date YYYY-MM-DD
 * @returns {string}
 */
export function formatBirthDateDisplay(value) {
  if (value == null || value === "") return UNKNOWN_LABEL;
  const raw = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return UNKNOWN_LABEL;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatHandednessDisplay(value) {
  if (value == null || value === "") return UNKNOWN_LABEL;
  const key = String(value).trim().toLowerCase();
  return HANDEDNESS_LABELS[key] || UNKNOWN_LABEL;
}

/**
 * @param {object|null|undefined} region
 * @returns {string}
 */
export function formatActivityRegionDisplay(region) {
  if (!region || typeof region !== "object") return UNKNOWN_LABEL;
  const parts = [
    region.provinceName,
    region.city,
    region.district,
    region.countryCode,
  ]
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : UNKNOWN_LABEL;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatVerificationStatusDisplay(value) {
  if (value == null || value === "") {
    return VERIFICATION_LABELS[IDENTITY_VERIFICATION_STATUS.UNVERIFIED];
  }
  const key = String(value).trim().toLowerCase();
  return VERIFICATION_LABELS[key] || VERIFICATION_LABELS[IDENTITY_VERIFICATION_STATUS.UNVERIFIED];
}

/**
 * @param {object|null|undefined} privacy
 * @returns {{ summary: string, flags: Array<{ key: string, label: string, enabled: boolean }> }}
 */
export function formatPrivacySettingsDisplay(privacy) {
  const source =
    privacy && typeof privacy === "object" ? { ...DEFAULT_PRIVACY_SETTINGS, ...privacy } : null;

  if (!source) {
    return {
      summary: UNKNOWN_LABEL,
      flags: [],
    };
  }

  const flags = Object.keys(PRIVACY_FLAG_LABELS).map((key) => ({
    key,
    label: PRIVACY_FLAG_LABELS[key],
    enabled: Boolean(source[key]),
  }));

  const summary = source.publicProfileEnabled
    ? "Hồ sơ công khai: bật (theo tùy chọn chi tiết)"
    : "Hồ sơ công khai: tắt (mặc định an toàn)";

  return { summary, flags };
}

/**
 * Build a stable view-model for the six Phase 1E foundation fields.
 * @param {object|null|undefined} profile — normalizePlayerProfile output
 */
export function buildSelfFoundationFieldView(profile) {
  const privacy = formatPrivacySettingsDisplay(profile?.privacySettings);
  return {
    birthYear: {
      raw: profile?.birthYear ?? null,
      label: formatBirthYearDisplay(profile?.birthYear),
      empty: profile?.birthYear == null,
    },
    birthDate: {
      raw: profile?.birthDate ?? null,
      label: formatBirthDateDisplay(profile?.birthDate),
      empty: !profile?.birthDate,
    },
    handedness: {
      raw: profile?.handedness ?? null,
      label: formatHandednessDisplay(profile?.handedness),
      empty: profile?.handedness == null || profile?.handedness === HANDEDNESS.UNKNOWN,
    },
    activityRegion: {
      raw: profile?.activityRegion ?? null,
      label: formatActivityRegionDisplay(profile?.activityRegion),
      empty: formatActivityRegionDisplay(profile?.activityRegion) === UNKNOWN_LABEL,
    },
    privacySettings: {
      raw: profile?.privacySettings ?? null,
      label: privacy.summary,
      flags: privacy.flags,
      empty: !profile?.privacySettings,
    },
    identityVerificationStatus: {
      raw: profile?.verificationStatus ?? null,
      label: formatVerificationStatusDisplay(profile?.verificationStatus),
      readOnly: true,
      empty: false,
    },
  };
}
