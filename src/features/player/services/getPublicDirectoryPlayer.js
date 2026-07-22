/**
 * Phase 1I-A / 1J-C — Authenticated Public Player Directory detail facade.
 *
 * Hidden / unverified / suspended / nonexistent → null player (generic).
 * No UI imports. Defaults: authService.getCurrentUser + Supabase directory adapter.
 * Tests retain full DI (user/session/getters/repository).
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { normalizeDirectoryDetailRequest } from "../contracts/directoryRequests.js";
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";
import { assertStrictDirectoryDto } from "../projectors/projectDirectoryPlayer.js";
import { createSupabasePlayerDirectoryRepository } from "../repositories/supabasePlayerDirectoryRepository.js";
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
 * @param {object} [dependencies]
 * @returns {{ directoryGetByPlayerId: Function }}
 */
function resolveDirectoryRepository(dependencies = {}) {
  if (dependencies.directoryRepository) return dependencies.directoryRepository;
  if (dependencies.repository) return dependencies.repository;

  const injectedGetClient =
    typeof dependencies.getSupabaseClient === "function"
      ? dependencies.getSupabaseClient
      : dependencies.supabase
        ? () => dependencies.supabase
        : null;

  return createSupabasePlayerDirectoryRepository({
    getClient: injectedGetClient || getSupabaseAuthClient,
    hasConfig:
      typeof dependencies.hasSupabaseConfig === "function"
        ? dependencies.hasSupabaseConfig
        : injectedGetClient
          ? () => true
          : hasSupabaseConfig,
    supabase: dependencies.supabase,
  });
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
 * @param {() => object|null} [dependencies.getSupabaseClient]
 * @param {() => boolean} [dependencies.hasSupabaseConfig]
 * @param {object} [dependencies.supabase]
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
  const repository = resolveDirectoryRepository(dependencies);

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
