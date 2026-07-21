/**
 * Phase 1I-A — Authenticated Public Player Directory search facade.
 *
 * UI → facade → repository port → Supabase RPC adapter
 * No UI imports. No direct Supabase import in this core facade.
 */
import {
  normalizeDirectorySearchRequest,
} from "../contracts/directoryRequests.js";
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";
import { assertStrictDirectoryDto } from "../projectors/projectDirectoryPlayer.js";
import { createPlayerDirectoryRepository } from "../repositories/playerDirectoryRepository.js";
import { resolveDirectorySession } from "./directorySession.js";

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    items: [],
    nextCursor: null,
    meta: {
      count: 0,
      limit: extra.limit ?? 0,
      query: extra.query ?? "",
      readOnly: true,
      ...extra.meta,
    },
  };
}

/**
 * @param {object} [request]
 * @param {object} [dependencies]
 * @param {object} [dependencies.session]
 * @param {() => object|null} [dependencies.getSession]
 * @param {object} [dependencies.user] — auth user override (tests)
 * @param {() => object|null} [dependencies.getCurrentUser]
 * @param {{ directorySearch: Function }} [dependencies.directoryRepository]
 * @param {{ directorySearch: Function }} [dependencies.repository]
 */
export async function searchPublicDirectoryPlayers(request = {}, dependencies = {}) {
  const sessionResult = resolveDirectorySession(dependencies);
  if (!sessionResult.ok) {
    return fail(sessionResult.code, sessionResult.message);
  }

  const normalized = normalizeDirectorySearchRequest(request);
  if (!normalized.ok) {
    return fail(normalized.code, normalized.message);
  }

  const { query, activityRegion, cursor, limit } = normalized.value;
  const repository =
    dependencies.directoryRepository ||
    dependencies.repository ||
    createPlayerDirectoryRepository();

  let result;
  try {
    result = await repository.directorySearch({
      query,
      activityRegion,
      cursor,
      decodedCursor: normalized.value.decodedCursor,
      limit,
    });
  } catch {
    return fail(
      DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
      "Player directory backend is unavailable",
      { query, limit }
    );
  }

  if (!result?.ok) {
    const code = result?.code || DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE;
    // Never leak SQL / RLS / hide-reason details.
    const safeMessage =
      code === DIRECTORY_ERROR_CODES.INVALID_CURSOR
        ? "Invalid directory cursor"
        : code === DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED
          ? "Authentication required for the player directory"
          : code === DIRECTORY_ERROR_CODES.INVALID_REQUEST
            ? result?.message || "Invalid directory request"
            : code === DIRECTORY_ERROR_CODES.RESPONSE_INVALID
              ? "Player directory response was invalid"
              : "Player directory backend is unavailable";
    return fail(code, safeMessage, { query, limit });
  }

  const rawItems = Array.isArray(result.items) ? result.items : [];
  const items = [];
  for (const item of rawItems) {
    const strict = assertStrictDirectoryDto(item);
    if (!strict) {
      return fail(
        DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
        "Player directory response was invalid",
        { query, limit }
      );
    }
    items.push(strict);
  }

  const nextCursor =
    result.nextCursor == null || result.nextCursor === ""
      ? null
      : String(result.nextCursor);

  return {
    ok: true,
    code: null,
    message: null,
    items,
    nextCursor,
    meta: {
      count: items.length,
      limit,
      query,
      readOnly: true,
    },
  };
}
