/**
 * Authenticated application path for self player-profile writes.
 *
 * UI / Identity self-edit → this service → updatePlayerProfile → durable repo → public.profiles
 * under session JWT + existing RLS/guard (no privileged server key).
 */
import { getCurrentUser } from "../../../auth/authService.js";
import { fetchProfileByUserId } from "../../../auth/profileService.js";
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { saveAuthSessionFromCloudProfile } from "../../../auth/authStorage.js";
import { normalizeUser } from "../../../models/user.js";
import { writeAuditLog, AUDIT_ACTIONS } from "../../identity/services/auditService.js";
import { normalizeProfileGender } from "../../identity/utils/profileGender.js";
import { buildDerivedAuthPlayerId } from "../../club/repositories/canonicalRepositoryTypes.js";
import { createDefaultPlayerProfileWriteRepository } from "../bootstrap/playerProfileWriteBootstrap.js";
import { WRITE_ERROR_CODES } from "../constants/writableFields.js";
import { updatePlayerProfile } from "./updatePlayerProfile.js";
import { trimId } from "../utils/playerId.js";

function mapPlayerErrorToSelfResult(result) {
  return {
    ok: false,
    error: result.message || result.code || "Không thể cập nhật hồ sơ.",
    code: result.code || WRITE_ERROR_CODES.PERSISTENCE_ERROR,
    playerResult: result,
  };
}

function buildPlayerPatch(patch = {}) {
  const playerPatch = {};
  if (patch.displayName !== undefined) playerPatch.displayName = patch.displayName;
  if (patch.phone !== undefined) playerPatch.phone = patch.phone;
  if (patch.avatarUrl !== undefined) playerPatch.avatarUrl = patch.avatarUrl;
  if (patch.gender !== undefined) {
    playerPatch.gender =
      patch.gender == null || patch.gender === ""
        ? null
        : normalizeProfileGender(patch.gender);
  }
  if (patch.birthYear !== undefined) {
    if (patch.birthYear === null || patch.birthYear === "") {
      playerPatch.birthYear = null;
    } else {
      const year = Number(patch.birthYear);
      playerPatch.birthYear = Number.isFinite(year) ? year : null;
    }
  }
  if (patch.birthDate !== undefined) playerPatch.birthDate = patch.birthDate;
  if (patch.handedness !== undefined) playerPatch.handedness = patch.handedness;
  if (patch.activityRegion !== undefined) playerPatch.activityRegion = patch.activityRegion;
  if (patch.privacySettings !== undefined) playerPatch.privacySettings = patch.privacySettings;
  return playerPatch;
}

/**
 * @param {object} patch — camelCase Player Management fields
 * @param {object} [options]
 * @param {object} [options.writeRepository]
 * @param {object} [options.supabase]
 */
export async function updateAuthenticatedSelfPlayerProfile(patch = {}, options = {}) {
  const user = getCurrentUser();
  if (!user?.id) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  if (!hasSupabaseConfig() && !options.writeRepository && !options.supabase) {
    return {
      ok: false,
      error: "Supabase chưa cấu hình.",
      code: WRITE_ERROR_CODES.PERSISTENCE_UNAVAILABLE,
    };
  }

  const authUserId = trimId(user.id);
  const existing = await fetchProfileByUserId(authUserId);
  if (!existing.ok) {
    return existing;
  }

  if (String(existing.profile?.id || "") !== String(authUserId)) {
    return { ok: false, error: "Không thể cập nhật hồ sơ người khác.", code: "FORBIDDEN" };
  }

  const profileRow = existing.profile || {};
  const playerId =
    trimId(profileRow.player_id || profileRow.playerId || user.playerId) ||
    buildDerivedAuthPlayerId(authUserId);

  if (!playerId) {
    return {
      ok: false,
      error: "Cannot resolve canonical player identity for self profile write",
      code: WRITE_ERROR_CODES.INVALID_IDENTITY,
    };
  }

  const writeRepository =
    options.writeRepository ||
    createDefaultPlayerProfileWriteRepository({
      supabase: options.supabase || getSupabaseAuthClient(),
    });

  const result = await updatePlayerProfile(playerId, buildPlayerPatch(patch), {
    writeRepository,
    profile: profileRow,
    requirePlayerRow: false,
    trustUnknownExistence: true,
    preferAuthResolution: false,
    authUserId,
    findPlayerById: (id) => {
      const wanted = trimId(id);
      if (wanted && wanted === trimId(playerId)) {
        return { id: wanted, authUserId };
      }
      return null;
    },
    authContext: { userId: authUserId },
  });

  if (!result.ok) {
    return mapPlayerErrorToSelfResult(result);
  }

  const refreshed = await fetchProfileByUserId(authUserId);
  if (!refreshed.ok) {
    return {
      ok: false,
      error: refreshed.error || "Ghi hồ sơ thành công nhưng không đọc lại được profile.",
      code: refreshed.code || WRITE_ERROR_CODES.PERSISTENCE_ERROR,
      playerResult: result,
    };
  }

  const merged = normalizeUser({
    ...refreshed.user,
    phone: refreshed.profile?.phone ?? patch.phone ?? "",
    avatarUrl: refreshed.profile?.avatar_url ?? patch.avatarUrl ?? "",
    gender:
      normalizeProfileGender(refreshed.profile?.gender) ||
      refreshed.profile?.gender ||
      "",
    birthYear: refreshed.profile?.birth_year ?? null,
    playerId: refreshed.profile?.player_id || result.profile?.playerId || playerId,
  });

  saveAuthSessionFromCloudProfile(merged, { provider: "supabase" });

  await writeAuditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resourceType: "profile",
    resourceId: authUserId,
  });

  return {
    ok: true,
    user: merged,
    profile: refreshed.profile,
    playerResult: result,
  };
}
