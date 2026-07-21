/**
 * Phase 1I-A — Directory search / detail request contracts.
 *
 * activityRegion filter is a normalized string | null (Owner remediation).
 * Opaque cursor is validated here; malformed → DIRECTORY_INVALID_CURSOR (no reset).
 */
import {
  DIRECTORY_ERROR_CODES,
  DIRECTORY_SEARCH_DEFAULT_LIMIT,
  DIRECTORY_SEARCH_MAX_LIMIT,
  DIRECTORY_SEARCH_MIN_QUERY_LENGTH,
} from "../constants/directory.js";
import { decodeDirectoryCursor } from "../utils/directoryCursor.js";
import { trimId } from "../utils/playerId.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Clamp limit per existing Player Management conventions (verification queue).
 * Invalid / missing → default; over max → clamp.
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeDirectoryLimit(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return DIRECTORY_SEARCH_DEFAULT_LIMIT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return DIRECTORY_SEARCH_DEFAULT_LIMIT;
  }
  return Math.min(DIRECTORY_SEARCH_MAX_LIMIT, Math.floor(n));
}

/**
 * Normalize region filter to trimmed string | null.
 * Objects / arrays / numbers are rejected (not coerced to objects).
 * @param {unknown} raw
 * @returns {{ ok: true, value: string|null } | { ok: false, code: string, message: string }}
 */
function normalizeRegionFilter(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return { ok: true, value: trimmed ? trimmed : null };
  }
  return {
    ok: false,
    code: DIRECTORY_ERROR_CODES.INVALID_REQUEST,
    message: "activityRegion must be a string",
  };
}

/**
 * Validate / normalize a directory search request.
 * Unknown fields are ignored (existing Player Management request convention).
 *
 * @param {unknown} raw
 * @returns {{ ok: true, value: { query: string, activityRegion: string|null, cursor: string|null, decodedCursor: object|null, limit: number } } | { ok: false, code: string, message: string }}
 */
export function normalizeDirectorySearchRequest(raw = {}) {
  if (raw == null) {
    return {
      ok: true,
      value: {
        query: "",
        activityRegion: null,
        cursor: null,
        decodedCursor: null,
        limit: DIRECTORY_SEARCH_DEFAULT_LIMIT,
      },
    };
  }
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_REQUEST,
      message: "Search request must be an object",
    };
  }

  const query = trimId(raw.query ?? raw.q ?? "");
  if (query.length > 0 && query.length < DIRECTORY_SEARCH_MIN_QUERY_LENGTH) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_REQUEST,
      message: `Search query must be at least ${DIRECTORY_SEARCH_MIN_QUERY_LENGTH} characters`,
    };
  }

  const regionResult = normalizeRegionFilter(raw.activityRegion ?? raw.region);
  if (!regionResult.ok) return regionResult;

  const limit = normalizeDirectoryLimit(raw.limit);

  const cursorRaw = raw.cursor;
  if (cursorRaw == null || cursorRaw === "") {
    return {
      ok: true,
      value: {
        query,
        activityRegion: regionResult.value,
        cursor: null,
        decodedCursor: null,
        limit,
      },
    };
  }

  if (typeof cursorRaw !== "string") {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
      message: "cursor must be a string",
    };
  }

  const decoded = decodeDirectoryCursor(cursorRaw);
  if (!decoded.ok) {
    return decoded;
  }

  return {
    ok: true,
    value: {
      query,
      activityRegion: regionResult.value,
      cursor: cursorRaw.trim(),
      decodedCursor: decoded.value,
      limit,
    },
  };
}

/**
 * @param {unknown} playerIdOrRequest
 * @returns {{ ok: true, value: { playerId: string } } | { ok: false, code: string, message: string }}
 */
export function normalizeDirectoryDetailRequest(playerIdOrRequest) {
  let playerId;
  if (isPlainObject(playerIdOrRequest)) {
    playerId = trimId(playerIdOrRequest.playerId ?? playerIdOrRequest.player_id);
  } else {
    playerId = trimId(playerIdOrRequest);
  }

  if (!playerId) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.INVALID_REQUEST,
      message: "playerId is required",
    };
  }

  return { ok: true, value: { playerId } };
}
