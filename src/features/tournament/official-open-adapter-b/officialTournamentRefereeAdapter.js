/**
 * Official/Open referee translator — Competition Referee Adapter Contract v1.
 *
 * Reuses Official/Open lifecycle match surfaces. Does not own scoring,
 * assignment persistence, or referee identity.
 */

import { createScoringFormat } from "../../competition-core/scoring/index.js";
import { MATCH_STATUS } from "../../competition-core/matches/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
} from "../../competition-engine/integration/referee/constants.js";
import {
  assertResultPropagationPayload,
  assertScoringRulesPayload,
  requireAdapterRequest,
} from "../../competition-engine/integration/referee/contract.js";
import { failRefereeAdapter } from "../../competition-engine/integration/referee/errors.js";
import { freezeClone } from "../../competition-engine/integration/referee/helpers.js";
import { getOfficialCompetitionSettings } from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  listMyOfficialRefereeAssignmentsCommand,
  officialRefereeGetMatchCommand,
} from "../official-lifecycle/officialOpenLifecycleCommands.js";

function trimId(value) {
  return value != null ? String(value).trim() : "";
}

function findMatch(tournament, matchId) {
  const wanted = String(matchId || "");
  const collections = [
    tournament?.matches,
    tournament?.groupMatches,
    tournament?.knockoutMatches,
    tournament?.schedule?.matches,
  ];
  for (const event of tournament?.events || []) {
    collections.push(event.matches, event.groupMatches, event.knockoutMatches);
  }
  for (const list of collections) {
    if (!Array.isArray(list)) continue;
    const found = list.find((item) => String(item?.id || item?.matchId) === wanted);
    if (found) return found;
  }
  return null;
}

function mapMatchStatus(match) {
  const raw = String(match?.status || match?.liveStatus || "").toLowerCase();
  if (raw === "completed" || raw === "final") return MATCH_STATUS.COMPLETED;
  if (raw === "live" || raw === "in_progress") return MATCH_STATUS.IN_PROGRESS;
  if (raw === "ready") return MATCH_STATUS.READY_TO_START;
  return MATCH_STATUS.SCHEDULED;
}

function sidesFromMatch(match) {
  const playerIdsA = match?.entryA?.playerIds || match?.sideAPlayerIds || [];
  const playerIdsB = match?.entryB?.playerIds || match?.sideBPlayerIds || [];
  return [
    {
      sideKey: "A",
      entryId: match?.entryAId || match?.entryA?.id || null,
      teamId: null,
      participantIds: (playerIdsA.length ? playerIdsA : [match?.playerAId].filter(Boolean)).map(String),
    },
    {
      sideKey: "B",
      entryId: match?.entryBId || match?.entryB?.id || null,
      teamId: null,
      participantIds: (playerIdsB.length ? playerIdsB : [match?.playerBId].filter(Boolean)).map(String),
    },
  ];
}

function scoringRulesFromTournament(tournament) {
  const competition = getOfficialCompetitionSettings(tournament);
  const method = String(competition.scoringMethodOperational || competition.scoringMethod || "rally");
  return createScoringFormat({
    scoringSystem: method === "side_out" ? "SIDE_OUT" : "RALLY",
    pointsToWin: Number(competition.pointsToWin) || 11,
    winBy: 2,
    bestOfGames: Number(competition.bestOf) || 1,
  });
}

/**
 * @param {{
 *   tournament?: object|null,
 *   tenantId?: string|null,
 *   getTournament?: (competitionId: string) => object|null,
 * }} [options]
 */
export function createOfficialTournamentRefereeAdapter(options = {}) {
  const boundTenantId = trimId(options.tenantId) || null;

  function resolveTournament(request) {
    if (typeof options.getTournament === "function") {
      return options.getTournament(request.competitionId) || null;
    }
    const tournament = options.tournament || null;
    if (!tournament) return null;
    const id = trimId(tournament.id || tournament.tournamentId);
    if (id && id !== request.competitionId) return null;
    return tournament;
  }

  function loadMatch(request) {
    const req = requireAdapterRequest(request);
    if (boundTenantId && req.tenantId !== boundTenantId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
        "Official/Open referee request tenant does not match bound tenant",
        { tenantId: req.tenantId, expectedTenantId: boundTenantId }
      );
    }
    const tournament = resolveTournament(req);
    if (!tournament) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "Official/Open tournament context is unavailable",
        { competitionId: req.competitionId }
      );
    }
    const tournamentTenant = trimId(tournament.tenantId);
    if (tournamentTenant && tournamentTenant !== req.tenantId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
        "Official/Open tournament tenant does not match request tenant",
        { tenantId: req.tenantId, tournamentTenantId: tournamentTenant }
      );
    }
    if (!req.matchId) {
      failRefereeAdapter(REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH, "matchId is required", {});
    }
    const match = findMatch(tournament, req.matchId);
    if (!match) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
        `Unknown Official/Open match: ${req.matchId}`,
        { matchId: req.matchId }
      );
    }
    return { req, tournament, match };
  }

  return Object.freeze({
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: "official-open-tournament-referee-adapter",
    competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
    existingLifecycle: Object.freeze({
      listMyRefereeAssignments: listMyOfficialRefereeAssignmentsCommand,
      refereeGetMatch: officialRefereeGetMatchCommand,
    }),
    getCompetitionContext(request) {
      const req = requireAdapterRequest(request);
      const tournament = resolveTournament(req);
      if (!tournament) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          "Official/Open tournament context is unavailable",
          { competitionId: req.competitionId }
        );
      }
      return freezeClone({
        tenantId: req.tenantId,
        competitionId: req.competitionId,
        competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
        venueId: req.venueId,
        clubId: req.clubId || trimId(tournament.clubId) || null,
        competitionType: "official_tournament",
      });
    },
    getMatchContext(request) {
      const { req, match } = loadMatch(request);
      return freezeClone({
        matchId: trimId(match.id || match.matchId),
        competitionId: req.competitionId,
        tenantId: req.tenantId,
        status: mapMatchStatus(match),
        scheduledAt: match.scheduledStart || match.scheduledAt || null,
        courtId: match.courtId || null,
        stage: match.stage || match.roundType || null,
        round: match.round ?? null,
        parentMatchId: match.parentMatchId || null,
        childMatchIds: Array.isArray(match.childMatchIds) ? match.childMatchIds : [],
      });
    },
    getParticipants(request) {
      const { match } = loadMatch(request);
      return freezeClone({
        sides: sidesFromMatch(match),
        lineupsLocked: match.lineupsLocked === true || Boolean(match.courtId),
      });
    },
    getScoringRules(request) {
      const { tournament, match } = loadMatch(request);
      const rules = match.scoringRules || scoringRulesFromTournament(tournament);
      if (!rules) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          "Official/Open match has no scoring rules",
          { matchId: trimId(match.id || match.matchId) }
        );
      }
      return assertScoringRulesPayload(rules);
    },
    getLifecyclePolicy(request) {
      loadMatch(request);
      return freezeClone({
        policyId: "official-open.referee.lifecycle.v1",
        requiresAssignment: true,
        requiresLineups: false,
        canStartFrom: [MATCH_STATUS.READY_TO_START, MATCH_STATUS.SCHEDULED].filter(Boolean),
        completionRequiresAcceptedResult: true,
        standingsRequireAcceptedResult: true,
      });
    },
    getCapabilities(request) {
      loadMatch(request);
      return freezeClone({
        scoring: true,
        suspend: true,
        resume: true,
        incidentReport: false,
        childOverrideAssignment: false,
        dreambreakerInheritsParent: false,
        ownsScoringAuthority: false,
        ownsResultAuthority: false,
        ownsRefereeIdentity: false,
      });
    },
    validatePreStart(request) {
      const { match } = loadMatch(request);
      const blockers = [];
      const sides = sidesFromMatch(match);
      if (sides.length !== 2) {
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
