/**
 * Resolve Adapter B modeState from durable competition tables (server/rpc client).
 * Does not invent participants or scores. Returns null when context cannot be resolved.
 */

import { COMPETITION_REFEREE_MODE } from "../../competition-engine/integration/referee/constants.js";

function trim(value) {
  return String(value || "").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
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
    return {
      id: externalId,
      subMatchId: externalId,
      status: sub.status || "READY_TO_START",
      discipline: sub.discipline_external_id || null,
      isDreambreaker,
      lineupA,
      lineupB,
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
  const matches = asObject(payload.matches) || {};
  const match = matches[matchId] || null;

  if (!competitionMode) {
    return {
      tenantId,
      competitionId,
      competitionMode: null,
      competitionName: trim(row.name) || null,
      clubId: row.club_id || null,
      displayPartial: true,
      matches: match ? { [matchId]: match } : {},
      participantNames: asObject(payload.participantNames) || {},
    };
  }

  return {
    tenantId,
    competitionId,
    competitionMode,
    competitionName: trim(row.name) || null,
    clubId: row.club_id || null,
    venueId: row.tenant_id || tenantId,
    canonicalAssignmentAuthorityAvailable: true,
    participantNames: asObject(payload.participantNames) || {},
    matches: match
      ? { [matchId]: match }
      : matches,
    session: asObject(payload.session) || undefined,
    scoringRules: asObject(payload.scoringRules) || asObject(match?.scoringRules) || null,
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
