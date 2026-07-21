/**
 * Phase 1I-A — Authenticated Public Player Directory detail facade.
 *
 * Hidden / unverified / suspended / nonexistent → null player (generic).
 * No UI imports. No direct Supabase import in this core facade.
 */
import { normalizeDirectoryDetailRequest } from "../contracts/directoryRequests.js";
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";
import { assertStrictDirectoryDto } from "../projectors/projectDirectoryPlayer.js";
import { createPlayerDirectoryRepository } from "../repositories/playerDirectoryRepository.js";
import { resolveDirectorySession } from "./directorySession.js";

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    player: null,
    meta: {
      playerId: extra.playerId ?? null,
      readOnly: true,
      ...extra.meta,
    },
  };
}

/**
 * @param {string|object} playerIdOrRequest
 * @param {object} [dependencies]
 * @param {object} [dependencies.session]
 * @param {() => object|null} [dependencies.getSession]
 * @param {object} [dependencies.user]
 * @param {() => object|null} [dependencies.getCurrentUser]
 * @param {{ directoryGetByPlayerId: Function }} [dependencies.directoryRepository]
 * @param {{ directoryGetByPlayerId: Function }} [dependencies.repository]
 */
export async function getPublicDirectoryPlayer(playerIdOrRequest, dependencies = {}) {
  const sessionResult = resolveDirectorySession(dependencies);
  if (!sessionResult.ok) {
    return fail(sessionResult.code, sessionResult.message);
  }

  const normalized = normalizeDirectoryDetailRequest(playerIdOrRequest);
  if (!normalized.ok) {
    return fail(normalized.code, normalized.message);
  }

  const { playerId } = normalized.value;
  const repository =
    dependencies.directoryRepository ||
    dependencies.repository ||
    createPlayerDirectoryRepository();

  let result;
  try {
    result = await repository.directoryGetByPlayerId(playerId);
  } catch {
    return fail(
      DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
      "Player directory backend is unavailable",
      { playerId }
    );
  }

  if (!result?.ok) {
    const code = result?.code || DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE;
    const safeMessage =
      code === DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED
        ? "Authentication required for the player directory"
        : code === DIRECTORY_ERROR_CODES.INVALID_REQUEST
          ? result?.message || "Invalid directory request"
          : code === DIRECTORY_ERROR_CODES.RESPONSE_INVALID
            ? "Player directory response was invalid"
            : "Player directory backend is unavailable";
    return fail(code, safeMessage, { playerId });
  }

  if (result.player == null) {
    return {
      ok: true,
      code: null,
      message: null,
      player: null,
      meta: { playerId, readOnly: true },
    };
  }

  const strict = assertStrictDirectoryDto(result.player);
  if (!strict) {
    return fail(
      DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
      "Player directory response was invalid",
      { playerId }
    );
  }

  return {
    ok: true,
    code: null,
    message: null,
    player: strict,
    meta: { playerId, readOnly: true },
  };
}
