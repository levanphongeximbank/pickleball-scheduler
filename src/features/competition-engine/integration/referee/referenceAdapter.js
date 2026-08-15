/**
 * Reference / certification test adapter. Not a tournament-mode adapter.
 */

import { createScoringFormat } from "../../../competition-core/scoring/index.js";
import { MATCH_STATUS } from "../../../competition-core/matches/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
} from "./constants.js";
import {
  assertResultPropagationPayload,
  assertScoringRulesPayload,
  normalizeRefereeAdapterMode,
  requireAdapterRequest,
} from "./contract.js";
import { failRefereeAdapter } from "./errors.js";
import { freezeClone, isPlainObject } from "./helpers.js";

function defaultFixtures(mode) {
  return freezeClone({
    tenantId: "tenant-1",
    competitionId: "comp-ref-1",
    venueId: "venue-1",
    clubId: "club-1",
    competitionMode: mode,
    matches: {
      "match-1": {
        matchId: "match-1",
        status: MATCH_STATUS.READY_TO_START,
        scheduledAt: "2026-07-24T13:00:00.000Z",
        courtId: "court-1",
        stage: "POOL",
        round: 1,
        parentMatchId: null,
        childMatchIds: [],
        sides: [
          {
            sideKey: "A",
            entryId: "entry-a",
            teamId: null,
            participantIds: ["p-a"],
          },
          {
            sideKey: "B",
            entryId: "entry-b",
            teamId: null,
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

/**
 * @param {{
 *   mode?: string,
 *   adapterId?: string,
 *   fixtures?: object,
 * }} [options]
 */
export function createReferenceRefereeAdapter(options = {}) {
  const competitionMode = normalizeRefereeAdapterMode(
    options.mode || COMPETITION_REFEREE_MODE.INTERNAL
  );
  const fixtures = isPlainObject(options.fixtures)
    ? freezeClone({ ...defaultFixtures(competitionMode), ...options.fixtures })
    : defaultFixtures(competitionMode);

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
        "Unknown competition for reference adapter",
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
    adapterId: String(options.adapterId || `reference-${competitionMode}`).trim(),
    competitionMode,
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
        competitionMode,
        venueId: fixtures.venueId,
        clubId: fixtures.clubId,
        competitionType: fixtures.competitionType || null,
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
        courtId: match.courtId || null,
        stage: match.stage || null,
        round: match.round ?? null,
        parentMatchId: match.parentMatchId || null,
        childMatchIds: match.childMatchIds || [],
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
        completionRequiresAcceptedResult: false,
        standingsRequireAcceptedResult: true,
      });
    },
    getCapabilities(request) {
      loadMatch(request);
      return freezeClone({
        scoring: true,
        suspend: true,
        resume: true,
        incidentReport: true,
        childOverrideAssignment: competitionMode === COMPETITION_REFEREE_MODE.TEAM,
        dreambreakerInheritsParent:
          competitionMode === COMPETITION_REFEREE_MODE.TEAM,
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
        },
      });
    },
  });
}
