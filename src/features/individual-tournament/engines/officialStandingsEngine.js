/**
 * Official group standings — sporting metrics only for qualification.
 * Locked points (must match official_open_event_qualification SQL):
 * win=2, loss=1, forfeit=0, then scoreDiff, pointsFor, wins.
 * name.localeCompare is display ordering after ranks are assigned.
 */

import { buildGroupStandingFromMatches } from "../../../tournament/engines/rankingEngine.js";
import { DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP as SETTINGS_DEFAULT_Q } from "./officialTournamentSettingsEngine.js";
import { resolveContentQualifiersPerGroup } from "./officialContentCompetitionRules.js";

export const QUALIFICATION_TIE_UNRESOLVED = "QUALIFICATION_TIE_UNRESOLVED";
export const DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP = SETTINGS_DEFAULT_Q;

export function sportingMetricsEqual(a, b) {
  return (
    Number(a?.matchPoints || 0) === Number(b?.matchPoints || 0) &&
    Number(a?.scoreDiff || 0) === Number(b?.scoreDiff || 0) &&
    Number(a?.pointsFor || 0) === Number(b?.pointsFor || 0) &&
    Number(a?.won || a?.wins || 0) === Number(b?.won || b?.wins || 0)
  );
}

export function compareOfficialSportingStanding(a, b) {
  return (
    Number(b?.matchPoints || 0) - Number(a?.matchPoints || 0) ||
    Number(b?.scoreDiff || 0) - Number(a?.scoreDiff || 0) ||
    Number(b?.pointsFor || 0) - Number(a?.pointsFor || 0) ||
    Number(b?.won || b?.wins || 0) - Number(a?.won || a?.wins || 0)
  );
}

export function compareOfficialDisplayStanding(a, b) {
  return (
    compareOfficialSportingStanding(a, b) ||
    String(a?.name || "").localeCompare(String(b?.name || ""), "vi")
  );
}

export function resolveOfficialQualifiersPerGroup(tournament, options = {}) {
  if (options.qualifiersPerGroup != null) {
    return Math.max(1, Number(options.qualifiersPerGroup) || DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP);
  }
  const eventId = String(options.eventId || options.selectedEventId || "").trim();
  if (tournament && eventId) {
    return resolveContentQualifiersPerGroup(tournament, { eventId });
  }
  // Fail closed: no tournament-level active authority when eventId missing.
  // Callers must pass explicit eventId for Content-scoped qualification.
  return DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP;
}

export function assignOfficialQualification(standing = [], qualifiersPerGroup = 2) {
  const sorted = [...standing].sort(compareOfficialDisplayStanding);
  const q = Math.max(1, Number(qualifiersPerGroup) || DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP);
  if (sorted.length <= q) {
    return {
      standing: sorted,
      qualified: sorted,
      qualificationTieUnresolved: false,
    };
  }
  const lastIn = sorted[q - 1];
  const firstOut = sorted[q];
  if (sportingMetricsEqual(lastIn, firstOut)) {
    return {
      standing: sorted,
      qualified: [],
      qualificationTieUnresolved: true,
      qualificationTieCode: QUALIFICATION_TIE_UNRESOLVED,
    };
  }
  return {
    standing: sorted,
    qualified: sorted.slice(0, q),
    qualificationTieUnresolved: false,
  };
}

export function buildOfficialAllGroupStandings(event, options = {}) {
  const qualifiersPerGroup = Math.max(
    1,
    Number(options.qualifiersPerGroup) || DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP
  );
  const entries = event?.entries || [];
  const matches = event?.matches || [];

  return (event?.groups || [])
    .map((group) => {
      const base = buildGroupStandingFromMatches({
        group,
        entries,
        matches,
        pointsConfig: { win: 2, loss: 1, forfeit: 0 },
      });
      const assigned = assignOfficialQualification(base.standing, qualifiersPerGroup);
      return {
        ...base,
        standing: assigned.standing,
        qualified: assigned.qualified,
        qualificationTieUnresolved: assigned.qualificationTieUnresolved,
        qualificationTieCode: assigned.qualificationTieCode || null,
        qualifiersPerGroup,
      };
    })
    .filter((groupStanding) => groupStanding.standing.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group, "vi", { numeric: true }));
}

export function officialQualificationReady(event, options = {}) {
  const groupMatches = (event?.matches || []).filter((match) => !match.bracketMatchId);
  if (!groupMatches.length) {
    return { ready: false, code: "GROUP_INCOMPLETE", error: "Chưa có trận vòng bảng." };
  }
  const allDone = groupMatches.every(
    (match) => match.status === "completed" || match.status === "forfeit"
  );
  if (!allDone) {
    return {
      ready: false,
      code: "GROUP_INCOMPLETE",
      error: "Cần hoàn tất mọi trận vòng bảng trước khi xét suất.",
    };
  }
  const standings = buildOfficialAllGroupStandings(event, options);
  const tied = standings.find((group) => group.qualificationTieUnresolved);
  if (tied) {
    return {
      ready: false,
      code: QUALIFICATION_TIE_UNRESOLVED,
      error: `Bảng ${tied.group} hòa chỉ số thể thao tại ranh giới suất — không bốc KO.`,
      standings,
    };
  }
  return { ready: true, standings };
}
