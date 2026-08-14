/**
 * Live Internal group standings (IT-E2E-BROWSER-019).
 * One derived authority: canonical groups + canonical completed matches
 * → rankingEngine. Visible as soon as group membership exists.
 */
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { isGroupStageComplete } from "../../../tournament/engines/bracketEngine.js";
import { buildGroupStandingFromMatches } from "../../../tournament/engines/rankingEngine.js";
import {
  COMPETITION_UNIT,
  resolveGroupCompetitionEntries,
  resolveInternalCompetitionUnit,
} from "./internalTournamentCompetitionUnit.js";
import {
  listGroupStageMatches,
  resolveInternalKnockoutEligibility,
  ONE_GROUP_COMPLETION_MESSAGE,
} from "./internalTournamentOneGroupCompletion.js";

export const INTERNAL_GROUP_STANDINGS_ENGINE = "rankingEngine.buildGroupStandingFromMatches";

export const INTERNAL_GROUP_TIE_BREAK_RULE =
  "matchPoints → scoreDiff → pointsFor → wins → name";

export const INTERNAL_KNOCKOUT_INCOMPLETE_MESSAGE =
  "Hoàn tất tất cả trận vòng bảng trước khi tạo knock-out.";

export function isInternalGroupStandingsVisible(event) {
  return (event?.groups || []).some(
    (group) => resolveGroupCompetitionEntries(group, event).length > 0
  );
}

export function isInternalGroupStandingsFinal(event) {
  return Boolean(event && isGroupStageComplete(event));
}

export function resolveInternalKnockoutAction(event) {
  const eligibility = resolveInternalKnockoutEligibility(event);
  if (eligibility.skipKnockout) {
    return {
      enabled: false,
      skipKnockout: true,
      reason: eligibility.message || ONE_GROUP_COMPLETION_MESSAGE,
      code: eligibility.code,
    };
  }
  if (!eligibility.ok) {
    return {
      enabled: false,
      skipKnockout: false,
      reason: eligibility.message || "Chưa đủ bảng để tạo knock-out.",
      code: eligibility.code,
    };
  }
  if (!isInternalGroupStandingsFinal(event)) {
    return {
      enabled: false,
      skipKnockout: false,
      reason: INTERNAL_KNOCKOUT_INCOMPLETE_MESSAGE,
      code: "GROUP_INCOMPLETE",
    };
  }
  return {
    enabled: true,
    skipKnockout: false,
    reason: null,
    code: null,
  };
}

function mergeEventEntries(event, groupEntries = []) {
  const map = new Map(
    (event?.entries || [])
      .map((entry) => [String(entry?.id || ""), entry])
      .filter(([id]) => id)
  );
  groupEntries.forEach((entry) => {
    const id = String(entry?.id || "").trim();
    if (id && !map.has(id)) map.set(id, entry);
  });
  return [...map.values()];
}

export function projectInternalLiveGroupStandings(event, options = {}) {
  const qualifiersPerGroup = Number(options.qualifiersPerGroup) || 2;
  const unit = resolveInternalCompetitionUnit(event?.type);
  const visible = isInternalGroupStandingsVisible(event);
  const final = isInternalGroupStandingsFinal(event);
  const canonicalMatches = listGroupStageMatches(event);
  const knockout = resolveInternalKnockoutAction(event);

  const groups = (event?.groups || []).map((group) => {
    const members = resolveGroupCompetitionEntries(group, event);
    const projectedGroup = {
      ...group,
      entryIds: members.map((entry) => entry.id),
      entries: members,
    };
    const computed = buildGroupStandingFromMatches({
      group: projectedGroup,
      entries: mergeEventEntries(event, members),
      matches: canonicalMatches,
      pointsConfig: group.pointsConfig,
    });
    const standing = (computed.standing || []).map((row, index) => ({
      ...row,
      rank: index + 1,
      qualificationStatus: final
        ? index < qualifiersPerGroup
          ? index === 0
            ? "qualified_1st"
            : "qualified"
          : "eliminated"
        : "pending",
    }));
    return {
      groupId: computed.groupId || group.id,
      group: computed.group,
      matchCount: computed.matchCount,
      standing,
      qualified: final ? standing.slice(0, qualifiersPerGroup) : [],
      source: "canonical_derived",
      tieBreakExplanation: INTERNAL_GROUP_TIE_BREAK_RULE,
      final,
    };
  });

  return {
    ok: visible,
    visible,
    final,
    engine: INTERNAL_GROUP_STANDINGS_ENGINE,
    rowIdentity: unit === COMPETITION_UNIT.PLAYER ? "PLAYER" : "TEAM",
    unit,
    tieBreakRule: INTERNAL_GROUP_TIE_BREAK_RULE,
    knockout,
    groups: groups.filter((group) => group.standing.length > 0),
    completedGroupMatchCount: canonicalMatches.filter(
      (match) =>
        match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT
    ).length,
    pendingGroupMatchCount: canonicalMatches.filter(
      (match) =>
        match.status !== MATCH_STATUS.COMPLETED && match.status !== MATCH_STATUS.FORFEIT
    ).length,
  };
}

export function standingsFingerprint(projection) {
  return JSON.stringify(
    (projection?.groups || []).map((group) => ({
      group: group.group,
      standing: (group.standing || []).map((row) => ({
        id: row.id,
        played: row.played,
        won: row.won,
        lost: row.lost,
        matchPoints: row.matchPoints,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        scoreDiff: row.scoreDiff,
      })),
    }))
  );
}
