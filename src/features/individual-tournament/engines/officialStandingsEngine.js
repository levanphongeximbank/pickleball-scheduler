/**
 * Official group standings — sporting metrics only for qualification.
 * Locked points (must match official_open_event_qualification SQL):
 * win=2, loss=1, forfeit=0, then scoreDiff, pointsFor, wins.
 * name.localeCompare is display ordering after ranks are assigned.
 *
 * G2-C: direct TOP_N per group comes from Content qualification policy.
 * Canonical slot math is Adapter A deriveQualificationPlan (via
 * resolveContentQualificationPlan). Wildcard candidate ranking is NOT here.
 */

import { buildGroupStandingFromMatches } from "../../../tournament/engines/rankingEngine.js";
import { DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP as SETTINGS_DEFAULT_Q } from "./officialTournamentSettingsEngine.js";
import {
  resolveContentQualifiersPerGroup,
  resolveContentQualificationPlan,
  resolveContentWildcardRequirement,
} from "./officialContentCompetitionRules.js";

export const QUALIFICATION_TIE_UNRESOLVED = "QUALIFICATION_TIE_UNRESOLVED";
export const QUALIFICATION_NOT_READY = "QUALIFICATION_NOT_READY";
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

/**
 * Group-stage completion + direct TOP_N tie gate (legacy shape).
 * Prefer resolveOfficialQualificationReadiness for Content-scoped KO gates (G2-C).
 */
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

function countDirectQualified(standings = []) {
  return (standings || []).reduce(
    (sum, group) => sum + (Array.isArray(group?.qualified) ? group.qualified.length : 0),
    0
  );
}

/**
 * Content-scoped qualification readiness (G2-C + G2-D).
 *
 * Combines:
 *   resolveContentQualificationPlan (Adapter A slot math)
 *   + officialQualificationReady (group complete + TOP_N ties)
 *   + resolveContentWildcardRequirement (structural wildcard / Group 4 handoff)
 *
 * wildcardSlots > 0 without authoritative Group 4 result → QUALIFICATION_NOT_READY.
 * Does not silently shrink the KO field to directSlots only.
 */
export function resolveOfficialQualificationReadiness(tournament, event, options = {}) {
  const eventId = String(options.eventId || options.selectedEventId || event?.id || "").trim();
  if (!eventId) {
    return {
      ready: false,
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) trước khi xét suất đi tiếp.",
      directSlots: 0,
      directQualifiedCount: 0,
      wildcardSlots: 0,
      wildcardQualifiedCount: 0,
      totalRequired: 0,
      wildcardRequirement: null,
    };
  }
  if (!event) {
    return {
      ready: false,
      ok: false,
      code: "EVENT_NOT_FOUND",
      error: "Không tìm thấy nội dung thi đấu.",
      eventId,
      directSlots: 0,
      directQualifiedCount: 0,
      wildcardSlots: 0,
      wildcardQualifiedCount: 0,
      totalRequired: 0,
      wildcardRequirement: null,
    };
  }

  const planResolved = resolveContentQualificationPlan(tournament, { eventId });
  if (!planResolved.ok) {
    return {
      ready: false,
      ok: false,
      code: planResolved.code || "INVALID_QUALIFICATION_PLAN",
      error: planResolved.error || "Cấu hình suất đi tiếp không hợp lệ.",
      eventId,
      source: planResolved.source || null,
      plan: planResolved.plan || null,
      directSlots: Number(planResolved.plan?.directSlots) || 0,
      directQualifiedCount: 0,
      wildcardSlots: Number(planResolved.plan?.wildcardSlots) || 0,
      wildcardQualifiedCount: 0,
      totalRequired: Number(planResolved.plan?.totalQualifiers) || 0,
      wildcardRequirement: null,
    };
  }

  const {
    directSlots,
    groupDirectQualifierSlots,
    directKnockoutEntrySlots,
    wildcardSlots,
    totalQualifiers,
    totalKnockoutSlots,
    directQualifiersPerGroup,
    source,
    plan,
  } = planResolved;

  const groupDirectSlots =
    Number(groupDirectQualifierSlots ?? directSlots) || 0;
  const totalRequired = Number(totalKnockoutSlots ?? totalQualifiers) || 0;

  const wildcardRequirement = resolveContentWildcardRequirement(tournament, {
    eventId,
    group4WildcardResult: options.group4WildcardResult,
  });

  const groupReady = officialQualificationReady(event, {
    qualifiersPerGroup: directQualifiersPerGroup,
  });
  if (!groupReady.ready) {
    return {
      ready: false,
      ok: false,
      code: groupReady.code || QUALIFICATION_NOT_READY,
      error: groupReady.error,
      eventId,
      source,
      plan,
      standings: groupReady.standings || null,
      directSlots: groupDirectSlots,
      directQualifiedCount: countDirectQualified(groupReady.standings),
      directKnockoutEntrySlots: Number(directKnockoutEntrySlots) || 0,
      wildcardSlots,
      wildcardQualifiedCount: wildcardRequirement.wildcardQualifiedCount || 0,
      totalRequired,
      directQualifiersPerGroup,
      wildcardRequirement,
    };
  }

  const standings = groupReady.standings || [];
  const directQualifiedCount = countDirectQualified(standings);
  const groupCount = Number(plan.groupCount) || 0;

  if (groupCount > 0 && standings.length !== groupCount) {
    return {
      ready: false,
      ok: false,
      code: QUALIFICATION_NOT_READY,
      error: `Số bảng có xếp hạng (${standings.length}) khác groupCount (${groupCount}).`,
      eventId,
      source,
      plan,
      standings,
      directSlots: groupDirectSlots,
      directQualifiedCount,
      directKnockoutEntrySlots: Number(directKnockoutEntrySlots) || 0,
      wildcardSlots,
      wildcardQualifiedCount: wildcardRequirement.wildcardQualifiedCount || 0,
      totalRequired,
      directQualifiersPerGroup,
      wildcardRequirement,
    };
  }

  if (directQualifiedCount !== groupDirectSlots) {
    return {
      ready: false,
      ok: false,
      code: QUALIFICATION_NOT_READY,
      error: `Suất trực tiếp từ bảng chưa đủ: cần ${groupDirectSlots}, hiện ${directQualifiedCount}. Không đệm / không dùng wildcard ranking.`,
      eventId,
      source,
      plan,
      standings,
      directSlots: groupDirectSlots,
      directQualifiedCount,
      directKnockoutEntrySlots: Number(directKnockoutEntrySlots) || 0,
      wildcardSlots,
      wildcardQualifiedCount: wildcardRequirement.wildcardQualifiedCount || 0,
      totalRequired,
      directQualifiersPerGroup,
      wildcardRequirement,
    };
  }

  // DIRECT slots require shared CE compose — Official classic readiness stays fail-closed.
  if (Number(directKnockoutEntrySlots) > 0) {
    return {
      ready: false,
      ok: false,
      code: "KNOCKOUT_ADMISSION_DIRECT_UNSUPPORTED_ON_OFFICIAL_CLASSIC",
      error:
        "DIRECT_KNOCKOUT_ENTRY slots > 0 — Official classic chưa compose shared CE first-playable DIRECT. Không tạo KO thiếu field.",
      eventId,
      source,
      plan,
      standings,
      directSlots: groupDirectSlots,
      directQualifiedCount,
      directKnockoutEntrySlots: Number(directKnockoutEntrySlots) || 0,
      wildcardSlots,
      wildcardQualifiedCount: wildcardRequirement.wildcardQualifiedCount || 0,
      totalRequired,
      directQualifiersPerGroup,
      wildcardRequirement,
      silentSmallerKoFieldAllowed: false,
    };
  }

  // Structural wildcard slots without authoritative Group 4 result → fail closed.
  if (!wildcardRequirement.ready) {
    return {
      ready: false,
      ok: false,
      code: wildcardRequirement.code || QUALIFICATION_NOT_READY,
      error:
        wildcardRequirement.error ||
        `Còn ${wildcardSlots} suất wildcard — chờ Nhóm 4. Không tạo KO với ${groupDirectSlots}/${totalRequired} suất.`,
      eventId,
      source,
      plan,
      standings,
      directSlots: groupDirectSlots,
      directQualifiedCount,
      directKnockoutEntrySlots: Number(directKnockoutEntrySlots) || 0,
      wildcardSlots,
      wildcardQualifiedCount: wildcardRequirement.wildcardQualifiedCount || 0,
      totalRequired,
      directQualifiersPerGroup,
      wildcardRequirement,
      wildcardExecutionDeferred: true,
      silentSmallerKoFieldAllowed: false,
    };
  }

  return {
    ready: true,
    ok: true,
    code: null,
    error: null,
    eventId,
    source,
    plan,
    standings,
    directSlots: groupDirectSlots,
    directQualifiedCount,
    directKnockoutEntrySlots: 0,
    wildcardSlots,
    wildcardQualifiedCount: wildcardRequirement.wildcardQualifiedCount || 0,
    totalRequired,
    directQualifiersPerGroup,
    wildcardRequirement,
    qualifiedWildcardEntries: wildcardRequirement.qualifiedWildcardEntries || [],
    wildcardExecutionDeferred: false,
    silentSmallerKoFieldAllowed: false,
  };
}
