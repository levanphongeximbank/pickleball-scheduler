/**
 * One-group Internal Tournament completion contract (IT-E2E-006).
 * ONE group → standings → champion/podium → awards → completed. NO knockout.
 */
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { isGroupStageComplete } from "../../../tournament/engines/bracketEngine.js";
import { buildFinalRanking } from "../../individual-tournament/engines/awardsEngine.js";
import { buildAwardsPreview } from "../../individual-tournament/engines/awardsEngine.js";
import { canCloseTournament } from "../../individual-tournament/engines/tournamentClosingEngine.js";

export const ONE_GROUP_COMPLETION_MESSAGE =
  "Giải có 1 bảng — kết thúc sau vòng bảng (không có vòng knock-out).";

export function getInternalEventGroupCount(tournamentOrEvent) {
  const event = tournamentOrEvent?.events
    ? tournamentOrEvent.events[0]
    : tournamentOrEvent;
  return Array.isArray(event?.groups) ? event.groups.length : 0;
}

export function isOneGroupInternalEvent(tournamentOrEvent) {
  return getInternalEventGroupCount(tournamentOrEvent) === 1;
}

export function shouldSkipKnockoutForInternal(tournamentOrEvent) {
  return isOneGroupInternalEvent(tournamentOrEvent);
}

/**
 * Knockout eligibility for Internal: multi-group only.
 * One-group returns ok:false with product messaging (not a hard error banner tone).
 */
export function resolveInternalKnockoutEligibility(event) {
  const groupCount = Array.isArray(event?.groups) ? event.groups.length : 0;
  if (groupCount === 1) {
    return {
      ok: false,
      skipKnockout: true,
      code: "ONE_GROUP_NO_KNOCKOUT",
      message: ONE_GROUP_COMPLETION_MESSAGE,
      errors: [],
      warnings: [],
    };
  }
  if (groupCount < 2) {
    return {
      ok: false,
      skipKnockout: false,
      code: "NO_GROUPS",
      message: "Chưa có bảng đấu.",
      errors: ["Chưa có bảng đấu."],
      warnings: [],
    };
  }
  return {
    ok: true,
    skipKnockout: false,
    code: null,
    message: null,
    errors: [],
    warnings: [],
  };
}

export function listGroupStageMatches(event) {
  return (event?.matches || []).filter((match) => !match?.bracketMatchId);
}

export function canFinishOneGroupInternal(tournament) {
  const event = tournament?.events?.[0];
  if (!isOneGroupInternalEvent(event)) {
    return { ok: false, code: "NOT_ONE_GROUP", error: "Không phải giải 1 bảng." };
  }
  const matches = listGroupStageMatches(event);
  if (!matches.length) {
    return {
      ok: false,
      code: "NO_SCHEDULE",
      error: "Chưa có lịch vòng bảng.",
    };
  }
  if (!isGroupStageComplete(event)) {
    return {
      ok: false,
      code: "GROUP_INCOMPLETE",
      error: "Còn trận vòng bảng chưa hoàn tất.",
    };
  }
  return { ok: true, event, matches };
}

/**
 * Derive champion / podium from shared awards standings path (no fake KO).
 */
export function resolveOneGroupChampionProjection(tournament) {
  const finish = canFinishOneGroupInternal(tournament);
  if (!finish.ok) {
    return { ok: false, ...finish, ranking: [], champion: null, awards: [] };
  }

  const rankingResult = buildFinalRanking(tournament, finish.event.id);
  const awardsPreview = buildAwardsPreview(tournament, { eventId: finish.event.id });
  const ranking = rankingResult.ranking || [];
  const champion =
    ranking.find((row) => row.rank === 1) ||
    awardsPreview.awards?.find((a) => a.key === "champion") ||
    null;

  return {
    ok: true,
    ranking,
    champion,
    awards: awardsPreview.awards || [],
    source: ranking[0]?.source || "standings_fallback",
    knockoutGenerated: false,
  };
}

export function canCloseOneGroupInternal(tournament) {
  const finish = canFinishOneGroupInternal(tournament);
  if (!finish.ok) return finish;
  const closeCheck = canCloseTournament(tournament);
  if (!closeCheck.ok) return closeCheck;
  return { ok: true };
}

export function assertNoKnockoutMatchesForOneGroup(event) {
  if (!isOneGroupInternalEvent(event)) {
    return { ok: true };
  }
  const ko = (event?.matches || []).filter((match) => match?.bracketMatchId);
  if (ko.length > 0) {
    return {
      ok: false,
      error: "Giải 1 bảng không được tạo trận knock-out.",
      knockoutMatchCount: ko.length,
    };
  }
  return { ok: true, knockoutMatchCount: 0 };
}

export function isMatchCompletedStatus(status) {
  return (
    status === MATCH_STATUS.COMPLETED ||
    status === MATCH_STATUS.FORFEIT ||
    status === "completed" ||
    status === "forfeit"
  );
}
