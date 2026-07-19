/**
 * Phase 1F-A — Authenticated self player profile read (canonical path only).
 *
 * Flow:
 *   auth session → load public.profiles row → getPlayerProfileByAuthUser
 *     → getPlayerProfile (adaptProfileRow + normalizePlayerProfile)
 *
 * Does not invent fields. Does not write. Does not bypass Player Management facades.
 */
import { getCurrentUser } from "../../../auth/authService.js";
import { fetchProfileByUserId } from "../../../auth/profileService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import { trimId } from "../utils/playerId.js";
import { getPlayerProfileByAuthUser } from "./getPlayerProfile.js";

export const SELF_PLAYER_PROFILE_READ_STATUS = Object.freeze({
  LOADING: "loading",
  LOADED: "loaded",
  EMPTY: "empty",
  READ_ERROR: "read_error",
  UNAUTHORIZED: "unauthorized",
  PROFILE_NOT_FOUND: "profile_not_found",
  UNRESOLVED: "unresolved",
});

function buildResult(partial) {
  return {
    ok: Boolean(partial.ok),
    status: partial.status,
    code: partial.code || null,
    message: partial.message || null,
    outcome: partial.outcome || null,
    playerId: partial.playerId || null,
    authUserId: partial.authUserId || null,
    profile: partial.profile || null,
    warnings: Array.isArray(partial.warnings) ? partial.warnings : [],
    meta: partial.meta && typeof partial.meta === "object" ? partial.meta : {},
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.authUserId]
 * @param {(userId: string) => Promise<object>} [options.loadProfileByUserId]
 * @param {string|null} [options.clubId]
 * @param {(playerId: string) => object|null|undefined} [options.findPlayerById]
 */
export async function getAuthenticatedSelfPlayerProfile(options = {}) {
  const sessionUser = getCurrentUser();
  const authUserId = trimId(options.authUserId || sessionUser?.id);

  if (!authUserId) {
    return buildResult({
      ok: false,
      status: SELF_PLAYER_PROFILE_READ_STATUS.UNAUTHORIZED,
      code: "UNAUTHORIZED",
      message: "Vui lòng đăng nhập để xem hồ sơ vận động viên.",
    });
  }

  const loadProfile =
    typeof options.loadProfileByUserId === "function"
      ? options.loadProfileByUserId
      : async (userId) => {
          if (!hasSupabaseConfig() && !options.allowMissingSupabase) {
            return {
              ok: false,
              error: "Supabase chưa cấu hình.",
              code: "NO_SUPABASE",
            };
          }
          return fetchProfileByUserId(userId);
        };

  let fetchResult;
  try {
    fetchResult = await loadProfile(authUserId);
  } catch (error) {
    return buildResult({
      ok: false,
      status: SELF_PLAYER_PROFILE_READ_STATUS.READ_ERROR,
      code: "READ_ERROR",
      message: error?.message || "Không đọc được hồ sơ.",
      authUserId,
    });
  }

  if (!fetchResult || fetchResult.ok === false) {
    const code = fetchResult?.code || "READ_ERROR";
    if (code === "PROFILE_NOT_FOUND") {
      return buildResult({
        ok: false,
        status: SELF_PLAYER_PROFILE_READ_STATUS.PROFILE_NOT_FOUND,
        code,
        message: fetchResult?.error || "Không tìm thấy hồ sơ.",
        authUserId,
      });
    }
    if (code === "NO_SUPABASE") {
      return buildResult({
        ok: false,
        status: SELF_PLAYER_PROFILE_READ_STATUS.READ_ERROR,
        code,
        message: fetchResult?.error || "Supabase chưa cấu hình.",
        authUserId,
      });
    }
    return buildResult({
      ok: false,
      status: SELF_PLAYER_PROFILE_READ_STATUS.READ_ERROR,
      code,
      message: fetchResult?.error || "Không đọc được hồ sơ.",
      authUserId,
    });
  }

  const profileRow = fetchResult.profile || null;
  if (!profileRow || typeof profileRow !== "object") {
    return buildResult({
      ok: false,
      status: SELF_PLAYER_PROFILE_READ_STATUS.PROFILE_NOT_FOUND,
      code: "PROFILE_NOT_FOUND",
      message: "Không tìm thấy hồ sơ.",
      authUserId,
    });
  }

  if (trimId(profileRow.id) && trimId(profileRow.id) !== authUserId) {
    return buildResult({
      ok: false,
      status: SELF_PLAYER_PROFILE_READ_STATUS.UNAUTHORIZED,
      code: "FORBIDDEN",
      message: "Không thể xem hồ sơ của người khác.",
      authUserId,
    });
  }

  // Cloud Production: profiles.player_id may be MAPPED without a club blob row.
  const resolution = getPlayerProfileByAuthUser(authUserId, {
    profile: profileRow,
    clubId: options.clubId || null,
    findPlayerById: options.findPlayerById,
    requirePlayerRow: false,
    trustUnknownExistence: true,
    allowDerived: true,
  });

  if (
    resolution.outcome !== RESOLUTION_OUTCOME.MAPPED &&
    resolution.outcome !== RESOLUTION_OUTCOME.DERIVED
  ) {
    return buildResult({
      ok: false,
      status: SELF_PLAYER_PROFILE_READ_STATUS.UNRESOLVED,
      code: resolution.outcome || "UNRESOLVED",
      message:
        resolution.outcome === RESOLUTION_OUTCOME.AMBIGUOUS
          ? "Danh tính vận động viên không rõ ràng — không thể chọn tự động."
          : "Chưa gắn được danh tính vận động viên chuẩn.",
      outcome: resolution.outcome,
      authUserId,
      playerId: resolution.playerId,
      warnings: resolution.warnings,
      meta: resolution.meta,
    });
  }

  if (!resolution.profile) {
    return buildResult({
      ok: false,
      status: SELF_PLAYER_PROFILE_READ_STATUS.EMPTY,
      code: "EMPTY_PROFILE",
      message: "Hồ sơ vận động viên trống.",
      outcome: resolution.outcome,
      authUserId,
      playerId: resolution.playerId,
      warnings: resolution.warnings,
      meta: resolution.meta,
    });
  }

  return buildResult({
    ok: true,
    status: SELF_PLAYER_PROFILE_READ_STATUS.LOADED,
    code: null,
    message: null,
    outcome: resolution.outcome,
    authUserId,
    playerId: resolution.playerId,
    profile: resolution.profile,
    warnings: resolution.warnings,
    meta: resolution.meta,
  });
}
