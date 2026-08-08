/**
 * Pure helpers for CanonicalTournamentCreatePage start flow.
 * Keeps readiness / error formatting unit-testable without React.
 */

export function formatTournamentCreateError(result) {
  if (!result || typeof result !== "object") {
    return "Không thể tạo giải.";
  }
  const code = String(result.code || "").trim();
  const error = String(result.error || "").trim();
  if (error && code) {
    return `${error} (${code})`;
  }
  if (error) {
    return error;
  }
  if (code) {
    return `Không thể tạo giải. (${code})`;
  }
  return "Không thể tạo giải.";
}

/**
 * @param {object} params
 * @param {boolean} params.accessAllowed
 * @param {boolean} params.activeClubReady
 * @param {{id?: string}|null} params.activeClub
 * @param {boolean} [params.busy]
 * @returns {{ ok: true } | { ok: false, error: string, code: string }}
 */
export function assertTournamentCreateStartReady({
  accessAllowed,
  activeClubReady,
  activeClub,
  busy = false,
} = {}) {
  if (busy) {
    return {
      ok: false,
      code: "CREATE_BUSY",
      error: "Đang tạo giải — vui lòng chờ.",
    };
  }
  if (!accessAllowed) {
    return {
      ok: false,
      code: "RUNTIME_ACCESS_DENIED",
      error: "Runtime platform chặn thao tác quản lý giải đấu.",
    };
  }
  if (!activeClubReady || !activeClub?.id) {
    return {
      ok: false,
      code: "CLUB_NOT_READY",
      error: "CLB chưa sẵn sàng (thiếu tenant hợp lệ) — không thể tạo giải.",
    };
  }
  return { ok: true };
}

/**
 * Resolve post-create navigation path for non-team modes.
 * @returns {string|null}
 */
export function resolveTournamentCreateNavigatePath(mode, tournamentId, preselectedEvent) {
  const id = String(tournamentId || "").trim();
  if (!id) return null;
  if (mode === "daily_play") {
    return `/tournament/daily/${id}`;
  }
  if (mode === "internal_tournament") {
    return preselectedEvent
      ? `/tournament/internal/${id}?event=${preselectedEvent}`
      : `/tournament/internal/${id}`;
  }
  if (mode === "official_tournament") {
    return preselectedEvent
      ? `/tournament/official/${id}?event=${preselectedEvent}`
      : `/tournament/official/${id}`;
  }
  if (mode === "team_tournament") {
    return `/tournament/team/${id}`;
  }
  return null;
}
