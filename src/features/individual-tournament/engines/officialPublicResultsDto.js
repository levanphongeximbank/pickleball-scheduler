/**
 * Sanitized Official public results DTO.
 * Never include referee tokens, ledger, tenant auth, private settings, or full blob.
 */

import { evaluateOfficialCompletionPredicate, resolveOfficialChampion } from "./officialCompletionEngine.js";
import { buildOfficialAllGroupStandings, resolveOfficialQualifiersPerGroup } from "./officialStandingsEngine.js";
import { getOfficialCompetitionSettings } from "./officialTournamentSettingsEngine.js";

const PUBLIC_MATCH_KEYS = [
  "id",
  "stage",
  "groupId",
  "bracketMatchId",
  "scoreA",
  "scoreB",
  "status",
  "scheduledStart",
  "courtId",
];

function entryName(event, entryId) {
  const entry = (event?.entries || []).find((item) => String(item.id) === String(entryId));
  return entry?.name || "";
}

function sanitizeMatch(event, match) {
  const out = {};
  PUBLIC_MATCH_KEYS.forEach((key) => {
    if (match?.[key] != null) out[key] = match[key];
  });
  out.entryAName = entryName(event, match?.entryAId);
  out.entryBName = entryName(event, match?.entryBId);
  out.winnerName = entryName(event, match?.winnerId);
  return out;
}

function sanitizeBracket(bracket) {
  if (!bracket || typeof bracket !== "object") return null;
  return {
    rounds: Array.isArray(bracket.rounds) ? bracket.rounds : [],
    generatedAt: bracket.generatedAt || null,
  };
}

export function buildOfficialPublicResultsDto(tournament) {
  const event = (tournament?.events || [])[0] || null;
  const settings = getOfficialCompetitionSettings(tournament);
  const qualifiersPerGroup = resolveOfficialQualifiersPerGroup(tournament);
  const standings = event ? buildOfficialAllGroupStandings(event, { qualifiersPerGroup }) : [];
  const champion = resolveOfficialChampion(tournament, event);
  const completion = evaluateOfficialCompletionPredicate(tournament);
  const publicStandings = standings.map((group) => ({
    group: group.group,
    groupId: group.groupId,
    standing: (group.standing || []).map((row) => ({
      name: row.name,
      matchPoints: row.matchPoints,
      scoreDiff: row.scoreDiff,
      pointsFor: row.pointsFor,
      wins: row.won,
    })),
    qualificationTieUnresolved: Boolean(group.qualificationTieUnresolved),
  }));

  return {
    ok: true,
    tournamentId: tournament?.id || "",
    name: tournament?.name || "",
    status: tournament?.status || "",
    publicStatus: completion.alreadyCompleted || completion.ok === true && tournament?.status === "completed"
      ? "completed"
      : tournament?.status || "",
    completed: Boolean(completion.alreadyCompleted || tournament?.status === "completed"),
    scoringMethod: "rally",
    roundTargets: settings.roundTargets,
    qualifiersPerGroup,
    groups: publicStandings,
    matches: (event?.matches || []).map((match) => sanitizeMatch(event, match)),
    bracket: sanitizeBracket(event?.bracket),
    champion: champion.ok
      ? { name: champion.championName, entryId: champion.championId }
      : null,
    runnerUp: champion.ok
      ? { name: champion.runnerUpName, entryId: champion.runnerUpId }
      : null,
  };
}
