/**
 * Single Team Tournament display-name write boundary.
 *
 * UI → updateTournamentCommand({ name }) → cloudTournamentRepository.update
 * → team_tournament_rename (server writes canonical + header atomically).
 *
 * Do not dual-write tournament name tables from the client.
 */
import { updateTournamentCommand } from "../../tournament/services/tournamentCommands.js";

export const TEAM_TOURNAMENT_RENAME_GENERIC_ERROR =
  "Không thể lưu tên giải. Vui lòng thử lại.";

export function hydrateTeamTournamentNameDraft(tournament) {
  return String(tournament?.name || "");
}

export function sanitizeTeamTournamentRenameError(result) {
  if (result?.ok) return null;
  const raw = String(result?.error || "").trim();
  if (!raw) return TEAM_TOURNAMENT_RENAME_GENERIC_ERROR;
  if (
    /sqlstate|postgres|supabase|pgrst|relation |column |function |rpc[_ ]|syntax error|permission denied|42p01|42703/i.test(
      raw
    )
  ) {
    return TEAM_TOURNAMENT_RENAME_GENERIC_ERROR;
  }
  if (/^Không |^Bạn không |^Tên giải /.test(raw) && raw.length <= 180) {
    return raw;
  }
  return TEAM_TOURNAMENT_RENAME_GENERIC_ERROR;
}

/**
 * @param {{
 *   canManage?: boolean,
 *   clubId?: string,
 *   tenantId?: string|null,
 *   tournamentId?: string,
 *   name?: string,
 * }} params
 * @param {{ updateTournamentCommand?: Function }} [deps]
 */
export async function renameTeamTournamentDisplayName(params = {}, deps = {}) {
  if (params.canManage !== true) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Bạn không có quyền đổi tên giải.",
    };
  }

  const name = String(params.name || "").trim();
  if (!name) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Tên giải không được để trống.",
    };
  }

  const clubId = String(params.clubId || "").trim();
  const tournamentId = String(params.tournamentId || "").trim();
  const tenantId = params.tenantId != null ? String(params.tenantId).trim() : "";
  if (!clubId || !tournamentId) {
    return {
      ok: false,
      code: "VALIDATION",
      error: TEAM_TOURNAMENT_RENAME_GENERIC_ERROR,
    };
  }

  const update = deps.updateTournamentCommand || updateTournamentCommand;
  const result = await update(
    tenantId ? { id: clubId, tenantId } : clubId,
    tournamentId,
    { name },
    tenantId ? { tenantId } : {}
  );

  if (!result?.ok) {
    return {
      ...(result && typeof result === "object" ? result : {}),
      ok: false,
      error: sanitizeTeamTournamentRenameError(result),
    };
  }

  return result;
}
