/**
 * Team Tournament Referee Adapter (ĐẦU B).
 * Translator / policy provider only. Does not own assignment, scoring, or result.
 *
 * Preserves Owner-accepted Team behavior:
 * - parent matchup assignment SSOT
 * - child override else parent
 * - Dreambreaker inherits parent; no second Dreambreaker assignment
 * - canonical uid authority
 * - organizer management authority
 * - CORE-17 ACCEPTED + ACTIVE official result only may propagate
 */

import { MATCH_STATUS } from "../../../competition-core/matches/index.js";
import { createScoringFormat } from "../../../competition-core/scoring/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
  assertResultPropagationPayload,
  assertScoringRulesPayload,
  failRefereeAdapter,
  requireAdapterRequest,
} from "../../../competition-engine/integration/referee/index.js";
import { freezeClone, isPlainObject } from "../../../competition-engine/integration/referee/helpers.js";
import {
  isDreambreakerSubMatch,
} from "../../engines/forfeitEngine.js";
import {
  resolveEffectiveRefereeAssignment,
} from "../../engines/teamRefereeCanonicalLifecycle.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";

function defaultFixtures() {
  return freezeClone({
    tenantId: "tenant-1",
    competitionId: "comp-ref-1",
    venueId: "venue-1",
    clubId: "club-1",
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    matches: {
      "match-1": {
        matchId: "match-1",
        status: MATCH_STATUS.READY_TO_START,
        scheduledAt: "2026-07-24T13:00:00.000Z",
        courtId: "court-1",
        physicalCourtId: "court-1",
        stage: "POOL",
        round: 1,
        parentMatchId: null,
        childMatchIds: ["child-1", "dreambreaker-1"],
        sides: [
          {
            sideKey: "A",
            entryId: "entry-a",
            teamId: "team-a",
            participantIds: ["p-a"],
          },
          {
            sideKey: "B",
            entryId: "entry-b",
            teamId: "team-b",
            participantIds: ["p-b"],
          },
        ],
        lineupsLocked: true,
        scoringRules: createScoringFormat({
          scoringSystem: "RALLY",
          pointsToWin: 11,
          winBy: 2,
          bestOfGames: 1,
        }),
      },
    },
  });
}

function translateTeamDataToFixtures(input = {}) {
  const tournament = input.tournament || {};
  const teamData = input.teamData || {};
  const tenantId = String(input.tenantId || tournament.tenantId || "").trim();
  const competitionId = String(
    input.competitionId || tournament.id || teamData.tournamentId || ""
  ).trim();
  const matches = {};
  for (const matchup of teamData.matchups || []) {
    const matchId = String(matchup.id || "").trim();
    if (!matchId) continue;
    const children = (matchup.subMatches || []).map((row) => String(row.id || "").trim()).filter(Boolean);
    matches[matchId] = {
      matchId,
      status: matchup.status || MATCH_STATUS.SCHEDULED,
      scheduledAt: matchup.scheduledAt || null,
      courtId: matchup.physicalCourtId || matchup.courtId || null,
      physicalCourtId: matchup.physicalCourtId || matchup.courtId || null,
      stage: matchup.stage || null,
      round: matchup.round ?? null,
      parentMatchId: null,
      childMatchIds: children,
      sides: [
        {
          sideKey: "A",
          entryId: matchup.teamAId,
          teamId: matchup.teamAId,
          participantIds: [],
        },
        {
          sideKey: "B",
          entryId: matchup.teamBId,
          teamId: matchup.teamBId,
          participantIds: [],
        },
      ],
      lineupsLocked: true,
      scoringRules: input.scoringRules || createScoringFormat({
        scoringSystem: "RALLY",
        pointsToWin: 11,
        winBy: 2,
        bestOfGames: 1,
      }),
    };
    for (const sub of matchup.subMatches || []) {
      const subId = String(sub.id || "").trim();
      if (!subId) continue;
      matches[subId] = {
        matchId: subId,
        status: sub.status || MATCH_STATUS.SCHEDULED,
        scheduledAt: matchup.scheduledAt || null,
        courtId: matchup.physicalCourtId || matchup.courtId || null,
        physicalCourtId: matchup.physicalCourtId || matchup.courtId || null,
        stage: matchup.stage || null,
        round: matchup.round ?? null,
        parentMatchId: matchId,
        childMatchIds: [],
        dreambreaker: isDreambreakerSubMatch(teamData, sub, matchup) === true,
        sides: matches[matchId].sides,
        lineupsLocked: true,
        scoringRules: matches[matchId].scoringRules,
      };
    }
  }
  return freezeClone({
    tenantId,
    competitionId,
    venueId: String(input.venueId || tournament.venueId || "").trim() || null,
    clubId: String(input.clubId || tournament.clubId || "").trim() || null,
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    refereeAssignments: input.refereeAssignments || teamData.refereeAssignments || [],
    matches,
  });
}

export function resolveTeamEffectiveReferee(fixtures, request = {}) {
  const match = fixtures.matches?.[request.matchId];
  const matchupId = match?.parentMatchId || match?.matchId;
  const subMatchId = match?.parentMatchId ? match.matchId : null;
  return resolveEffectiveRefereeAssignment({
    assignments: fixtures.refereeAssignments || [],
    matchupId,
    subMatchId: match?.dreambreaker ? null : subMatchId,
  });
}

/**
 * @param {{
 *   fixtures?: object,
 *   tournament?: object,
 *   teamData?: object,
 *   tenantId?: string,
 *   activation?: boolean,
 * }} [options]
 */
export function createTeamTournamentRefereeAdapter(options = {}) {
  const fromCompetition =
    options.tournament || options.teamData
      ? translateTeamDataToFixtures(options)
      : null;
  const fixtures = isPlainObject(options.fixtures)
    ? freezeClone({ ...defaultFixtures(), ...options.fixtures })
    : fromCompetition || defaultFixtures();
  const activation = options.activation !== false;

  function loadMatch(request) {
    const req = requireAdapterRequest(request);
    if (req.tenantId !== fixtures.tenantId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
        "Adapter request tenant does not match competition tenant",
        { tenantId: req.tenantId, expectedTenantId: fixtures.tenantId }
      );
    }
    if (req.competitionId !== fixtures.competitionId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "Unknown competition for Team referee adapter",
        { competitionId: req.competitionId }
      );
    }
    const matchId = req.matchId;
    if (!matchId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
        "matchId is required",
        {}
      );
    }
    const match = fixtures.matches?.[matchId];
    if (!match) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
        `Unknown match: ${matchId}`,
        { matchId }
      );
    }
    return { req, match };
  }

  return Object.freeze({
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: String(options.adapterId || TEAM_ADAPTER_B_NAMES[8]).trim(),
    adapterBName: TEAM_ADAPTER_B_NAMES[8],
    ordinal: 8,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.CONDITIONAL,
    activation,
    adapterBReady: true,
    sharedRuntime: options.sharedRuntime || "PARTIAL",
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    ownsAuthority: false,
    ownsScoringAuthority: false,
    ownsResultAuthority: false,
    ownsRefereeIdentity: false,
    getCompetitionContext(request) {
      const req = requireAdapterRequest(request);
      if (req.tenantId !== fixtures.tenantId) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
          "Adapter request tenant does not match competition tenant",
          { tenantId: req.tenantId, expectedTenantId: fixtures.tenantId }
        );
      }
      return freezeClone({
        tenantId: fixtures.tenantId,
        competitionId: fixtures.competitionId,
        competitionMode: COMPETITION_REFEREE_MODE.TEAM,
        venueId: fixtures.venueId,
        clubId: fixtures.clubId,
        competitionType: "team_tournament",
      });
    },
    getMatchContext(request) {
      const { req, match } = loadMatch(request);
      return freezeClone({
        matchId: match.matchId,
        competitionId: req.competitionId,
        tenantId: req.tenantId,
        status: match.status,
        scheduledAt: match.scheduledAt || null,
        courtId: match.physicalCourtId || match.courtId || null,
        physicalCourtId: match.physicalCourtId || match.courtId || null,
        stage: match.stage || null,
        round: match.round ?? null,
        parentMatchId: match.parentMatchId || null,
        childMatchIds: match.childMatchIds || [],
        dreambreaker: match.dreambreaker === true,
      });
    },
    getParticipants(request) {
      const { match } = loadMatch(request);
      return freezeClone({
        sides: match.sides || [],
        lineupsLocked: match.lineupsLocked === true,
      });
    },
    getScoringRules(request) {
      const { match } = loadMatch(request);
      if (!match.scoringRules) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          "Match has no scoring rules",
          { matchId: match.matchId }
        );
      }
      return assertScoringRulesPayload(match.scoringRules);
    },
    getLifecyclePolicy(request) {
      loadMatch(request);
      return freezeClone({
        policyId: "competition.referee.lifecycle.v1",
        requiresAssignment: true,
        requiresLineups: true,
        canStartFrom: [MATCH_STATUS.READY_TO_START, MATCH_STATUS.SCHEDULED],
        completionRequiresAcceptedResult: true,
        standingsRequireAcceptedResult: true,
        parentAssignmentIsSsot: true,
        childOverrideElseParent: true,
        dreambreakerInheritsParent: true,
        noSecondDreambreakerAssignment: true,
      });
    },
    getCapabilities(request) {
      loadMatch(request);
      return freezeClone({
        scoring: true,
        suspend: true,
        resume: true,
        incidentReport: true,
        childOverrideAssignment: true,
        dreambreakerInheritsParent: true,
        noSecondDreambreakerAssignment: true,
        organizerManagementAuthority: true,
        canonicalUidAuthority: true,
        automaticIdempotentRuntimeEnsure: true,
        assignmentScopedWrite: true,
        ownsScoringAuthority: false,
        ownsResultAuthority: false,
        ownsRefereeIdentity: false,
      });
    },
    validatePreStart(request) {
      const { match } = loadMatch(request);
      const blockers = [];
      if (!match.scoringRules) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          message: "Scoring rules missing",
        });
      }
      if (!Array.isArray(match.sides) || match.sides.length !== 2) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Two sides are required",
        });
      }
      if (match.dreambreaker === true) {
        const inherited = resolveTeamEffectiveReferee(fixtures, {
          matchId: match.parentMatchId || match.matchId,
        });
        if (!inherited) {
          blockers.push({
            code: REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
            message: "Dreambreaker inherits parent assignment — parent required",
          });
        }
      }
      return freezeClone({
        ok: blockers.length === 0,
        blockers,
      });
    },
    resolveResultPropagation(request) {
      loadMatch(request);
      return assertResultPropagationPayload({
        propagateOnlyIfAccepted: true,
        targets: ["standings", "bracket", "qualification", "aggregate"],
        instructions: {
          source: "CORE-17 accepted active result only",
          adapterMustNotAccept: true,
          unofficialResultForbidden: true,
        },
      });
    },
  });
}

export const TeamTournamentRefereeAdapter = {
  create: createTeamTournamentRefereeAdapter,
};
