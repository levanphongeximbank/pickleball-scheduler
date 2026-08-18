/**
 * Translate Tournament / Competition identity payload into Adapter B modeState.
 * Adapter B remains translator-only. Match identity is not created here.
 * Request-body Adapter objects are never accepted.
 */

import {
  COMPETITION_REFEREE_MODE,
  COMPETITION_REFEREE_MODE_VALUES,
  COMPETITION_TYPE_TO_REFEREE_MODE,
} from "../../competition-engine/integration/referee/constants.js";
import { createDailyPlayRefereeAdapter } from "../../competition-engine/integration/referee/adapters/DailyPlayRefereeAdapter.js";
import { createInternalTournamentRefereeAdapter } from "../../competition-engine/integration/referee/adapters/InternalTournamentRefereeAdapter.js";
import { createOfficialTournamentRefereeAdapter } from "../../competition-engine/integration/referee/adapters/OfficialTournamentRefereeAdapter.js";
import { createTeamTournamentRefereeAdapter } from "../../competition-engine/integration/referee/adapters/TeamTournamentRefereeAdapter.js";
import { REFEREE_V5_ERROR, createPersistenceError } from "../persistence/errors.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function resolveCompetitionModeFromIdentity(row, payload = {}) {
  const candidates = [row?.mode, payload.mode, payload.competitionMode, payload.competitionType];
  for (const candidate of candidates) {
    const raw = text(candidate);
    if (!raw) continue;
    const upper = raw.toUpperCase();
    if (COMPETITION_REFEREE_MODE_VALUES.includes(upper)) return upper;
    const mapped =
      COMPETITION_TYPE_TO_REFEREE_MODE[raw] ||
      COMPETITION_TYPE_TO_REFEREE_MODE[raw.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

function playerIds(match, entry, side) {
  const fromMatch = side === "A" ? match.participantIdsA : match.participantIdsB;
  if (Array.isArray(fromMatch) && fromMatch.length > 0) {
    return fromMatch.map((id) => String(id));
  }
  if (Array.isArray(entry?.playerIds) && entry.playerIds.length > 0) {
    return entry.playerIds.map((id) => String(id));
  }
  const entryId = side === "A" ? match.entryAId : match.entryBId;
  return text(entryId) ? [text(entryId)] : [];
}

function scoringRules(match, event, payload, row) {
  return (
    match?.scoringRules ||
    match?.scoringFormat ||
    event?.scoringRules ||
    event?.scoringFormat ||
    payload?.scoringRules ||
    payload?.scoringFormat ||
    row?.engine_v4?.scoringRules ||
    row?.engine_v4?.scoringFormat ||
    null
  );
}

function mapIndividualMatches(payload, row) {
  const matches = {};
  const events = asArray(payload.events);
  for (const event of events) {
    if (!isPlainObject(event)) continue;
    const entriesById = new Map(
      asArray(event.entries)
        .filter((entry) => entry && entry.id != null)
        .map((entry) => [String(entry.id), entry])
    );
    for (const match of asArray(event.matches)) {
      if (!isPlainObject(match)) continue;
      const matchId = text(match.id || match.matchId);
      if (!matchId) continue;
      if (text(match.tournamentId) && text(match.tournamentId) !== text(row.id)) {
        continue;
      }
      const entryA = entriesById.get(text(match.entryAId));
      const entryB = entriesById.get(text(match.entryBId));
      matches[matchId] = {
        matchId,
        status: match.status || "READY_TO_START",
        courtId: match.courtId || null,
        stage: match.stage || event.stage || null,
        round: match.round ?? null,
        eventId: event.id || match.eventId || null,
        entryAId: match.entryAId || null,
        entryBId: match.entryBId || null,
        participantIdsA: playerIds(match, entryA, "A"),
        participantIdsB: playerIds(match, entryB, "B"),
        scoringRules: scoringRules(match, event, payload, row),
        lineupsLocked:
          match.lineupsLocked === true || Boolean(match.entryAId && match.entryBId),
      };
    }
  }
  if (Object.keys(matches).length === 0 && isPlainObject(payload.matches)) {
    return payload.matches;
  }
  return matches;
}

function mapDailyMatches(payload, row) {
  const daily =
    payload.settings?.dailyPlay && isPlainObject(payload.settings.dailyPlay)
      ? payload.settings.dailyPlay
      : isPlainObject(payload.dailyPlay)
        ? payload.dailyPlay
        : payload;
  const matches = {};
  const list = asArray(daily.matches);
  if (list.length === 0 && isPlainObject(daily.matches)) {
    return { session: daily.session || daily, matches: daily.matches };
  }
  for (const match of list) {
    if (!isPlainObject(match)) continue;
    const matchId = text(match.id || match.matchId);
    if (!matchId) continue;
    matches[matchId] = {
      matchId,
      status: match.status || "ready",
      courtId: match.courtId || null,
      teamAPlayerIds: asArray(match.teamAPlayerIds).map(String),
      teamBPlayerIds: asArray(match.teamBPlayerIds).map(String),
      scoringRules: scoringRules(match, null, payload, row),
      lineupsLocked: match.lineupsLocked === true,
    };
  }
  return {
    session: isPlainObject(daily.session) ? daily.session : daily,
    matches: Object.keys(matches).length > 0 ? matches : daily.matches || {},
  };
}

function mapTeamMatchups(payload) {
  if (isPlainObject(payload.matchups)) return payload.matchups;
  const list = asArray(payload.matchups);
  const matchups = {};
  for (const matchup of list) {
    if (!isPlainObject(matchup)) continue;
    const id = text(matchup.matchupId || matchup.id);
    if (!id) continue;
    matchups[id] = { ...matchup, matchupId: id };
  }
  return matchups;
}

export function mapCanonicalIdentityToAdapterBModeState(row) {
  if (!isPlainObject(row) || !text(row.id)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Canonical tournament identity is required."
    );
  }
  const tenantId = text(row.tenant_id);
  if (!tenantId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
      "Tournament tenant evidence is missing."
    );
  }
  const payload = isPlainObject(row.payload) ? row.payload : {};
  if (text(payload.tenantId) && text(payload.tenantId) !== tenantId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }

  const competitionMode = resolveCompetitionModeFromIdentity(row, payload);
  if (!competitionMode) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Cannot resolve Adapter B competition mode from tournament identity."
    );
  }

  const base = {
    tenantId,
    competitionId: text(row.id),
    competitionMode,
    competitionType: payload.competitionType || row.mode || null,
    venueId: payload.venueId || null,
    clubId: row.club_id || payload.clubId || null,
  };

  let modeState;
  if (competitionMode === COMPETITION_REFEREE_MODE.DAILY_PLAY) {
    const daily = mapDailyMatches(payload, row);
    modeState = {
      ...base,
      session: daily.session,
      matches: daily.matches,
      scoringRules: payload.scoringRules || null,
    };
  } else if (competitionMode === COMPETITION_REFEREE_MODE.TEAM) {
    modeState = {
      ...base,
      matchups: mapTeamMatchups(payload),
      matches: isPlainObject(payload.matches) ? payload.matches : {},
      assignments: asArray(payload.assignments),
    };
  } else {
    modeState = {
      ...base,
      matches: mapIndividualMatches(payload, row),
      scoringRules: payload.scoringRules || payload.scoringFormat || null,
    };
  }

  return { ok: true, tenantId, competitionMode, modeState };
}

export function createServerResolvedAdapterB(competitionMode, modeState) {
  const options = { modeState };
  if (competitionMode === COMPETITION_REFEREE_MODE.INTERNAL) {
    return createInternalTournamentRefereeAdapter(options);
  }
  if (competitionMode === COMPETITION_REFEREE_MODE.OFFICIAL) {
    return createOfficialTournamentRefereeAdapter(options);
  }
  if (competitionMode === COMPETITION_REFEREE_MODE.DAILY_PLAY) {
    return createDailyPlayRefereeAdapter(options);
  }
  if (competitionMode === COMPETITION_REFEREE_MODE.TEAM) {
    return createTeamTournamentRefereeAdapter(options);
  }
  return null;
}
