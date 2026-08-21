/**
 * Resolve Adapter B modeState from durable competition tables (server/rpc client).
 * Does not invent participants or scores. Returns null when context cannot be resolved.
 *
 * Match-index precedence for canonical individual tournaments (INTERNAL / OFFICIAL):
 * 1. payload.events[*].matches[*] — durable Staging shape for Internal/Official
 * 2. payload.matches — preserved for modes/fixtures that store matches directly
 * Never silently overwrite conflicting IDs; fail closed on ambiguous duplicates.
 * Adapter B remains translation-only and must not crawl nested payload itself.
 */

import { COMPETITION_REFEREE_MODE } from "../../competition-engine/integration/referee/constants.js";
import { projectCompetitionMatchFormat } from "../../competition-engine/integration/referee/adapters/shared/competitionContentProjection.js";

function trim(value) {
  return String(value || "").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function failMatchIndex(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.failClosed = true;
  err.details = details;
  throw err;
}

function playerIdsForSide(match, entry, side) {
  const fromMatch = side === "A" ? match.participantIdsA : match.participantIdsB;
  if (Array.isArray(fromMatch) && fromMatch.length > 0) {
    return fromMatch.map((id) => String(id));
  }
  if (Array.isArray(entry?.playerIds) && entry.playerIds.length > 0) {
    return entry.playerIds.map((id) => String(id));
  }
  const entryId = side === "A" ? match.entryAId : match.entryBId;
  const id = trim(entryId);
  return id ? [id] : [];
}

function scoringRulesForMatch(match, event, payload) {
  return (
    match?.scoringRules ||
    match?.scoringFormat ||
    event?.scoringRules ||
    event?.scoringFormat ||
    payload?.scoringRules ||
    payload?.scoringFormat ||
    null
  );
}

function identityFingerprint(normalized) {
  return JSON.stringify({
    matchId: normalized.matchId,
    entryAId: normalized.entryAId || null,
    entryBId: normalized.entryBId || null,
    courtId: normalized.courtId || null,
    physicalCourtId: normalized.physicalCourtId || null,
    participantIdsA: normalized.participantIdsA || [],
    participantIdsB: normalized.participantIdsB || [],
  });
}

/**
 * Normalize one durable individual-tournament match into Adapter B modeState.matches shape.
 */
export function normalizeIndividualTournamentMatch(match, event = null, payload = {}) {
  if (!asObject(match)) return null;
  const matchId = trim(match.id || match.matchId);
  if (!matchId) return null;

  const entriesById = new Map(
    asArray(event?.entries)
      .filter((entry) => entry && entry.id != null)
      .map((entry) => [String(entry.id), entry])
  );
  const entryA = entriesById.get(trim(match.entryAId));
  const entryB = entriesById.get(trim(match.entryBId));
  const courtId =
    trim(match.physicalCourtId) ||
    trim(match.courtId) ||
    trim(match.court_id) ||
    null;

  const participantIdsA = playerIdsForSide(match, entryA, "A");
  const participantIdsB = playerIdsForSide(match, entryB, "B");
  const eventType = trim(event?.eventType || match.eventType) || null;
  const content = projectCompetitionMatchFormat({
    eventType,
    participantIdsA,
    participantIdsB,
    competitionMode: payload?.competitionMode || null,
  });

  return {
    ...match,
    id: matchId,
    matchId,
    status: match.status || "READY_TO_START",
    courtId: courtId || null,
    physicalCourtId: trim(match.physicalCourtId) || courtId || null,
    stage: match.stage || event?.stage || null,
    round: match.round ?? null,
    eventId: trim(event?.id) || trim(match.eventId) || null,
    eventType,
    groupId: match.groupId || null,
    entryAId: match.entryAId || null,
    entryBId: match.entryBId || null,
    participantIdsA,
    participantIdsB,
    competitionContentCode: content.competitionContentCode,
    competitionContentLabel: content.competitionContentLabel,
    matchFormat: content.matchFormat,
    expectedPlayersPerSide: content.expectedPlayersPerSide,
    scoringRules: scoringRulesForMatch(match, event, payload),
    scoringFormat: match.scoringFormat || scoringRulesForMatch(match, event, payload),
    scheduledAt:
      match.scheduledAt || match.scheduledStart || match.startAt || null,
    scheduledStart:
      match.scheduledStart || match.scheduledAt || match.startAt || null,
    scheduledEnd: match.scheduledEnd || match.endAt || null,
    lineupsLocked:
      match.lineupsLocked === true || Boolean(match.entryAId && match.entryBId),
  };
}

function indexMatchMap(target, normalized, sourceLabel) {
  const existing = target[normalized.matchId];
  if (!existing) {
    target[normalized.matchId] = normalized;
    return;
  }
  if (identityFingerprint(existing) === identityFingerprint(normalized)) {
    return;
  }
  failMatchIndex(
    "MATCH_IDENTITY_CONFLICT",
    `Conflicting match identity for ${normalized.matchId} (${sourceLabel})`,
    {
      matchId: normalized.matchId,
      source: sourceLabel,
      existingFingerprint: identityFingerprint(existing),
      incomingFingerprint: identityFingerprint(normalized),
    }
  );
}

/**
 * Build normalized matches map from durable canonical tournament payload.
 *
 * Precedence (INTERNAL / OFFICIAL):
 * - Index payload.events[*].matches[*] first (durable evidenced shape)
 * - Then merge payload.matches when present; equivalent IDs ok; conflicts fail closed
 *
 * Precedence (DAILY / other):
 * - Preserve existing payload.matches-only behavior (do not invent dailyPlay crawl here)
 *
 * @param {object} payload
 * @param {{ competitionMode?: string|null, competitionId?: string|null }} [options]
 * @returns {Record<string, object>}
 */
export function normalizeCanonicalTournamentMatchesFromPayload(payload, options = {}) {
  const root = asObject(payload) || {};
  const competitionMode = String(options.competitionMode || "")
    .trim()
    .toUpperCase();
  const competitionId = trim(options.competitionId);
  const usesEventMatches =
    competitionMode === COMPETITION_REFEREE_MODE.INTERNAL ||
    competitionMode === COMPETITION_REFEREE_MODE.OFFICIAL ||
    // Unknown mode with events still present — evidence-only individual shape
    (competitionMode === "" && asArray(root.events).length > 0);

  const fromEvents = {};
  if (usesEventMatches) {
    for (const event of asArray(root.events)) {
      if (!asObject(event)) continue;
      for (const match of asArray(event.matches)) {
        const normalized = normalizeIndividualTournamentMatch(match, event, root);
        if (!normalized) continue;
        if (
          competitionId &&
          trim(match.tournamentId) &&
          trim(match.tournamentId) !== competitionId
        ) {
          continue;
        }
        indexMatchMap(fromEvents, normalized, "payload.events[].matches");
      }
    }
  }

  const fromPayloadMatches = {};
  const direct = root.matches;
  if (asObject(direct)) {
    for (const [key, match] of Object.entries(direct)) {
      const normalized = normalizeIndividualTournamentMatch(
        asObject(match) ? { ...match, id: match.id || match.matchId || key } : match,
        null,
        root
      );
      if (!normalized) continue;
      indexMatchMap(fromPayloadMatches, normalized, "payload.matches");
    }
  } else if (Array.isArray(direct)) {
    for (const match of direct) {
      const normalized = normalizeIndividualTournamentMatch(match, null, root);
      if (!normalized) continue;
      indexMatchMap(fromPayloadMatches, normalized, "payload.matches[]");
    }
  }

  if (!usesEventMatches) {
    return fromPayloadMatches;
  }

  // Internal/Official: events first, then payload.matches without silent overwrite.
  const merged = { ...fromEvents };
  for (const normalized of Object.values(fromPayloadMatches)) {
    indexMatchMap(merged, normalized, "payload.matches");
  }
  return merged;
}

async function loadTeamHeader(client, competitionId) {
  const id = trim(competitionId);
  if (!id) return null;
  const byTournament = await client
    .from("team_tournaments")
    .select("id, tenant_id, club_id, tournament_id, name, status, settings")
    .eq("tournament_id", id)
    .maybeSingle();
  if (!byTournament.error && byTournament.data) return byTournament.data;
  const byId = await client
    .from("team_tournaments")
    .select("id, tenant_id, club_id, tournament_id, name, status, settings")
    .eq("id", id)
    .maybeSingle();
  if (!byId.error && byId.data) return byId.data;
  return null;
}

async function loadMatchup(client, header, assignment) {
  const matchupUuid = trim(assignment.matchupId || assignment.matchup_id);
  const externalMatchupId = trim(
    assignment.externalMatchupId || assignment.external_matchup_id
  );
  const matchId = trim(assignment.matchId);

  if (matchupUuid) {
    const { data } = await client
      .from("team_tournament_matchups")
      .select("*")
      .eq("id", matchupUuid)
      .maybeSingle();
    if (data) return data;
  }
  if (externalMatchupId) {
    const { data } = await client
      .from("team_tournament_matchups")
      .select("*")
      .eq("team_tournament_id", header.id)
      .eq("external_matchup_id", externalMatchupId)
      .maybeSingle();
    if (data) return data;
  }
  if (matchId) {
    const byExternal = await client
      .from("team_tournament_matchups")
      .select("*")
      .eq("team_tournament_id", header.id)
      .eq("external_matchup_id", matchId)
      .maybeSingle();
    if (!byExternal.error && byExternal.data) return byExternal.data;

    const { data: subByTenant } = await client
      .from("team_tournament_sub_matches")
      .select("*")
      .eq("tenant_id", header.tenant_id)
      .eq("external_sub_match_id", matchId)
      .maybeSingle();
    if (subByTenant?.matchup_id) {
      const { data: matchup } = await client
        .from("team_tournament_matchups")
        .select("*")
        .eq("id", subByTenant.matchup_id)
        .maybeSingle();
      if (matchup) return matchup;
    }
  }
  return null;
}

async function loadSubMatches(client, matchup) {
  const { data, error } = await client
    .from("team_tournament_sub_matches")
    .select("*")
    .eq("matchup_id", matchup.id)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return data || [];
}

async function loadTeams(client, header) {
  const { data } = await client
    .from("team_tournament_teams")
    .select("external_team_id, name")
    .eq("team_tournament_id", header.id);
  const map = {};
  for (const row of data || []) {
    map[String(row.external_team_id)] = String(row.name || "").trim() || null;
  }
  return map;
}

async function loadDisciplines(client, header) {
  const { data } = await client
    .from("team_tournament_disciplines")
    .select("external_discipline_id, name, scoring_format")
    .eq("team_tournament_id", header.id);
  const map = {};
  for (const row of data || []) {
    map[String(row.external_discipline_id)] = {
      name: row.name || null,
      scoringFormat: asObject(row.scoring_format),
    };
  }
  return map;
}

/**
 * Lineup player ids + display enrichment from published team lineups.
 */
async function loadPublishedLineups(client, header, matchup) {
  const { data } = await client
    .from("team_tournament_lineups")
    .select("team_external_id, status, selections")
    .eq("matchup_id", matchup.id);
  const byTeam = {};
  for (const row of data || []) {
    const teamId = trim(row.team_external_id);
    if (!teamId) continue;
    byTeam[teamId] = {
      status: trim(row.status).toLowerCase(),
      selections: asObject(row.selections) || {},
    };
  }
  return byTeam;
}

async function loadPlayerDisplayNames(client, playerIds) {
  const ids = [...new Set((playerIds || []).map(trim).filter(Boolean))];
  const names = {};
  if (!ids.length) return names;

  const { data: athletes } = await client
    .from("athletes")
    .select("id, display_name")
    .in("id", ids);
  for (const row of athletes || []) {
    const label = trim(row.display_name);
    if (label && row.id) names[String(row.id)] = label;
  }

  const missing = ids.filter((id) => !names[id]);
  if (missing.length) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, display_name, player_id")
      .in("id", missing);
    for (const row of profiles || []) {
      const label = trim(row.display_name);
      if (!label) continue;
      if (row.id) names[String(row.id)] = label;
      if (row.player_id) names[String(row.player_id)] = label;
    }
  }

  // Never fall back to raw UUID — leave unresolved so UI can show team name / "VĐV".
  return names;
}

/**
 * Resolve physical-court display labels. Never invent court identity from venueId.
 */
async function loadCourtDisplayLabels(client, courtIds, tenantId) {
  const ids = [...new Set((courtIds || []).map(trim).filter(Boolean))];
  const labels = {};
  if (!ids.length || !client || typeof client.from !== "function") return labels;

  let query = client
    .from("court_resource_physical_courts")
    .select("physical_court_id, display_name, display_code, display_number")
    .in("physical_court_id", ids);
  const scopedTenant = trim(tenantId);
  if (scopedTenant) {
    query = query.eq("tenant_id", scopedTenant);
  }
  const { data } = await query;
  for (const row of data || []) {
    const id = trim(row.physical_court_id);
    if (!id) continue;
    const label =
      trim(row.display_name) ||
      trim(row.display_code) ||
      (trim(row.display_number) ? `Sân ${trim(row.display_number)}` : "");
    if (label) labels[id] = label;
  }
  return labels;
}

function ingestNameRecord(names, id, value) {
  const key = trim(id);
  if (!key) return;
  if (typeof value === "string") {
    const label = trim(value);
    if (label) names[key] = label;
    return;
  }
  const row = asObject(value);
  if (!row) return;
  const label = trim(row.displayName || row.name || row.fullName || row.full_name);
  if (label) names[key] = label;
}

/**
 * Harvest a player directory that may be an object map or an array of {id, name}.
 * Never invents names.
 */
function harvestPlayerDirectory(names, source) {
  if (Array.isArray(source)) {
    for (const row of source) {
      if (!asObject(row)) continue;
      ingestNameRecord(names, row.id || row.playerId || row.athleteId, row);
    }
    return;
  }
  const map = asObject(source);
  if (!map) return;
  for (const [id, value] of Object.entries(map)) {
    ingestNameRecord(names, id, value);
  }
}

/**
 * Harvest entry / player display names already present on durable payload.
 * Does not invent names — only copies proven labels keyed by canonical ids.
 *
 * Entry/unit labels are keyed by entryId only.
 * Athlete names come from player directories / member records — never from the parent entry label.
 */
export function harvestParticipantNamesFromPayload(payload) {
  const names = {};
  const root = asObject(payload) || {};
  harvestPlayerDirectory(names, root.participantNames);
  harvestPlayerDirectory(names, root.players);
  harvestPlayerDirectory(names, root.playerDirectory);
  harvestPlayerDirectory(names, root.athletes);

  for (const event of asArray(root.events)) {
    if (!asObject(event)) continue;
    harvestPlayerDirectory(names, event.players);
    harvestPlayerDirectory(names, event.playerDirectory);
    for (const entry of asArray(event.entries)) {
      if (!asObject(entry)) continue;
      const entryId = trim(entry.id);
      const entryName = trim(entry.name || entry.displayName);
      if (entryId && entryName) names[entryId] = entryName;
      harvestPlayerDirectory(names, entry.members);
      harvestPlayerDirectory(names, entry.players);
      harvestPlayerDirectory(names, entry.playerNames);
      // Do NOT copy entryName onto entry.playerIds — that collapses athletes into the unit label.
    }
  }
  return names;
}

/**
 * Harvest court labels from durable payload court directories (never venueId→courtId).
 */
function harvestCourtLabelsFromPayload(payload) {
  const labels = {};
  const root = asObject(payload) || {};
  const fromMap = asObject(root.courtLabels) || asObject(root.courtNames);
  if (fromMap) {
    for (const [id, value] of Object.entries(fromMap)) {
      const key = trim(id);
      const label = typeof value === "string" ? trim(value) : trim(value?.name || value?.displayName);
      if (key && label) labels[key] = label;
    }
  }
  const courts = root.courts;
  if (Array.isArray(courts)) {
    for (const court of courts) {
      if (!asObject(court)) continue;
      const id = trim(court.id || court.physicalCourtId || court.courtId);
      const label = trim(court.name || court.displayName || court.label || court.courtLabel);
      if (id && label) labels[id] = label;
    }
  } else if (asObject(courts)) {
    for (const [id, value] of Object.entries(courts)) {
      const key = trim(id);
      if (!key) continue;
      if (typeof value === "string" && trim(value)) labels[key] = trim(value);
      else if (asObject(value)) {
        const label = trim(value.name || value.displayName || value.label || value.courtLabel);
        if (label) labels[key] = label;
      }
    }
  }
  return labels;
}

function collectMatchDirectoryIds(matchesMap) {
  const playerIds = [];
  const courtIds = [];
  for (const match of Object.values(asObject(matchesMap) || {})) {
    if (!asObject(match)) continue;
    for (const id of asArray(match.participantIdsA)) {
      if (trim(id)) playerIds.push(trim(id));
    }
    for (const id of asArray(match.participantIdsB)) {
      if (trim(id)) playerIds.push(trim(id));
    }
    const courtId = trim(match.physicalCourtId) || trim(match.courtId);
    if (courtId) courtIds.push(courtId);
  }
  return { playerIds, courtIds };
}

function enrichMatchesWithCourtLabels(matchesMap, courtLabels) {
  const source = asObject(matchesMap) || {};
  const labels = asObject(courtLabels) || {};
  const out = {};
  for (const [matchId, match] of Object.entries(source)) {
    if (!asObject(match)) {
      out[matchId] = match;
      continue;
    }
    if (trim(match.courtLabel)) {
      out[matchId] = match;
      continue;
    }
    const courtId = trim(match.physicalCourtId) || trim(match.courtId);
    const resolved = courtId ? trim(labels[courtId]) : "";
    out[matchId] = resolved ? { ...match, courtLabel: resolved } : match;
  }
  return out;
}

function lineupIdsForDiscipline(lineupRow, disciplineExternalId) {
  if (!lineupRow?.selections) return [];
  const key = trim(disciplineExternalId);
  const raw = lineupRow.selections[key];
  return Array.isArray(raw) ? raw.map(trim).filter(Boolean) : [];
}

/**
 * @param {{ from: Function }} client service-role or privileged server client
 * @param {object} assignment CORE-13 shaped assignment
 */
export async function resolveCanonicalRefereeModeState(client, assignment) {
  if (!client || typeof client.from !== "function" || !assignment) return null;
  const tenantId = trim(assignment.tenantId || assignment.tenant_id);
  const competitionId = trim(
    assignment.competitionId || assignment.tournamentId || assignment.tournament_id
  );
  const matchId = trim(assignment.matchId || assignment.match_id);
  if (!tenantId || !competitionId) return null;

  const teamState = await resolveTeamModeState(client, {
    tenantId,
    competitionId,
    matchId,
    assignment,
  });
  if (teamState) return teamState;

  const canonicalState = await resolveCanonicalTournamentModeState(client, {
    tenantId,
    competitionId,
    matchId,
  });
  if (canonicalState) return canonicalState;

  return null;
}

async function resolveTeamModeState(client, { tenantId, competitionId, matchId, assignment }) {
  const header = await loadTeamHeader(client, competitionId);
  if (!header) return null;
  if (trim(header.tenant_id) && trim(header.tenant_id) !== tenantId) return null;

  const matchup = await loadMatchup(client, header, { ...assignment, matchId });
  if (!matchup) {
    return {
      tenantId,
      competitionId: trim(header.tournament_id) || competitionId,
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      competitionName: trim(header.name) || null,
      clubId: header.club_id || null,
      venueId: header.tenant_id || tenantId,
      canonicalAssignmentAuthorityAvailable: true,
      matchups: {},
      matches: {},
      participantNames: {},
      displayPartial: true,
    };
  }

  const subMatches = await loadSubMatches(client, matchup);
  const [teamNames, disciplines, publishedLineups] = await Promise.all([
    loadTeams(client, header),
    loadDisciplines(client, header),
    loadPublishedLineups(client, header, matchup),
  ]);
  const teamAId = trim(matchup.team_a_id);
  const teamBId = trim(matchup.team_b_id);
  const lineupARoot = publishedLineups[teamAId] || null;
  const lineupBRoot = publishedLineups[teamBId] || null;

  const allPlayerIds = [];
  const projectedSubs = subMatches.map((sub) => {
    const externalId = trim(sub.external_sub_match_id) || trim(sub.id);
    const disciplineId = trim(sub.discipline_external_id);
    const discipline = disciplines[disciplineId] || {};
    const isDreambreaker =
      String(sub.discipline_external_id || "").toLowerCase() === "dreambreaker" ||
      externalId.startsWith("db-");
    const lineupA = lineupIdsForDiscipline(lineupARoot, disciplineId);
    const lineupB = lineupIdsForDiscipline(lineupBRoot, disciplineId);
    allPlayerIds.push(...lineupA, ...lineupB);
    const disciplineName = trim(discipline.name) || null;
    const content = projectCompetitionMatchFormat({
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      isDreambreaker,
      isTeamSubmatch: true,
      discipline: disciplineId || sub.discipline_external_id || null,
      disciplineName,
      lineupA,
      lineupB,
      matchId: externalId,
    });
    return {
      id: externalId,
      subMatchId: externalId,
      status: sub.status || "READY_TO_START",
      discipline: sub.discipline_external_id || null,
      disciplineName,
      isDreambreaker,
      lineupA,
      lineupB,
      competitionContentCode: content.competitionContentCode,
      competitionContentLabel: content.competitionContentLabel,
      matchFormat: content.matchFormat,
      expectedPlayersPerSide: content.expectedPlayersPerSide,
      lineupsLocked:
        lineupARoot?.status === "published" ||
        lineupARoot?.status === "locked" ||
        lineupBRoot?.status === "published" ||
        lineupBRoot?.status === "locked",
      sides: [
        {
          sideKey: "A",
          teamId: teamAId,
          teamName: teamNames[teamAId] || null,
          displayName: teamNames[teamAId] || null,
          participantIds: lineupA,
        },
        {
          sideKey: "B",
          teamId: teamBId,
          teamName: teamNames[teamBId] || null,
          displayName: teamNames[teamBId] || null,
          participantIds: lineupB,
        },
      ],
      scoringRules: discipline.scoringFormat || null,
      scoringFormat: discipline.scoringFormat || null,
      stage: null,
      courtId: matchup.court_id || null,
      courtLabel: matchup.court_label || null,
      scheduledAt: matchup.scheduled_at || null,
    };
  });

  const playerNames = await loadPlayerDisplayNames(client, allPlayerIds);
  const participantNames = {
    ...playerNames,
    ...(teamAId && teamNames[teamAId] ? { [teamAId]: teamNames[teamAId] } : {}),
    ...(teamBId && teamNames[teamBId] ? { [teamBId]: teamNames[teamBId] } : {}),
  };

  const matchupKey = trim(matchup.external_matchup_id) || trim(matchup.id);
  const defaultScoring =
    disciplines["mlp-md"]?.scoringFormat ||
    disciplines["mlp-xd1"]?.scoringFormat ||
    Object.values(disciplines).find((d) => d.scoringFormat)?.scoringFormat ||
    null;

  const focusSub =
    projectedSubs.find((sub) => sub.id === trim(matchId)) || projectedSubs[0] || null;
  const matchupProjection = {
    matchupId: matchupKey,
    teamAId,
    teamBId,
    teamAName: teamNames[teamAId] || null,
    teamBName: teamNames[teamBId] || null,
    status: matchup.status || "READY_TO_START",
    courtId: matchup.court_id || null,
    courtLabel: matchup.court_label || null,
    scheduledAt: matchup.scheduled_at || null,
    stage: asObject(matchup.schedule_meta)?.stage || null,
    round: asObject(matchup.schedule_meta)?.round ?? null,
    lineupsLocked: focusSub?.lineupsLocked === true,
    lineupA: focusSub?.lineupA || [],
    lineupB: focusSub?.lineupB || [],
    scoringRules: defaultScoring,
    scoringFormat: defaultScoring,
    subMatches: projectedSubs,
    dreambreaker: {
      required: projectedSubs.some((s) => s.isDreambreaker),
      status: projectedSubs.find((s) => s.isDreambreaker)?.status || "pending",
      scoringFormat:
        disciplines.dreambreaker?.scoringFormat || {
          scoringSystem: "RALLY",
          targetScore: 21,
          winBy: 2,
          rotationPoints: 4,
        },
    },
    sides: focusSub?.sides || [
      {
        sideKey: "A",
        teamId: teamAId,
        teamName: teamNames[teamAId] || null,
        displayName: teamNames[teamAId] || null,
        participantIds: [],
      },
      {
        sideKey: "B",
        teamId: teamBId,
        teamName: teamNames[teamBId] || null,
        displayName: teamNames[teamBId] || null,
        participantIds: [],
      },
    ],
  };

  // Index by external matchup id, uuid, and each sub id for deep-link matchId.
  const matchups = {
    [matchupKey]: matchupProjection,
    [trim(matchup.id)]: matchupProjection,
  };

  return Object.freeze({
    tenantId,
    competitionId: trim(header.tournament_id) || competitionId,
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    competitionName: trim(header.name) || null,
    clubId: header.club_id || null,
    venueId: header.tenant_id || tenantId,
    canonicalAssignmentAuthorityAvailable: true,
    participantNames,
    teamNames,
    assignments: [
      {
        matchupId: matchupKey,
        scope: "parent",
        status: "active",
        refereeUserId: trim(assignment.refereeUserId || assignment.referee_user_id),
      },
    ],
    matchups,
    matches: {},
    scoringRules: defaultScoring,
    scoringFormat: defaultScoring,
  });
}

async function resolveCanonicalTournamentModeState(client, { tenantId, competitionId, matchId }) {
  const { data: row } = await client
    .from("canonical_tournaments")
    .select("id, tenant_id, club_id, external_key, name, mode, status, payload")
    .or(`id.eq.${competitionId},external_key.eq.${competitionId}`)
    .maybeSingle();
  if (!row) return null;
  if (trim(row.tenant_id) && trim(row.tenant_id) !== tenantId) return null;

  const modeRaw = String(row.mode || "").trim().toUpperCase();
  let competitionMode = null;
  if (modeRaw.includes("DAILY")) competitionMode = COMPETITION_REFEREE_MODE.DAILY_PLAY;
  else if (modeRaw.includes("OFFICIAL")) competitionMode = COMPETITION_REFEREE_MODE.OFFICIAL;
  else if (modeRaw.includes("TEAM")) competitionMode = COMPETITION_REFEREE_MODE.TEAM;
  else if (modeRaw.includes("INTERNAL")) competitionMode = COMPETITION_REFEREE_MODE.INTERNAL;

  const payload = asObject(row.payload) || {};
  const resolvedCompetitionId = trim(row.id) || competitionId;
  const matches = normalizeCanonicalTournamentMatchesFromPayload(payload, {
    competitionMode,
    competitionId: resolvedCompetitionId,
  });
  const match = matchId && asObject(matches[matchId]) ? matches[matchId] : null;
  const scopedMatches = match ? { [matchId]: match } : matches;

  // Directory enrichment (same canonical sources Team already uses).
  // Adapter B stays translation-only; names/labels live on modeState.
  const harvestedNames = harvestParticipantNamesFromPayload(payload);
  const harvestedCourts = harvestCourtLabelsFromPayload(payload);
  const { playerIds, courtIds } = collectMatchDirectoryIds(scopedMatches);
  const [loadedPlayerNames, loadedCourtLabels] = await Promise.all([
    loadPlayerDisplayNames(client, playerIds),
    loadCourtDisplayLabels(client, courtIds, tenantId),
  ]);
  const participantNames = {
    ...harvestedNames,
    ...loadedPlayerNames,
  };
  const courtLabels = {
    ...harvestedCourts,
    ...loadedCourtLabels,
  };
  const enrichedMatches = enrichMatchesWithCourtLabels(scopedMatches, courtLabels);

  if (!competitionMode) {
    return {
      tenantId,
      competitionId: resolvedCompetitionId,
      competitionMode: null,
      competitionName: trim(row.name) || null,
      clubId: row.club_id || null,
      displayPartial: true,
      matches: enrichedMatches,
      participantNames,
      courtLabels,
    };
  }

  return {
    tenantId,
    competitionId: resolvedCompetitionId,
    competitionMode,
    competitionName: trim(row.name) || null,
    clubId: row.club_id || null,
    venueId: row.tenant_id || tenantId,
    canonicalAssignmentAuthorityAvailable: true,
    participantNames,
    courtLabels,
    matches: enrichedMatches,
    session: asObject(payload.session) || undefined,
    scoringRules:
      asObject(payload.scoringRules) ||
      asObject(match?.scoringRules) ||
      null,
  };
}

/**
 * Detect competition mode hint from assignment row signals without inventing data.
 */
export function detectCompetitionModeHint(assignment, modeState) {
  if (modeState?.competitionMode) return String(modeState.competitionMode).toUpperCase();
  if (
    assignment?.matchupId ||
    assignment?.matchup_id ||
    assignment?.externalMatchupId ||
    assignment?.external_matchup_id ||
    assignment?.subMatchId ||
    assignment?.sub_match_id
  ) {
    return COMPETITION_REFEREE_MODE.TEAM;
  }
  const mid = trim(assignment?.matchId || assignment?.match_id);
  if (mid.startsWith("matchup-") || mid.startsWith("sub-") || mid.startsWith("tt") || mid.startsWith("db-")) {
    return COMPETITION_REFEREE_MODE.TEAM;
  }
  return null;
}
