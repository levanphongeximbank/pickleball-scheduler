/**
 * Wave O6 — Official Group Stage / Schedule / Match Center / Standings projections.
 * Read models + explicit command patches. No mutation on load/F5/Event switch.
 *
 * Authorities:
 * - Group matches: buildGroupStageSchedule (event.matches SSOT)
 * - Schedule time/court: scheduleOfficialGroupMatches
 * - Schedule publish: publishScheduleEngine
 * - Standings: buildOfficialAllGroupStandings / officialQualificationReady
 * - CORE-13/15/16/17 declared; Screen 11 does not invent local writers
 */

import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { buildGroupStageSchedule } from "../../../tournament/engines/scheduleEngine.js";
import {
  getDrawPublishStatus,
} from "../../../tournament/engines/publishDrawEngine.js";
import {
  getSchedulePublishStatus,
  isSchedulePublished,
  publishSchedule,
  recordScheduleCreated,
  SCHEDULE_PUBLISH_STATUS,
} from "../../../tournament/engines/publishScheduleEngine.js";
import {
  scheduleOfficialGroupMatches,
  isOfficialGroupScheduleReady,
} from "../../individual-tournament/engines/officialGroupScheduleEngine.js";
import {
  buildOfficialAllGroupStandings,
  officialQualificationReady,
  resolveOfficialQualifiersPerGroup,
} from "../../individual-tournament/engines/officialStandingsEngine.js";
import { listTournamentEvents, resolveSelectedEvent } from "../experience-a1/deriveOverview.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "./authorityLock.js";
import {
  listOfficialGroupDrawCompetitionUnits,
} from "./groupDrawProjection.js";

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function upsertEvent(events = [], nextEvent) {
  if (!nextEvent?.id) return events;
  const list = Array.isArray(events) ? events : [];
  const idx = list.findIndex((event) => String(event.id) === String(nextEvent.id));
  if (idx < 0) return [...list, nextEvent];
  const copy = list.slice();
  copy[idx] = nextEvent;
  return copy;
}

function resolveEventOrFail(tournament, selectedEventId) {
  const events = listTournamentEvents(tournament);
  const eventId = trim(selectedEventId);
  if (events.length > 1 && !eventId) {
    return { ok: false, code: "EVENT_REQUIRED", error: "Chọn nội dung trước.", events, event: null };
  }
  const event = resolveSelectedEvent(events, eventId);
  if (!event) {
    return { ok: false, code: "EVENT_NOT_FOUND", error: "Không tìm thấy nội dung.", events, event: null };
  }
  return { ok: true, events, event, eventId: String(event.id) };
}

function groupStageMatches(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).filter(
    (match) => !match?.bracketMatchId
  );
}

function countByStatus(matches = []) {
  const completed = matches.filter(
    (match) =>
      match.status === MATCH_STATUS.COMPLETED ||
      match.status === MATCH_STATUS.FORFEIT ||
      String(match.status || "").toLowerCase() === "completed" ||
      String(match.status || "").toLowerCase() === "forfeit"
  ).length;
  return {
    total: matches.length,
    completed,
    pending: Math.max(0, matches.length - completed),
    live: matches.filter((match) => match.status === MATCH_STATUS.PLAYING).length,
  };
}

function competitionEntriesForEvent(tournament, event) {
  const listed = listOfficialGroupDrawCompetitionUnits(tournament, {
    selectedEventId: event?.id,
  });
  if (listed.ok && listed.units.length) return listed.units;
  return Array.isArray(event?.entries) ? event.entries : [];
}

function hasResults(matches = []) {
  return matches.some(
    (match) =>
      match.status === MATCH_STATUS.COMPLETED ||
      match.status === MATCH_STATUS.FORFEIT ||
      match.scoreA != null ||
      match.scoreB != null ||
      match.winnerId
  );
}

function hasKnockout(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).some(
    (match) =>
      Boolean(match?.bracketMatchId) ||
      String(match?.stage || "").toLowerCase().includes("knock")
  );
}

/** Shared match identity projection for Screens 09–12. */
export function projectOfficialMatchIdentity(match, { unitsById, courtsById } = {}) {
  const entryA = unitsById?.get(String(match?.entryAId || "")) || null;
  const entryB = unitsById?.get(String(match?.entryBId || "")) || null;
  const courtId = match?.physicalCourtId || match?.courtId || null;
  const court = courtId != null ? courtsById?.get(String(courtId)) : null;
  const courtLabel = court?.name
    ? String(court.name)
    : courtId != null
      ? `Sân ${courtId}`
      : "Chưa gán sân";
  return {
    matchId: String(match?.id || ""),
    eventId: String(match?.eventId || ""),
    groupId: String(match?.groupId || ""),
    stage: String(match?.stage || "group"),
    round: match?.round ?? null,
    entryAId: String(match?.entryAId || ""),
    entryBId: String(match?.entryBId || ""),
    competitorA: entryA?.name || match?.entryAId || "—",
    competitorB: entryB?.name || match?.entryBId || "—",
    physicalCourtId: courtId != null ? String(courtId) : null,
    clusterId: match?.clusterId != null ? String(match.clusterId) : null,
    courtLabel,
    scheduledStart: match?.scheduledStart || null,
    scheduledEnd: match?.scheduledEnd || null,
    status: String(match?.status || ""),
    scoreA: match?.scoreA ?? null,
    scoreB: match?.scoreB ?? null,
    refereeLabel: match?.referee?.name || match?.refereeName || null,
    lifecycleAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE,
    scoringAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.SCORING,
    resultAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT,
    refereeAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT,
    liveScoreIsFinal: false,
    completedIsAccepted: false,
  };
}

export function projectOfficialGroupStage(tournament, { selectedEventId } = {}) {
  const scoped = resolveEventOrFail(tournament, selectedEventId);
  if (!scoped.ok) {
    return {
      ...scoped,
      groups: [],
      matches: [],
      units: [],
      createMatchesEnabled: false,
      authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_MATCH,
    };
  }
  const { event } = scoped;
  const units = competitionEntriesForEvent(tournament, event);
  const groups = Array.isArray(event.groups) ? event.groups : [];
  const matches = groupStageMatches(event);
  const counts = countByStatus(matches);
  const nestedHazard = groups.some(
    (group) => Array.isArray(group.matches) && group.matches.length > 0 && matches.length === 0
  );

  return {
    ok: true,
    needsEventChoice: false,
    eventId: scoped.eventId,
    event,
    groups,
    units,
    unitCount: units.length,
    matches,
    matchCounts: counts,
    nestedHazard,
    createMatchesEnabled:
      groups.length > 0 && matches.length === 0 && !hasKnockout(event),
    regenerateMatchesEnabled:
      matches.length > 0 && !hasResults(matches) && !hasKnockout(event),
    drawPublish: getDrawPublishStatus(tournament),
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_MATCH,
    blocker:
      groups.length === 0
        ? { code: "GROUPS_MISSING", error: "Chưa có bảng — hoàn tất Screen 08 trước." }
        : null,
  };
}

/**
 * Create round-robin fixtures into event.matches from existing groups.
 * Does NOT change group membership. Does NOT schedule courts/times.
 */
export function buildOfficialCreateGroupMatchesPatch(tournament, options = {}) {
  const scoped = resolveEventOrFail(tournament, options.selectedEventId || options.eventId);
  if (!scoped.ok) return scoped;
  const { event } = scoped;
  const groups = Array.isArray(event.groups) ? event.groups : [];
  if (!groups.length) {
    return { ok: false, code: "GROUPS_MISSING", error: "Chưa có bảng để tạo trận." };
  }
  if (hasKnockout(event)) {
    return { ok: false, code: "KNOCKOUT_EXISTS", error: "Đã có knockout — không tạo lại trận bảng." };
  }
  const existing = groupStageMatches(event);
  const isRegen = options.regenerate === true;
  if (existing.length && !isRegen) {
    return {
      ok: false,
      code: "MATCHES_EXIST",
      error: "Đã có trận vòng bảng. Dùng tạo lại chỉ khi chưa có kết quả.",
    };
  }
  if (existing.length && isRegen && hasResults(existing)) {
    return {
      ok: false,
      code: "RESULTS_EXIST",
      error: "Đã có kết quả — không tạo lại trận.",
    };
  }

  const players = Array.isArray(options.players) ? options.players : [];
  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: tournament.id,
    eventId: event.id,
    players,
    privatePairingRules: options.privatePairingRules || [],
  });
  if (schedule.ok === false || schedule.privatePairingError) {
    return {
      ok: false,
      code: "MATCH_GEN_FAILED",
      error:
        schedule.privatePairingError?.message ||
        "Không tạo được trận vòng bảng.",
    };
  }

  // Preserve group membership; drop nested matches dual-source — event.matches is SSOT.
  const nextGroups = (schedule.groups || groups).map((group) => {
    const original = groups.find((item) => String(item.id) === String(group.id)) || group;
    return {
      ...original,
      ...group,
      entries: original.entries || group.entries,
      entryIds: original.entryIds || group.entryIds,
      matches: [],
    };
  });
  const nextEvent = {
    ...event,
    groups: nextGroups,
    matches: schedule.matches || [],
  };

  return {
    ok: true,
    patch: { events: upsertEvent(tournament.events, nextEvent) },
    matchCount: (schedule.matches || []).length,
    matchIds: (schedule.matches || []).map((match) => String(match.id)),
    groupsUnchanged: true,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_MATCH,
    persistedFields: ["events[].matches", "events[].groups.matches(cleared dual-source)"],
  };
}

export function projectOfficialSchedule(tournament, { selectedEventId } = {}) {
  const scoped = resolveEventOrFail(tournament, selectedEventId);
  if (!scoped.ok) {
    return {
      ...scoped,
      matches: [],
      scheduleEnabled: false,
      authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SCHEDULE,
    };
  }
  const { event } = scoped;
  const matches = groupStageMatches(event);
  const units = competitionEntriesForEvent(tournament, event);
  const unitsById = new Map(units.map((unit) => [String(unit.id), unit]));
  const courts = Array.isArray(tournament.courts) ? tournament.courts : [];
  const courtsById = new Map(courts.map((court) => [String(court.id), court]));
  const publish = getSchedulePublishStatus(tournament);
  const ready = isOfficialGroupScheduleReady(event);
  const projected = matches.map((match) =>
    projectOfficialMatchIdentity(match, { unitsById, courtsById })
  );
  const clusterAsCourt = projected.some(
    (row) => row.clusterId && row.physicalCourtId && row.clusterId === row.physicalCourtId
  );

  return {
    ok: true,
    eventId: scoped.eventId,
    event,
    matches: projected,
    rawMatches: matches,
    scheduleReady: ready,
    schedulePublish: publish,
    published: isSchedulePublished(tournament),
    assignEnabled: matches.length > 0 && publish.status !== SCHEDULE_PUBLISH_STATUS.PUBLISHED,
    publishEnabled:
      ready &&
      (publish.status === SCHEDULE_PUBLISH_STATUS.DRAFT ||
        publish.status === SCHEDULE_PUBLISH_STATUS.LOCKED ||
        !publish.status),
    clusterUsedAsPhysicalCourt: clusterAsCourt === true,
    courtAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.COURT,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SCHEDULE,
    blocker:
      matches.length === 0
        ? {
            code: "MATCHES_MISSING",
            error: "Chưa có trận vòng bảng. Tạo trận trên Vòng bảng trước.",
          }
        : null,
  };
}

export function buildOfficialAssignGroupSchedulePatch(tournament, options = {}) {
  const scoped = resolveEventOrFail(tournament, options.selectedEventId || options.eventId);
  if (!scoped.ok) return scoped;
  if (isSchedulePublished(tournament) && options.force !== true) {
    return {
      ok: false,
      code: "SCHEDULE_PUBLISHED",
      error: "Lịch đã công bố — không gán lại sân/giờ.",
    };
  }
  const courts = Array.isArray(options.courts)
    ? options.courts
    : Array.isArray(tournament.courts)
      ? tournament.courts
      : [];
  const courtIds = Array.isArray(options.courtIds)
    ? options.courtIds
    : courts.map((court) => court.id).filter(Boolean);
  const window = tournament.courtSchedule || {};
  const result = scheduleOfficialGroupMatches(tournament, {
    eventId: scoped.eventId,
    courts,
    courtIds,
    date: options.date || window.date,
    startTime: options.startTime || window.startTime,
    endTime: options.endTime || window.endTime,
    timezone: options.timezone,
    players: options.players || [],
    regenerate: options.regenerate !== false,
  });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code || "SCHEDULE_ASSIGN_FAILED",
      error: result.error || "Không gán lịch được.",
      mutationCount: result.mutationCount || 0,
    };
  }

  let nextTournament = {
    ...tournament,
    events: result.events || tournament.events,
  };
  const matches = groupStageMatches(
    (result.events || []).find((event) => String(event.id) === String(scoped.eventId)) || scoped.event
  );
  const recorded = recordScheduleCreated(nextTournament, matches, {
    userId: options.userId,
    actor: options.actor || null,
  });
  if (recorded.ok) {
    nextTournament = {
      ...nextTournament,
      settings: recorded.tournament.settings,
    };
  }

  return {
    ok: true,
    patch: {
      events: nextTournament.events,
      settings: nextTournament.settings,
    },
    mutationCount: result.mutationCount,
    matchIdsPreserved: true,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SCHEDULE,
    persistedFields: ["events[].matches.scheduledStart|scheduledEnd|courtId", "settings.schedule"],
  };
}

export function buildOfficialPublishSchedulePatch(tournament, options = {}) {
  const scoped = resolveEventOrFail(tournament, options.selectedEventId || options.eventId);
  if (!scoped.ok) return scoped;
  if (!isOfficialGroupScheduleReady(scoped.event)) {
    return {
      ok: false,
      code: "SCHEDULE_NOT_READY",
      error: "Cần gán giờ và sân cho mọi trận trước khi công bố.",
    };
  }
  const matches = groupStageMatches(scoped.event);
  const result = publishSchedule(tournament, matches, {
    userId: options.userId,
    actor: options.actor || null,
  });
  if (!result.ok) {
    return { ok: false, code: "PUBLISH_FAILED", error: result.error };
  }
  return {
    ok: true,
    patch: { settings: result.tournament.settings },
    mutatesMatches: false,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SCHEDULE,
  };
}

export function projectOfficialMatchCenter(tournament, { selectedEventId } = {}) {
  const schedule = projectOfficialSchedule(tournament, { selectedEventId });
  if (!schedule.ok) {
    return {
      ...schedule,
      scoringEnabled: false,
      lifecycleEnabled: false,
      authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_MATCH,
    };
  }
  return {
    ok: true,
    eventId: schedule.eventId,
    matches: schedule.matches,
    lifecycleAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE,
    scoringAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.SCORING,
    resultAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT,
    refereeAuthority: OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT,
    // Mutations stay on Director / referee token / lifecycle RPCs — not invented here.
    scoreMatchCommand: null,
    acceptResultCommand: null,
    assignRefereeCommand: null,
    scoringEnabled: false,
    scoringHint:
      "Ghi điểm / chấp nhận kết quả: Director hoặc trọng tài (CORE-16/17). Không ghi điểm cục bộ trên màn này.",
    lifecycleHint: "Vòng đời trận = CORE-15. Không đổi status cục bộ trên màn này.",
    liveScoreTreatedAsFinal: false,
    completedTreatedAsAccepted: false,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_MATCH,
  };
}

export function projectOfficialStandings(tournament, { selectedEventId } = {}) {
  const scoped = resolveEventOrFail(tournament, selectedEventId);
  if (!scoped.ok) {
    return {
      ...scoped,
      groups: [],
      authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_STANDINGS,
    };
  }
  const { event } = scoped;
  const units = competitionEntriesForEvent(tournament, event);
  const qualifiersPerGroup = resolveOfficialQualifiersPerGroup(tournament);
  const eventForStandings = {
    ...event,
    entries: units.length ? units : event.entries,
  };
  const standings = buildOfficialAllGroupStandings(eventForStandings, {
    qualifiersPerGroup,
  });
  const qualification = officialQualificationReady(eventForStandings, {
    qualifiersPerGroup,
  });

  return {
    ok: true,
    eventId: scoped.eventId,
    event,
    units,
    qualifiersPerGroup,
    standings,
    qualification,
    // Blob Official path: completed/forfeit on event.matches (officialStandingsEngine).
    // CORE-17 accepted active is RPC/live path — Screen 12 does not invent a second filter.
    resultCountingPolicy: "officialStandingsEngine:completed_or_forfeit_on_event.matches",
    onlyAcceptedActiveViaCore17: false,
    formulaAuthority: "officialStandingsEngine",
    qualificationAuthority: "officialQualificationReady",
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_STANDINGS,
    blocker:
      groupStageMatches(event).length === 0
        ? { code: "MATCHES_MISSING", error: "Chưa có trận để xếp hạng." }
        : null,
  };
}
