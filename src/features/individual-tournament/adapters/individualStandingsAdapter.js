/**
 * Individual tournament standings (S1-D) — CC-08 STANDINGS_V2 primary when flags on.
 * Does not modify team tournament standings path.
 */
import {
  evaluateCanonicalStandingsRuntime,
  isStandingsV2Enabled,
} from "../../competition-core/index.js";
import {
  buildAllGroupStandings,
  buildGroupStandingFromMatches,
} from "../../../tournament/engines/rankingEngine.js";

function mapCanonicalRowsToStanding(rows = []) {
  return rows.map((row) => ({
    id: row.id || row.entryId,
    name: row.name || row.entryName || row.id,
    played: row.played ?? row.matchesPlayed ?? 0,
    won: row.won ?? row.wins ?? 0,
    draw: row.draw ?? row.draws ?? 0,
    lost: row.lost ?? row.losses ?? 0,
    pointsFor: row.pointsFor ?? row.pf ?? 0,
    pointsAgainst: row.pointsAgainst ?? row.pa ?? 0,
    scoreDiff: row.scoreDiff ?? row.diff ?? (row.pointsFor || 0) - (row.pointsAgainst || 0),
    matchPoints: row.matchPoints ?? row.points ?? 0,
    rank: row.rank ?? null,
    tieBreakReason: row.tieBreakReason || row.tieBreakExplanation || row.reason || "",
    qualified: row.qualified === true,
  }));
}

export function buildIndividualGroupStanding(groupPayload, options = {}) {
  const envSource = options.envSource;
  const forceCanonical = options.forceCanonical === true;
  const flagsOn = forceCanonical || isStandingsV2Enabled(envSource);

  const legacyExecutor = () =>
    buildGroupStandingFromMatches({
      group: groupPayload.group,
      entries: groupPayload.entries,
      matches: groupPayload.matches,
      pointsConfig: groupPayload.pointsConfig,
    });

  if (!flagsOn) {
    return {
      ...legacyExecutor(),
      source: "legacy",
      tieBreakExplanation: "matchPoints → scoreDiff → pointsFor → wins",
    };
  }

  const bridge = evaluateCanonicalStandingsRuntime({
    consumer: "individual_tournament",
    legacyPayload: {
      group: groupPayload.group,
      entries: groupPayload.entries,
      matches: groupPayload.matches,
      pointsConfig: groupPayload.pointsConfig,
    },
    legacyExecutor,
    executionMode: "canonical-primary",
    envSource: envSource || {
      VITE_COMPETITION_CORE_ENABLED: "true",
      VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED: "true",
    },
    groupComplete: options.groupComplete !== false,
  });

  const legacyShape = legacyExecutor();
  const standing = mapCanonicalRowsToStanding(
    bridge.legacyResult?.standing ||
      bridge.legacyResult?.rows ||
      bridge.legacyResult?.standings ||
      []
  );

  return {
    groupId: legacyShape.groupId,
    group: legacyShape.group,
    matchCount: legacyShape.matchCount,
    standing: standing.length ? standing : legacyShape.standing,
    source: bridge.usedCanonical ? "standings_v2" : "legacy",
    tieBreakExplanation:
      "STANDINGS_V2: match points → H2H → mini-table (3+) → point differential",
    comparisonOk: bridge.comparison?.ok,
    warnings: bridge.warnings || [],
  };
}

export function buildIndividualAllGroupStandings(event, options = {}) {
  const qualifiersPerGroup = Number(options.qualifiersPerGroup) || 2;
  const forceCanonical = options.forceCanonical === true;
  const envSource = options.envSource;
  const flagsOn = forceCanonical || isStandingsV2Enabled(envSource);

  if (!flagsOn) {
    return buildAllGroupStandings(event, options).map((groupStanding) => ({
      ...groupStanding,
      source: "legacy",
      tieBreakExplanation: "matchPoints → scoreDiff → pointsFor → wins",
    }));
  }

  const entries = event?.entries || [];
  const matches = event?.matches || [];

  return (event?.groups || [])
    .map((group) =>
      buildIndividualGroupStanding(
        {
          group,
          entries,
          matches,
          pointsConfig: group.pointsConfig,
        },
        { ...options, forceCanonical: true, envSource }
      )
    )
    .filter((groupStanding) => groupStanding.standing.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group, "vi", { numeric: true }))
    .map((groupStanding) => ({
      ...groupStanding,
      qualified: groupStanding.standing.slice(0, qualifiersPerGroup).map((row, index) => ({
        ...row,
        qualified: true,
        qualificationStatus: index === 0 ? "qualified_1st" : "qualified",
      })),
      standing: groupStanding.standing.map((row, index) => ({
        ...row,
        qualificationStatus:
          index < qualifiersPerGroup ? (index === 0 ? "qualified_1st" : "qualified") : "eliminated",
      })),
    }));
}

/** Hook placeholder for future post-tournament Rating V5 calculation (read-only prepare). */
export function preparePostTournamentRatingHooks(event, standings = []) {
  return {
    ready: false,
    note: "Post-tournament Rating V5 update is out of S1-D scope — consume standings only.",
    matchCount: (event?.matches || []).length,
    standingCount: standings.reduce((sum, group) => sum + (group.standing?.length || 0), 0),
  };
}
