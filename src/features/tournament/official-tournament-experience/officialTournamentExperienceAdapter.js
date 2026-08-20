/**
 * Official Tournament Experience Adapter (Wave O1 foundation).
 *
 * READ projections only. COMMAND surface is a delegation boundary — no new
 * business writers, no adapter-owned persistence.
 *
 * Downstream authority remains existing Official/Open domain/runtime + CORE-*.
 */

import {
  listTournamentEvents,
  mapEventSummary,
  resolveSelectedEvent,
} from "../experience-a1/deriveOverview.js";
import {
  isAiBalanceMode,
  isOpenMode,
  ratingMayInfluenceOpenPairingOrDraw,
  ratingMayInfluencePairing,
} from "../official-open-adapter-b/activation.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "./authorityLock.js";

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function readStatus(block) {
  if (!block || typeof block !== "object") return null;
  return block.status || null;
}

function countPairsReady(event) {
  const entries = Array.isArray(event?.entries) ? event.entries : [];
  return entries.filter((entry) => {
    const players = Array.isArray(entry?.playerIds) ? entry.playerIds.filter(Boolean) : [];
    return players.length >= 2 || Boolean(entry?.pairId) || Boolean(entry?.isPair);
  }).length;
}

function countGroups(event) {
  if (Array.isArray(event?.groups) && event.groups.length) return event.groups.length;
  if (Array.isArray(event?.groupStage?.groups)) return event.groupStage.groups.length;
  return 0;
}

function countScheduledMatches(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).filter((match) => {
    const status = String(match?.status || "").toLowerCase();
    return Boolean(match?.courtId || match?.scheduledAt || match?.slotId) || status === "scheduled";
  }).length;
}

function countKnockoutMatches(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).filter((match) => {
    const stage = String(match?.stage || match?.round || "").toLowerCase();
    return (
      Boolean(match?.bracketMatchId) ||
      stage.includes("knock") ||
      stage.includes("final") ||
      stage.includes("quarter") ||
      stage.includes("semi") ||
      stage === "r16" ||
      stage === "round_of_16"
    );
  }).length;
}

function courtIdsFrom(tournament) {
  const schedule = tournament?.courtSchedule;
  if (Array.isArray(schedule?.physicalCourtIds) && schedule.physicalCourtIds.length) {
    return schedule.physicalCourtIds;
  }
  if (Array.isArray(schedule?.courtIds)) return schedule.courtIds;
  return [];
}

function refereeAssignmentCount(tournament) {
  const assignments = tournament?.settings?.refereeAssignments;
  if (assignments && typeof assignments === "object") {
    return Object.keys(assignments).length;
  }
  return 0;
}

/**
 * @param {object|null|undefined} tournament
 * @param {{ selectedEventId?: string }} [options]
 */
export function projectOfficialTournamentExperience(tournament, options = {}) {
  const events = listTournamentEvents(tournament);
  const eventSummaries = events.map(mapEventSummary).filter(Boolean);
  const selectedEventId = trim(options.selectedEventId);
  const selectedEvent = resolveSelectedEvent(events, selectedEventId);
  const selectedSummary = selectedEvent ? mapEventSummary(selectedEvent) : null;

  const entryCount = eventSummaries.reduce((sum, event) => sum + event.entryCount, 0);
  const matchCount = eventSummaries.reduce((sum, event) => sum + event.matchCount, 0);
  const completedMatchCount = eventSummaries.reduce(
    (sum, event) => sum + event.completedMatchCount,
    0
  );
  const scheduledMatchCount = events.reduce((sum, event) => sum + countScheduledMatches(event), 0);
  const pairReadyCount = events.reduce((sum, event) => sum + countPairsReady(event), 0);
  const groupCount = events.reduce((sum, event) => sum + countGroups(event), 0);
  const knockoutMatchCount = events.reduce((sum, event) => sum + countKnockoutMatches(event), 0);
  const courts = courtIdsFrom(tournament);
  const drawStatus = readStatus(tournament?.settings?.draw);
  const scheduleStatus = readStatus(tournament?.settings?.schedule);
  const registration =
    tournament?.settings?.registration && typeof tournament.settings.registration === "object"
      ? tournament.settings.registration
      : {};

  return {
    identity: {
      tournamentId: trim(tournament?.id),
      name: trim(tournament?.name) || "Giải đấu",
      mode: trim(tournament?.mode),
      officialMode: tournament?.officialMode || null,
      status: trim(tournament?.status),
      tenantId: trim(tournament?.tenantId),
      clubId: trim(tournament?.clubId || tournament?.hostClubId),
      hostClubName: trim(tournament?.hostClubName),
    },
    events: eventSummaries,
    selectedEventId: selectedEventId || (selectedSummary ? selectedSummary.id : ""),
    selectedEvent: selectedSummary,
    /** Explicit: never invent a selected event from events[0] when many exist. */
    selectedEventExplicit: Boolean(selectedEventId) || events.length === 1,
    registrationSummary: {
      entryCount,
      opensAt: registration.opensAt || null,
      closesAt: registration.closesAt || null,
      lockedAt: registration.lockedAt || null,
      closedAt: registration.closedAt || null,
    },
    participantSummary: {
      entryCount,
      eventCount: eventSummaries.length,
    },
    pairingReadinessSummary: {
      pairReadyCount,
      entryCount,
      openRandomPairing: isOpenMode(tournament),
      aiBalancePairing: isAiBalanceMode(tournament),
      openPairingRatingNeutral: ratingMayInfluenceOpenPairingOrDraw() === false,
      aiBalanceMayUseRating: ratingMayInfluencePairing(tournament) === true,
    },
    groupReadinessSummary: {
      groupCount,
      drawStatus,
      ready: groupCount > 0 || Boolean(drawStatus),
    },
    scheduleSummary: {
      scheduleStatus,
      scheduledMatchCount,
      courtCount: courts.length,
    },
    matchSummary: {
      matchCount,
      scheduledMatchCount,
      completedMatchCount,
    },
    standingsSummary: {
      completedMatchCount,
      hasCompletedMatches: completedMatchCount > 0,
    },
    knockoutSummary: {
      knockoutMatchCount,
      ready: knockoutMatchCount > 0,
    },
    refereeReadinessSummary: {
      assignmentCount: refereeAssignmentCount(tournament),
      authority: OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT,
    },
    courtReadinessSummary: {
      courtCount: courts.length,
      configured: courts.length > 0,
      authority: OFFICIAL_EXPERIENCE_AUTHORITY.COURT,
    },
    awardsReadiness: {
      completedMatchCount,
      ready: trim(tournament?.status) === "completed" || completedMatchCount > 0,
    },
    completionReadiness: {
      status: trim(tournament?.status),
      completedMatchCount,
      matchCount,
      ready: trim(tournament?.status) === "completed",
    },
  };
}

/**
 * Command delegation boundary only — O1 does not move writers here.
 * Callers must continue using existing Official/Open services/engines.
 */
export function createOfficialExperienceCommandBoundary() {
  return Object.freeze({
    note: "O1 command surface is delegation-only. No adapter-owned writers.",
    authorities: { ...OFFICIAL_EXPERIENCE_AUTHORITY },
    // Explicit stubs — do not implement persistence here.
    updateSettings: null,
    registerParticipant: null,
    runPairing: null,
    runGroupDraw: null,
    publishSchedule: null,
    scoreMatch: null,
    assignReferee: null,
    reserveCourt: null,
    publishAwards: null,
    completeTournament: null,
  });
}

/**
 * @param {object|null|undefined} tournament
 * @param {{ selectedEventId?: string }} [options]
 */
export function createOfficialTournamentExperienceAdapter(tournament, options = {}) {
  const projection = projectOfficialTournamentExperience(tournament, options);
  return Object.freeze({
    kind: "official-tournament-experience-adapter",
    wave: "O1",
    projection,
    commands: createOfficialExperienceCommandBoundary(),
    /**
     * Re-project from a (possibly updated) tournament record.
     * Does not persist adapter state.
     */
    project(nextTournament = tournament, nextOptions = options) {
      return projectOfficialTournamentExperience(nextTournament, nextOptions);
    },
  });
}
