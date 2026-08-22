/**
 * Unified Official completion predicate.
 * Champion = completed Final winner only. Runner-up = Final loser.
 */

import { MATCH_STAGE, MATCH_STATUS, TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { isTournamentClosed } from "./tournamentClosingEngine.js";
import { resolveOfficialQualificationReadiness } from "./officialStandingsEngine.js";
import { hasBracketGenerated } from "../../../tournament/engines/bracketEngine.js";

export function resolveOfficialFinalMatch(event) {
  return (event?.matches || []).find((match) => match.stage === MATCH_STAGE.FINAL) || null;
}

export function resolveOfficialChampion(tournament, event = null) {
  const ev = event || (tournament?.events || [])[0] || null;
  const finalMatch = resolveOfficialFinalMatch(ev);
  if (
    !finalMatch ||
    (finalMatch.status !== MATCH_STATUS.COMPLETED && finalMatch.status !== MATCH_STATUS.FORFEIT) ||
    !finalMatch.winnerId
  ) {
    return { championId: "", runnerUpId: "", finalMatch, ok: false };
  }
  const entries = ev?.entries || [];
  const nameOf = (id) => entries.find((entry) => String(entry.id) === String(id))?.name || "";
  return {
    ok: true,
    championId: finalMatch.winnerId,
    runnerUpId: finalMatch.loserId || "",
    championName: nameOf(finalMatch.winnerId),
    runnerUpName: nameOf(finalMatch.loserId),
    finalMatch,
  };
}

export function evaluateOfficialCompletionPredicate(tournament, options = {}) {
  if (!tournament) {
    return { ok: false, error: "Thiếu giải.", code: "NO_TOURNAMENT" };
  }
  if (isTournamentClosed(tournament)) {
    return { ok: true, alreadyCompleted: true, code: "ALREADY_COMPLETED" };
  }
  const event =
    (tournament.events || []).find((item) => String(item.id) === String(options.eventId || "")) ||
    null;
  if (!event) {
    return {
      ok: false,
      error: options.eventId
        ? "Không tìm thấy nội dung thi đấu."
        : "Chọn nội dung tường minh (eventId) trước khi chốt giải.",
      code: options.eventId ? "NO_EVENT" : "EVENT_REQUIRED",
    };
  }

  const groupMatches = (event.matches || []).filter((match) => !match.bracketMatchId);
  if (!groupMatches.length) {
    return { ok: false, error: "Chưa có trận vòng bảng.", code: "NO_GROUP_MATCHES" };
  }
  const groupDone = groupMatches.every(
    (match) => match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT
  );
  if (!groupDone) {
    return { ok: false, error: "Chưa hoàn tất vòng bảng.", code: "GROUP_INCOMPLETE" };
  }

  const qualification = resolveOfficialQualificationReadiness(tournament, event, {
    eventId: String(event.id),
    ...options,
  });
  if (!qualification.ready) {
    return {
      ok: false,
      error: qualification.error,
      code: qualification.code,
      qualification,
    };
  }

  const groups = event.groups || [];
  if (groups.length >= 2) {
    if (!hasBracketGenerated(event)) {
      return { ok: false, error: "Chưa tạo vòng loại trực tiếp.", code: "KO_NOT_GENERATED" };
    }
    const koMatches = (event.matches || []).filter((match) => match.bracketMatchId);
    const koIncomplete = koMatches.filter(
      (match) => match.status !== MATCH_STATUS.COMPLETED && match.status !== MATCH_STATUS.FORFEIT
    );
    if (koIncomplete.length) {
      return {
        ok: false,
        error: `Chưa hoàn tất knockout (còn ${koIncomplete.length} trận).`,
        code: "KO_INCOMPLETE",
      };
    }
    const champion = resolveOfficialChampion(tournament, event);
    if (!champion.ok) {
      return {
        ok: false,
        error: "Chưa có kết quả Chung kết — chưa có vô địch.",
        code: "FINAL_INCOMPLETE",
      };
    }
    return {
      ok: true,
      champion,
      qualification,
    };
  }

  const incomplete = (event.matches || []).filter(
    (match) => match.status !== MATCH_STATUS.COMPLETED && match.status !== MATCH_STATUS.FORFEIT
  );
  if (incomplete.length) {
    return {
      ok: false,
      error: `Còn ${incomplete.length} trận chưa hoàn tất.`,
      code: "INCOMPLETE_MATCHES",
    };
  }
  return { ok: true, qualification };
}

export function isOfficialTournament(tournament) {
  return tournament?.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT;
}
