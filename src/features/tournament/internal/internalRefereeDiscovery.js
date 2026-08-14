/**
 * Authenticated Internal referee discovery — reuse shared hub, canonical payload.
 * Fail-closed: only matches linked to auth.uid() / exact email / roster canonicalUserId.
 */
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { getRefereeSettings } from "../../../models/tournament/refereeRoster.js";

export function matchInternalRefereeIdentity(user, referee, rosterEntry) {
  if (!user?.id || !referee) return false;
  const uid = String(user.id).trim();
  const email = String(user.email || "").trim().toLowerCase();
  const canonical = String(
    referee.canonicalUserId ||
      referee.refereeUserId ||
      rosterEntry?.canonicalUserId ||
      rosterEntry?.refereeUserId ||
      ""
  ).trim();
  if (canonical && canonical === uid) return true;
  const refereeEmail = String(referee.email || rosterEntry?.email || "")
    .trim()
    .toLowerCase();
  if (email && refereeEmail && refereeEmail === email) return true;
  const name = String(referee.name || "").trim().toLowerCase();
  return Boolean(email && name && name === email);
}

export function isInternalRefereeAssignedToMatch(user, match, roster = []) {
  const referee = match?.referee;
  if (!referee) return false;
  const rosterId = String(referee.rosterId || referee.id || "").trim();
  const rosterEntry =
    (roster || []).find((entry) => String(entry?.id || "") === rosterId) || null;
  return matchInternalRefereeIdentity(user, referee, rosterEntry);
}

export function projectInternalRefereeHubMatch({
  tournament,
  event,
  match,
  user,
} = {}) {
  if (!tournament || !match || !user) return null;
  const roster = getRefereeSettings(tournament).roster || [];
  if (!isInternalRefereeAssignedToMatch(user, match, roster)) return null;
  const entries = event?.entries || [];
  const label = (id) =>
    entries.find((entry) => String(entry.id) === String(id))?.name || id || "—";
  const referee = match.referee || {};
  return {
    matchId: match.id,
    tournamentId: tournament.id,
    tournamentName: tournament.name || tournament.id,
    courtId: match.courtId || null,
    scheduledStart: match.scheduledStart || null,
    refereeToken: referee.token || "",
    refereeName: referee.name || "",
    team1Name: label(match.entryAId),
    team2Name: label(match.entryBId),
    score1: Number(match.scoreA) || 0,
    score2: Number(match.scoreB) || 0,
    status: match.status || "assigned",
    source: "internal_canonical",
    accessPath: referee.token ? `/referee/${encodeURIComponent(referee.token)}` : "",
  };
}

export const INTERNAL_REFEREE_DISCOVERY_READER = "listTournamentsQuery+listInternalRefereeHubAssignments";

export function listInternalRefereeHubAssignments({
  tournaments = [],
  user,
  clubId = "",
  tenantId = "",
} = {}) {
  if (!user?.id) {
    return { ok: false, code: "NOT_AUTHENTICATED", matches: [] };
  }
  const wantedClub = String(clubId || "").trim();
  const wantedTenant = String(tenantId || "").trim();
  const matches = [];
  for (const tournament of tournaments || []) {
    if (String(tournament?.mode || "") !== TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
      continue;
    }
    if (wantedClub && String(tournament.clubId || "") !== wantedClub) {
      continue;
    }
    if (wantedTenant && String(tournament.tenantId || "") !== wantedTenant) {
      continue;
    }
    const event = tournament.events?.[0];
    for (const match of event?.matches || []) {
      const projected = projectInternalRefereeHubMatch({
        tournament,
        event,
        match,
        user,
      });
      if (projected) matches.push(projected);
    }
  }
  return { ok: true, matches };
}

export function buildInternalRefereeMatchLiveRecord({
  clubId,
  tournament,
  event,
  match,
  courts = [],
  buildMatchLiveRecordFn,
  resolveMatchLabelsFn,
} = {}) {
  if (!match?.referee || typeof buildMatchLiveRecordFn !== "function") {
    return null;
  }
  const labels =
    typeof resolveMatchLabelsFn === "function"
      ? resolveMatchLabelsFn(match, {
          entries: event?.entries || [],
          courts,
        })
      : {};
  return buildMatchLiveRecordFn({
    clubId,
    tournamentId: tournament?.id,
    eventId: event?.id,
    match,
    labels,
    isDaily: false,
    tournamentName: tournament?.name || "",
  });
}
