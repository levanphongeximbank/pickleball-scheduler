/**
 * Internal Tournament Referee Adapter (ĐẦU B).
 * Translates Internal match context into competition.referee.adapter.v1.
 * Does not own referee identity, assignment, scoring, or official result.
 */
import { MATCH_STATUS as CORE_MATCH_STATUS } from "../../competition-core/matches/index.js";
import { createScoringFormat } from "../../competition-core/scoring/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
  assertResultPropagationPayload,
  assertScoringRulesPayload,
  failRefereeAdapter,
  requireAdapterRequest,
} from "../../competition-engine/integration/referee/index.js";
import { freezeClone } from "../../competition-engine/integration/referee/helpers.js";
import { MATCH_STATUS as INTERNAL_MATCH_STATUS } from "../../../models/tournament/constants.js";

const INTERNAL_TO_CORE_STATUS = Object.freeze({
  [INTERNAL_MATCH_STATUS.WAITING]: CORE_MATCH_STATUS.SCHEDULED,
  [INTERNAL_MATCH_STATUS.ASSIGNED]: CORE_MATCH_STATUS.READY_TO_START,
  [INTERNAL_MATCH_STATUS.PLAYING]: CORE_MATCH_STATUS.IN_PROGRESS,
  [INTERNAL_MATCH_STATUS.COMPLETED]: CORE_MATCH_STATUS.COMPLETED,
  [INTERNAL_MATCH_STATUS.POSTPONED]: CORE_MATCH_STATUS.POSTPONED,
  [INTERNAL_MATCH_STATUS.FORFEIT]: CORE_MATCH_STATUS.COMPLETED,
  [CORE_MATCH_STATUS.READY_TO_START]: CORE_MATCH_STATUS.READY_TO_START,
  [CORE_MATCH_STATUS.SCHEDULED]: CORE_MATCH_STATUS.SCHEDULED,
  [CORE_MATCH_STATUS.IN_PROGRESS]: CORE_MATCH_STATUS.IN_PROGRESS,
  [CORE_MATCH_STATUS.COMPLETED]: CORE_MATCH_STATUS.COMPLETED,
});

function mapMatchStatus(status) {
  const raw = String(status || "").trim();
  return INTERNAL_TO_CORE_STATUS[raw] || CORE_MATCH_STATUS.READY_TO_START;
}

function entryById(event, entryId) {
  const id = String(entryId || "").trim();
  if (!id) return null;
  return (event?.entries || []).find((entry) => String(entry.id) === id) || null;
}

function participantIdsOf(entry, fallbackId) {
  if (Array.isArray(entry?.playerIds) && entry.playerIds.length) {
    return entry.playerIds.map((id) => String(id));
  }
  if (entry?.id) return [String(entry.id)];
  return fallbackId ? [String(fallbackId)] : [];
}

function sideFrom(event, match, key, entryId) {
  const entry = entryById(event, entryId);
  return {
    sideKey: key,
    entryId: String(entryId || "").trim() || null,
    teamId: entry?.playerIds?.length > 1 ? String(entry.id) : null,
    participantIds: participantIdsOf(entry, entryId),
  };
}

function defaultInternalScoringRules(tournament) {
  const scoring = tournament?.settings?.scoring || tournament?.events?.[0]?.scoring || {};
  return createScoringFormat({
    formatId: scoring.formatId || "internal-default",
    scoringSystem: scoring.scoringSystem || "RALLY",
    pointsToWin: scoring.pointsToWin || 11,
    winBy: scoring.winBy || 2,
    bestOfGames: scoring.bestOfGames || 1,
  });
}

function findMatch(tournament, matchId) {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  for (const event of events) {
    const match = (event?.matches || []).find(
      (item) => String(item.id) === String(matchId)
    );
    if (match) return { event, match };
  }
  return null;
}

export function createInternalTournamentRefereeAdapter(options = {}) {
  const tournament = options.tournament || null;
  const competitionMode = COMPETITION_REFEREE_MODE.INTERNAL;
  const expectedTenantId = String(tournament?.tenantId || options.tenantId || "").trim();
  const expectedCompetitionId = String(
    tournament?.id || options.competitionId || ""
  ).trim();

  function assertScope(request) {
    const req = requireAdapterRequest(request);
    if (expectedTenantId && req.tenantId !== expectedTenantId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
        "Adapter request tenant does not match Internal tournament tenant",
        { tenantId: req.tenantId, expectedTenantId }
      );
    }
    if (expectedCompetitionId && req.competitionId !== expectedCompetitionId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "Unknown Internal competition",
        { competitionId: req.competitionId }
      );
    }
    return req;
  }

  function loadMatch(request) {
    const req = assertScope(request);
    if (!req.matchId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
        "matchId is required",
        {}
      );
    }
    const found = findMatch(tournament, req.matchId);
    if (!found) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
        `Unknown Internal match: ${req.matchId}`,
        { matchId: req.matchId }
      );
    }
    return { req, ...found };
  }

  return Object.freeze({
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: String(options.adapterId || "internal-tournament-referee-adapter").trim(),
    competitionMode,
    actorIdentityAuthority: "auth.uid",
    ownsScoringAuthority: false,
    ownsResultAuthority: false,
    ownsRefereeIdentity: false,
    ownsAssignmentAuthority: false,
    wiredToProductionRuntime: false,
    runtimeDependency: "createCanonicalRefereePersistenceRuntime (durable V5 repository not injected)",
    getCompetitionContext(request) {
      const req = assertScope(request);
      return freezeClone({
        tenantId: req.tenantId,
        competitionId: req.competitionId,
        competitionMode,
        venueId: req.venueId || tournament?.tenantId || null,
        clubId: req.clubId || tournament?.clubId || null,
        competitionType: "internal_tournament",
      });
    },
    getMatchContext(request) {
      const { req, match } = loadMatch(request);
      return freezeClone({
        matchId: String(match.id),
        competitionId: req.competitionId,
        tenantId: req.tenantId,
        status: mapMatchStatus(match.status),
        scheduledAt: match.scheduledStart || match.scheduledAt || null,
        courtId: match.physicalCourtId || match.courtId || null,
        stage: match.stage || match.bracketMatchId || null,
        round: match.round ?? null,
        parentMatchId: match.parentMatchId || null,
        childMatchIds: match.childMatchIds || [],
      });
    },
    getParticipants(request) {
      const { event, match } = loadMatch(request);
      return freezeClone({
        sides: [
          sideFrom(event, match, "A", match.entryAId),
          sideFrom(event, match, "B", match.entryBId),
        ],
        lineupsLocked: true,
      });
    },
    getScoringRules(request) {
      const { match } = loadMatch(request);
      if (match.scoringRules === null) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          "Match has no scoring rules",
          { matchId: match.id }
        );
      }
      const rules = match.scoringRules || defaultInternalScoringRules(tournament);
      return assertScoringRulesPayload(rules);
    },
    getLifecyclePolicy(request) {
      loadMatch(request);
      return freezeClone({
        policyId: "competition.referee.lifecycle.v1",
        requiresAssignment: true,
        requiresLineups: true,
        canStartFrom: [CORE_MATCH_STATUS.READY_TO_START, CORE_MATCH_STATUS.SCHEDULED],
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
        childOverrideAssignment: false,
        dreambreakerInheritsParent: false,
        ownsScoringAuthority: false,
        ownsResultAuthority: false,
        ownsRefereeIdentity: false,
      });
    },
    validatePreStart(request) {
      const { event, match } = loadMatch(request);
      const blockers = [];
      const sides = [
        sideFrom(event, match, "A", match.entryAId),
        sideFrom(event, match, "B", match.entryBId),
      ];
      if (sides.some((side) => !side.entryId)) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Two sides are required",
        });
      }
      if (match.scoringRules === null) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          message: "Scoring rules missing",
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
