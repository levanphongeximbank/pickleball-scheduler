/**
 * Phase 1I-A — Strict Public Directory DTO projector / validator.
 *
 * Accepts snake_case RPC rows; emits camelCase Directory DTO only.
 * Second line of defense — RPC remains the first privacy boundary (1I-0).
 * Does not invent eligibility; rejects malformed rows (fail closed).
 *
 * activityRegion is string | null on the public application DTO (Owner remediation).
 */
import {
  DIRECTORY_DTO_EXCLUDED_FIELDS,
  DIRECTORY_ERROR_CODES,
} from "../constants/directory.js";
import { trimId } from "../utils/playerId.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullOptionalString(value) {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number") {
    return { error: true };
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

/**
 * Directory DTO activityRegion — string | null only.
 * Objects / arrays / non-scalar values fail closed (Owner remediation).
 * @param {unknown} raw
 * @returns {string|null|{ error: true }}
 */
function projectActivityRegion(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
  }
  // Reject structured jsonb objects, arrays, numbers, booleans — fail closed.
  return { error: true };
}

/**
 * @param {unknown} row — RPC data row (snake_case or camelCase)
 * @returns {{ ok: true, value: Readonly<object> } | { ok: false, code: string, message: string }}
 */
export function projectDirectoryPlayerFromRpcRow(row) {
  if (!isPlainObject(row)) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row must be an object",
    };
  }

  const playerId = trimId(row.player_id ?? row.playerId);
  if (!playerId) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row requires a non-empty player_id",
    };
  }

  const displayRaw = row.display_name ?? row.displayName;
  if (typeof displayRaw !== "string" && typeof displayRaw !== "number") {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row requires a non-empty display_name",
    };
  }
  const displayName = String(displayRaw).trim();
  if (!displayName) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row requires a non-empty display_name",
    };
  }

  const isVerifiedRaw = row.is_verified ?? row.isVerified;
  if (isVerifiedRaw !== true) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row requires is_verified === true",
    };
  }

  const avatarResult = nullOptionalString(row.avatar_url ?? row.avatarUrl);
  if (avatarResult && avatarResult.error) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row avatar_url has an invalid type",
    };
  }

  const genderResult = nullOptionalString(row.gender);
  if (genderResult && genderResult.error) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row gender has an invalid type",
    };
  }

  const handednessResult = nullOptionalString(row.handedness);
  if (handednessResult && handednessResult.error) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row handedness has an invalid type",
    };
  }

  const activityRegion = projectActivityRegion(
    row.activity_region !== undefined ? row.activity_region : row.activityRegion
  );
  if (activityRegion && activityRegion.error) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      message: "Directory row activity_region must be a string or null",
    };
  }

  const dto = Object.freeze({
    playerId,
    displayName,
    isVerified: true,
    avatarUrl: avatarResult ?? null,
    activityRegion: activityRegion ?? null,
    gender: genderResult ?? null,
    handedness: handednessResult ?? null,
  });

  for (const key of DIRECTORY_DTO_EXCLUDED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(dto, key)) {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
        message: `Directory DTO must not expose ${key}`,
      };
    }
  }

  return { ok: true, value: dto };
}

/**
 * Re-project an already-shaped Directory DTO through the strict allow-list.
 * @param {unknown} value
 * @returns {Readonly<object>|null}
 */
export function assertStrictDirectoryDto(value) {
  if (!isPlainObject(value)) return null;
  const projected = projectDirectoryPlayerFromRpcRow({
    player_id: value.playerId,
    display_name: value.displayName,
    is_verified: value.isVerified,
    avatar_url: value.avatarUrl,
    activity_region: value.activityRegion,
    gender: value.gender,
    handedness: value.handedness,
  });
  return projected.ok ? projected.value : null;
}
