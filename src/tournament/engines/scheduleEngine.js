import { buildRoundRobinRounds } from "../../pages/tournament.fixtures.logic.js";
import { MATCH_STAGE, MATCH_STATUS } from "../../models/tournament/constants.js";
import { createMatchRecord } from "../../models/tournament/match.js";
import { entriesToTeams } from "./teamPairingEngine.js";
import {
  applyOpponentRulesToGroupStageSchedule,
  isPrivatePairingRuntimeEnabled,
} from "../../features/private-pairing-rules/runtime/index.js";

function buildMatchId(groupLabel, roundNumber, index) {
  return `G${groupLabel}-R${roundNumber}-M${index + 1}`;
}

export function buildRoundRobinMatchesForGroup(group, options = {}) {
  const tournamentId = options.tournamentId || group.tournamentId || "";
  const eventId = options.eventId || group.eventId || "";
  const entries = group.entries || [];
  const teams = entriesToTeams(entries, options.players || []);
  const rounds = buildRoundRobinRounds(teams);
  const matches = [];

  rounds.forEach((round) => {
    round.matches.forEach((fixture, index) => {
      matches.push(
        createMatchRecord({
          id: buildMatchId(group.label, round.roundNumber, index),
          tournamentId,
          eventId,
          groupId: group.id,
          stage: MATCH_STAGE.GROUP,
          round: round.roundNumber,
          entryAId: fixture.home?.id || "",
          entryBId: fixture.away?.id || "",
          status: MATCH_STATUS.WAITING,
        })
      );
    });
  });

  return {
    rounds,
    matches,
  };
}

export function buildGroupStageSchedule(groups = [], options = {}) {
  const nextGroups = [];
  const allMatches = [];

  groups.forEach((group) => {
    const schedule = buildRoundRobinMatchesForGroup(group, options);
    nextGroups.push({
      ...group,
      matches: schedule.matches,
    });
    allMatches.push(...schedule.matches);
  });

  const baseSchedule = {
    groups: nextGroups,
    matches: allMatches,
    roundCount: nextGroups.reduce((max, group) => {
      const groupMax = (group.matches || []).reduce(
        (inner, match) => Math.max(inner, Number(match.round || 0)),
        0
      );
      return Math.max(max, groupMax);
    }, 0),
    ok: true,
    privatePairingError: null,
  };

  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    return baseSchedule;
  }

  if (!(options.privatePairingRules || []).length && !options.forceOpponentStage) {
    return baseSchedule;
  }

  const applied = applyOpponentRulesToGroupStageSchedule(baseSchedule, {
    players: options.players || [],
    privatePairingRules: options.privatePairingRules || [],
    legacyConstraints: options.pairingConstraints || [],
    clubId: options.clubId || null,
    tournamentId: options.tournamentId || null,
    eventId: options.eventId || null,
    competitionClass: options.competitionClass,
    envSource: options.envSource,
    allowedByPublishedRules: options.allowedByPublishedRules === true,
    contextTime: options.contextTime,
    history: options.pairingHistory || options.history || {},
    requireCompleteSet: options.requireCompleteSet !== false,
  });

  if (!applied.ok) {
    return {
      groups: [],
      matches: [],
      roundCount: 0,
      ok: false,
      privatePairingError: applied.privatePairingError,
    };
  }

  return {
    groups: applied.groups,
    matches: applied.matches,
    roundCount: applied.groups.reduce((max, group) => {
      const groupMax = (group.matches || []).reduce(
        (inner, match) => Math.max(inner, Number(match.round || 0)),
        0
      );
      return Math.max(max, groupMax);
    }, 0),
    ok: true,
    privatePairingError: null,
  };
}

export function countGroupStageMatches(groups = []) {
  return (groups || []).reduce(
    (sum, group) => sum + (group.matches?.length || 0),
    0
  );
}
