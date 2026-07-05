/**
 * Phase 23D — Map club blob teamData → Supabase team_tournament_* rows.
 * Shared by seed CLI and unit tests.
 */

export const TEAM_TOURNAMENT_MODE = "team_tournament";

export function createSeedStats() {
  return {
    tournaments: { insert: 0, update: 0, skip: 0 },
    teams: { insert: 0, update: 0, skip: 0 },
    members: { insert: 0, update: 0, skip: 0 },
    disciplines: { insert: 0, update: 0, skip: 0 },
    matchups: { insert: 0, update: 0, skip: 0 },
    lineups: { insert: 0, update: 0, skip: 0 },
    lineupEntries: { insert: 0, update: 0, skip: 0 },
    subMatches: { insert: 0, update: 0, skip: 0 },
    standings: { insert: 0, update: 0, skip: 0 },
  };
}

function bump(stats, bucket, action) {
  stats[bucket][action] += 1;
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function rowsEqual(a, b, fields) {
  for (const field of fields) {
    const left = a?.[field];
    const right = b?.[field];
    if (typeof left === "object" || typeof right === "object") {
      if (stableJson(left) !== stableJson(right)) {
        return false;
      }
    } else if (left !== right) {
      return false;
    }
  }
  return true;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function memberRole(team, playerId) {
  if (String(team.captainPlayerId || "") === String(playerId)) {
    return "captain";
  }
  if ((team.deputyPlayerIds || []).map(String).includes(String(playerId))) {
    return "deputy";
  }
  return "member";
}

export function isTeamTournamentRecord(tournament) {
  return (
    tournament?.mode === TEAM_TOURNAMENT_MODE &&
    tournament?.teamData &&
    typeof tournament.teamData === "object"
  );
}

export function extractTeamTournamentsFromClubBlob(clubRow) {
  const data = clubRow?.data && typeof clubRow.data === "object" ? clubRow.data : {};
  const tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];

  return tournaments.filter(isTeamTournamentRecord).map((tournament) => ({
    ...tournament,
    clubId: String(tournament.clubId || clubRow.club_id || "").trim(),
    tenantId: String(
      tournament.tenantId || clubRow.venue_id || clubRow.tenant_id || ""
    ).trim(),
  }));
}

export function extractTeamTournamentsFromJson(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.filter(isTeamTournamentRecord);
  }

  if (Array.isArray(payload.tournaments)) {
    return payload.tournaments.filter(isTeamTournamentRecord).map((tournament) => ({
      ...tournament,
      clubId: String(tournament.clubId || payload.clubId || "").trim(),
      tenantId: String(tournament.tenantId || payload.tenantId || payload.venue_id || "").trim(),
    }));
  }

  if (isTeamTournamentRecord(payload)) {
    return [payload];
  }

  if (payload.data && typeof payload.data === "object") {
    return extractTeamTournamentsFromClubBlob({
      club_id: payload.club_id || payload.clubId,
      venue_id: payload.venue_id || payload.tenantId,
      data: payload.data,
    });
  }

  return [];
}

export function buildLineupEntries(selections = {}, tenantId, tournamentId, lineupId) {
  const entries = [];

  for (const [disciplineId, playerIds] of Object.entries(selections || {})) {
    const ids = Array.isArray(playerIds) ? playerIds : [];
    ids.forEach((playerId, index) => {
      entries.push({
        tenant_id: tenantId,
        tournament_id: tournamentId,
        lineup_id: lineupId,
        discipline_external_id: String(disciplineId),
        player_id: String(playerId),
        sort_order: index + 1,
      });
    });
  }

  return entries;
}

export function buildSeedPlanStats(tournament) {
  const teamData = tournament?.teamData || {};
  const lineups =
    teamData.lineups && typeof teamData.lineups === "object"
      ? Object.values(teamData.lineups)
      : [];
  const subMatches = (teamData.matchups || []).flatMap((matchup) => matchup.subMatches || []);
  const members = (teamData.teams || []).reduce(
    (sum, team) => sum + (team.playerIds || []).length,
    0
  );
  const lineupEntries = lineups.reduce((sum, lineup) => {
    const selections = lineup.selections || {};
    return (
      sum +
      Object.values(selections).reduce(
        (inner, playerIds) => inner + (Array.isArray(playerIds) ? playerIds.length : 0),
        0
      )
    );
  }, 0);

  return {
    tournaments: { insert: 1, update: 0, skip: 0 },
    teams: { insert: (teamData.teams || []).length, update: 0, skip: 0 },
    members: { insert: members, update: 0, skip: 0 },
    disciplines: { insert: (teamData.disciplines || []).length, update: 0, skip: 0 },
    matchups: { insert: (teamData.matchups || []).length, update: 0, skip: 0 },
    lineups: { insert: lineups.length, update: 0, skip: 0 },
    lineupEntries: { insert: lineupEntries, update: 0, skip: 0 },
    subMatches: { insert: subMatches.length, update: 0, skip: 0 },
    standings: { insert: (teamData.standings || []).length, update: 0, skip: 0 },
  };
}

export function isMissingTeamTournamentSchemaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("team_tournaments") &&
    (message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("schema cache"))
  );
}

export function summarizeSeedStats(stats) {
  const lines = [];
  for (const [bucket, counts] of Object.entries(stats)) {
    lines.push(
      `${bucket}: insert=${counts.insert} update=${counts.update} skip=${counts.skip}`
    );
  }
  return lines.join("\n");
}

async function fetchMaybeSingle(client, table, filters) {
  let query = client.from(table).select("*");
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`${table} lookup failed: ${error.message}`);
  }
  return data;
}

async function syncRow({ client, table, filters, row, compareFields, stats, bucket, dryRun }) {
  const existing = await fetchMaybeSingle(client, table, filters);

  if (!existing) {
    if (!dryRun) {
      const { data, error } = await client.from(table).insert(row).select("id").single();
      if (error) {
        throw new Error(`${table} insert failed: ${error.message}`);
      }
      bump(stats, bucket, "insert");
      return { id: data?.id || row.id || null, created: true };
    }
    bump(stats, bucket, "insert");
    return { id: row.id || null, created: true };
  }

  const patch = { ...row, updated_at: new Date().toISOString() };
  delete patch.id;
  delete patch.created_at;

  if (rowsEqual(existing, patch, compareFields)) {
    bump(stats, bucket, "skip");
    return { id: existing.id, created: false };
  }

  if (!dryRun) {
    const { error } = await client.from(table).update(patch).eq("id", existing.id);
    if (error) {
      throw new Error(`${table} update failed: ${error.message}`);
    }
  }
  bump(stats, bucket, "update");
  return { id: existing.id, created: false };
}

async function syncLineupEntries({
  client,
  lineupId,
  tenantId,
  tournamentId,
  selections,
  stats,
  dryRun,
}) {
  const desired = buildLineupEntries(selections, tenantId, tournamentId, lineupId);
  const { data: existingRows, error } = await client
    .from("team_tournament_lineup_entries")
    .select("*")
    .eq("lineup_id", lineupId);

  if (error) {
    throw new Error(`team_tournament_lineup_entries lookup failed: ${error.message}`);
  }

  const existingKey = (row) =>
    `${row.discipline_external_id}::${row.player_id}::${row.sort_order}`;
  const desiredKey = (row) =>
    `${row.discipline_external_id}::${row.player_id}::${row.sort_order}`;

  const existingSet = new Set((existingRows || []).map(existingKey));
  const desiredSet = new Set(desired.map(desiredKey));

  if (existingSet.size === desiredSet.size && [...desiredSet].every((key) => existingSet.has(key))) {
    bump(stats, "lineupEntries", "skip");
    return;
  }

  if (!dryRun) {
    const { error: deleteError } = await client
      .from("team_tournament_lineup_entries")
      .delete()
      .eq("lineup_id", lineupId);
    if (deleteError) {
      throw new Error(`team_tournament_lineup_entries delete failed: ${deleteError.message}`);
    }

    if (desired.length > 0) {
      const { error: insertError } = await client
        .from("team_tournament_lineup_entries")
        .insert(desired);
      if (insertError) {
        throw new Error(`team_tournament_lineup_entries insert failed: ${insertError.message}`);
      }
    }
  }

  if ((existingRows || []).length === 0) {
    bump(stats, "lineupEntries", "insert");
  } else {
    bump(stats, "lineupEntries", "update");
  }
}

/**
 * Seed one team tournament blob record into Supabase (idempotent).
 */
export async function seedTeamTournamentRecord(client, tournament, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const planOnly = Boolean(options.planOnly);
  const stats = options.stats || createSeedStats();
  const tenantId = String(options.tenantId || tournament.tenantId || "").trim();
  const clubId = String(tournament.clubId || "").trim();
  const tournamentId = String(tournament.id || "").trim();
  const teamData = tournament.teamData || {};

  if (!tenantId) {
    throw new Error(`Thiếu tenantId cho giải ${tournamentId || "(unknown)"}`);
  }
  if (!clubId) {
    throw new Error(`Thiếu clubId cho giải ${tournamentId}`);
  }
  if (!tournamentId) {
    throw new Error("Thiếu tournament.id trong blob");
  }

  if (planOnly) {
    const planStats = buildSeedPlanStats(tournament);
    for (const [bucket, counts] of Object.entries(planStats)) {
      stats[bucket].insert += counts.insert;
      stats[bucket].update += counts.update;
      stats[bucket].skip += counts.skip;
    }
    return {
      ok: true,
      dryRun: true,
      planOnly: true,
      tournamentId,
      tenantId,
      clubId,
      stats,
    };
  }

  const headerRow = {
    tenant_id: tenantId,
    club_id: clubId,
    tournament_id: tournamentId,
    name: String(tournament.name || "Giải đồng đội").trim(),
    status: String(tournament.status || "draft").trim(),
    settings: teamData.settings && typeof teamData.settings === "object" ? teamData.settings : {},
  };

  const headerResult = await syncRow({
    client,
    table: "team_tournaments",
    filters: {
      tenant_id: tenantId,
      club_id: clubId,
      tournament_id: tournamentId,
    },
    row: headerRow,
    compareFields: ["name", "status", "settings"],
    stats,
    bucket: "tournaments",
    dryRun,
  });

  const header = dryRun
    ? { id: "dry-run-header-id" }
    : headerResult.id
      ? { id: headerResult.id }
      : await fetchMaybeSingle(client, "team_tournaments", {
          tenant_id: tenantId,
          club_id: clubId,
          tournament_id: tournamentId,
        });

  if (!header?.id) {
    throw new Error(`Không resolve được team_tournaments.id cho ${tournamentId}`);
  }

  const teamUuidByExternal = {};

  for (const team of teamData.teams || []) {
    const externalTeamId = String(team.id || "").trim();
    if (!externalTeamId) {
      continue;
    }

    const teamRow = {
      tenant_id: tenantId,
      tournament_id: tournamentId,
      team_tournament_id: header.id,
      external_team_id: externalTeamId,
      name: String(team.name || externalTeamId).trim(),
      color: team.color ? String(team.color) : null,
      logo_url: team.logoUrl ? String(team.logoUrl) : null,
      captain_player_id: team.captainPlayerId ? String(team.captainPlayerId) : null,
      deputy_player_ids: uniqueStrings(team.deputyPlayerIds || []),
      absent_player_ids: uniqueStrings(team.absentPlayerIds || []),
      locked_player_ids: uniqueStrings(team.lockedPlayerIds || []),
    };

    const teamResult = await syncRow({
      client,
      table: "team_tournament_teams",
      filters: {
        team_tournament_id: header.id,
        external_team_id: externalTeamId,
      },
      row: teamRow,
      compareFields: [
        "name",
        "color",
        "logo_url",
        "captain_player_id",
        "deputy_player_ids",
        "absent_player_ids",
        "locked_player_ids",
      ],
      stats,
      bucket: "teams",
      dryRun,
    });

    let teamUuid = teamResult.id;
    if (!teamUuid && !dryRun) {
      const persisted = await fetchMaybeSingle(client, "team_tournament_teams", {
        team_tournament_id: header.id,
        external_team_id: externalTeamId,
      });
      teamUuid = persisted?.id;
    }
    if (!teamUuid && dryRun) {
      teamUuid = `dry-run-team-${externalTeamId}`;
    }
    teamUuidByExternal[externalTeamId] = teamUuid;

    const playerIds = uniqueStrings(team.playerIds || []);
    for (const playerId of playerIds) {
      const memberRow = {
        tenant_id: tenantId,
        tournament_id: tournamentId,
        team_id: teamUuid,
        player_id: playerId,
        role: memberRole(team, playerId),
      };

      await syncRow({
        client,
        table: "team_tournament_team_members",
        filters: {
          team_id: teamUuid,
          player_id: playerId,
        },
        row: memberRow,
        compareFields: ["role"],
        stats,
        bucket: "members",
        dryRun,
      });
    }
  }

  for (const discipline of teamData.disciplines || []) {
    const externalDisciplineId = String(discipline.id || "").trim();
    if (!externalDisciplineId) {
      continue;
    }

    const disciplineRow = {
      tenant_id: tenantId,
      tournament_id: tournamentId,
      team_tournament_id: header.id,
      external_discipline_id: externalDisciplineId,
      name: String(discipline.name || externalDisciplineId).trim(),
      category_type: String(discipline.categoryType || "doubles"),
      gender_requirement: String(discipline.genderRequirement || "any"),
      player_count: Number(discipline.playerCount) || 2,
      sort_order: Number(discipline.sortOrder) || 1,
      scoring_format:
        discipline.scoringFormat && typeof discipline.scoringFormat === "object"
          ? discipline.scoringFormat
          : {},
      counts_toward_result: discipline.countsTowardResult !== false,
    };

    await syncRow({
      client,
      table: "team_tournament_disciplines",
      filters: {
        team_tournament_id: header.id,
        external_discipline_id: externalDisciplineId,
      },
      row: disciplineRow,
      compareFields: [
        "name",
        "category_type",
        "gender_requirement",
        "player_count",
        "sort_order",
        "scoring_format",
        "counts_toward_result",
      ],
      stats,
      bucket: "disciplines",
      dryRun,
    });
  }

  const matchupUuidByExternal = {};

  for (const matchup of teamData.matchups || []) {
    const externalMatchupId = String(matchup.id || "").trim();
    if (!externalMatchupId) {
      continue;
    }

    const matchupRow = {
      tenant_id: tenantId,
      tournament_id: tournamentId,
      team_tournament_id: header.id,
      external_matchup_id: externalMatchupId,
      team_a_id: String(matchup.teamAId || "").trim(),
      team_b_id: String(matchup.teamBId || "").trim(),
      scheduled_at: matchup.scheduledAt || null,
      lineup_lock_at: matchup.lineupLockAt || null,
      court_label: matchup.courtLabel ? String(matchup.courtLabel) : null,
      status: String(matchup.status || "lineup_open"),
      result:
        matchup.result && typeof matchup.result === "object" ? matchup.result : null,
    };

    const matchupResult = await syncRow({
      client,
      table: "team_tournament_matchups",
      filters: {
        team_tournament_id: header.id,
        external_matchup_id: externalMatchupId,
      },
      row: matchupRow,
      compareFields: [
        "team_a_id",
        "team_b_id",
        "scheduled_at",
        "lineup_lock_at",
        "court_label",
        "status",
        "result",
      ],
      stats,
      bucket: "matchups",
      dryRun,
    });

    let matchupUuid = matchupResult.id;
    if (!matchupUuid && !dryRun) {
      const persisted = await fetchMaybeSingle(client, "team_tournament_matchups", {
        team_tournament_id: header.id,
        external_matchup_id: externalMatchupId,
      });
      matchupUuid = persisted?.id;
    }
    if (!matchupUuid && dryRun) {
      matchupUuid = `dry-run-matchup-${externalMatchupId}`;
    }
    matchupUuidByExternal[externalMatchupId] = matchupUuid;

    for (const subMatch of matchup.subMatches || []) {
      const externalSubMatchId = String(subMatch.id || "").trim();
      if (!externalSubMatchId) {
        continue;
      }

      const subMatchRow = {
        tenant_id: tenantId,
        tournament_id: tournamentId,
        matchup_id: matchupUuid,
        external_sub_match_id: externalSubMatchId,
        discipline_external_id: String(subMatch.disciplineId || "").trim(),
        sort_order: Number(subMatch.sortOrder) || 1,
        status: String(subMatch.status || "waiting"),
        score:
          subMatch.score && typeof subMatch.score === "object"
            ? subMatch.score
            : { teamA: 0, teamB: 0, games: [] },
        winner_team_id: subMatch.winnerTeamId ? String(subMatch.winnerTeamId) : null,
        result_confirmed_at: subMatch.resultConfirmedAt || null,
      };

      await syncRow({
        client,
        table: "team_tournament_sub_matches",
        filters: {
          matchup_id: matchupUuid,
          external_sub_match_id: externalSubMatchId,
        },
        row: subMatchRow,
        compareFields: [
          "discipline_external_id",
          "sort_order",
          "status",
          "score",
          "winner_team_id",
          "result_confirmed_at",
        ],
        stats,
        bucket: "subMatches",
        dryRun,
      });
    }
  }

  const lineups = teamData.lineups && typeof teamData.lineups === "object" ? teamData.lineups : {};
  for (const lineup of Object.values(lineups)) {
    if (!lineup?.matchupId || !lineup?.teamId) {
      continue;
    }

    const externalMatchupId = String(lineup.matchupId).trim();
    const teamExternalId = String(lineup.teamId).trim();
    const matchupUuid = matchupUuidByExternal[externalMatchupId];
    if (!matchupUuid) {
      continue;
    }

    const selections =
      lineup.selections && typeof lineup.selections === "object" ? lineup.selections : {};

    const lineupRow = {
      tenant_id: tenantId,
      tournament_id: tournamentId,
      matchup_id: matchupUuid,
      team_external_id: teamExternalId,
      status: String(lineup.status || "not_submitted"),
      selections,
      source: String(lineup.source || "captain"),
      audit_note: lineup.auditNote ? String(lineup.auditNote) : null,
      submitted_at: lineup.submittedAt || null,
      locked_at: lineup.lockedAt || null,
      published_at: lineup.publishedAt || null,
    };

    const lineupResult = await syncRow({
      client,
      table: "team_tournament_lineups",
      filters: {
        matchup_id: matchupUuid,
        team_external_id: teamExternalId,
      },
      row: lineupRow,
      compareFields: [
        "status",
        "selections",
        "source",
        "audit_note",
        "submitted_at",
        "locked_at",
        "published_at",
      ],
      stats,
      bucket: "lineups",
      dryRun,
    });

    let lineupUuid = lineupResult.id;
    if (!lineupUuid && !dryRun) {
      const persisted = await fetchMaybeSingle(client, "team_tournament_lineups", {
        matchup_id: matchupUuid,
        team_external_id: teamExternalId,
      });
      lineupUuid = persisted?.id;
    }
    if (!lineupUuid && dryRun) {
      lineupUuid = `dry-run-lineup-${externalMatchupId}-${teamExternalId}`;
    }

    if (Object.keys(selections).length > 0) {
      await syncLineupEntries({
        client,
        lineupId: lineupUuid,
        tenantId,
        tournamentId,
        selections,
        stats,
        dryRun,
      });
    }
  }

  for (const standing of teamData.standings || []) {
    const teamExternalId = String(standing.teamId || "").trim();
    if (!teamExternalId) {
      continue;
    }

    const standingRow = {
      tenant_id: tenantId,
      tournament_id: tournamentId,
      team_tournament_id: header.id,
      team_external_id: teamExternalId,
      rank: Number(standing.rank) || 0,
      played: Number(standing.played) || 0,
      wins: Number(standing.wins) || 0,
      losses: Number(standing.losses) || 0,
      sub_match_wins: Number(standing.subMatchWins) || 0,
      sub_match_losses: Number(standing.subMatchLosses) || 0,
      sub_match_diff: Number(standing.subMatchDiff) || 0,
      points_scored: Number(standing.pointsScored) || 0,
      points_conceded: Number(standing.pointsConceded) || 0,
      ranking_points: Number(standing.rankingPoints) || 0,
      computed_at: new Date().toISOString(),
    };

    await syncRow({
      client,
      table: "team_tournament_standings",
      filters: {
        team_tournament_id: header.id,
        team_external_id: teamExternalId,
      },
      row: standingRow,
      compareFields: [
        "rank",
        "played",
        "wins",
        "losses",
        "sub_match_wins",
        "sub_match_losses",
        "sub_match_diff",
        "points_scored",
        "points_conceded",
        "ranking_points",
      ],
      stats,
      bucket: "standings",
      dryRun,
    });
  }

  return {
    ok: true,
    dryRun,
    tournamentId,
    tenantId,
    clubId,
    stats,
  };
}

export async function loadTeamTournamentsFromClubDataV3(client, options = {}) {
  const clubId = String(options.clubId || "").trim();
  let query = client.from("club_data_v3").select("club_id, venue_id, data");

  if (clubId) {
    query = query.eq("club_id", clubId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`club_data_v3 read failed: ${error.message}`);
  }

  const tournaments = [];
  for (const row of data || []) {
    tournaments.push(...extractTeamTournamentsFromClubBlob(row));
  }
  return tournaments;
}
