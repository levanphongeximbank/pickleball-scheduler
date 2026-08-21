/**
 * Official/Open referee translator — Competition Referee Adapter Contract v1.
 *
 * Reuses Official/Open lifecycle match surfaces. Does not own scoring,
 * assignment persistence, or referee identity.
 */

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
import { resolveOfficialMatchScoringRules } from "../../individual-tournament/engines/officialScoringRulesResolver.js";
import { resolveOfficialCore16ScoringFormat } from "./officialOpenCore16LiveScoringBinding.js";
import {
  listMyOfficialRefereeAssignmentsCommand,
  officialRefereeGetMatchCommand,
} from "../official-lifecycle/officialOpenLifecycleCommands.js";
import { SHARED_REFEREE_CONTRACT_CAPABILITY_GAP } from "./constants.js";
import {
  ASSIGNMENT_COMPETITION_MODE,
  createCompetitionRefereeAssignmentTrustedClient,
  resolveCompetitionAssignmentEdgeBaseUrl,
} from "../../competition-engine/operations/referee/assignment/index.js";
import { resolveCanonicalRefereeIdFromRoster } from "../../individual-tournament/engines/core13AssignmentProjection.js";
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { mapModeScoringRulesToCore16 } from "../../competition-engine/integration/referee/adapters/shared/scoringRulesMapper.js";

function createOfficialCore13AssignmentClient() {
  return createCompetitionRefereeAssignmentTrustedClient({
    edgeBaseUrl: resolveCompetitionAssignmentEdgeBaseUrl(),
    getAccessToken: async () => {
      const client = getSupabaseAuthClient();
      const { data } = (await client?.auth.getSession()) || {};
      return data?.session?.access_token || null;
    },
  });
}

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

function isCore16ScoringRules(rules) {
  if (!rules || typeof rules !== "object") return false;
  const winBy = Number(rules.winBy);
  return (
    (Boolean(rules.formatId) || Boolean(rules.schemaVersion) || Boolean(rules.scoringSystem)) &&
    Number.isInteger(winBy) &&
    winBy >= 1
  );
}

function officialScoringRulesOrGap(tournament, match) {
  const formatRes = resolveOfficialCore16ScoringFormat({
    tournament,
    match,
    tenantId: tournament?.tenantId,
    eventId: match?.eventId,
  });
  if (formatRes.ok) {
    return assertScoringRulesPayload(formatRes.format);
  }
  const official = resolveOfficialMatchScoringRules(tournament, match);
  if (official.winBy == null && official.winByPolicyDeferred === true) {
    failRefereeAdapter(
      SHARED_REFEREE_CONTRACT_CAPABILITY_GAP,
      "Official CORE-16 format unresolved and win-by still deferred.",
      {
        winBy: official.winBy,
        winByPolicyDeferred: official.winByPolicyDeferred,
        scoringMethod: official.scoringMethod,
        targetPoints: official.targetPoints,
        formatError: formatRes.error || formatRes.code,
        contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
      }
    );
  }
  return mapModeScoringRulesToCore16({
    scoringSystem:
      String(official.scoringMethod || "").toLowerCase() === "side_out"
        ? "SIDE_OUT"
        : "RALLY",
    pointsToWin: official.targetPoints,
    winBy: official.winBy ?? 2,
    bestOfGames: official.bestOf || 1,
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
      /**
       * CORE-13 assignment surface — translator only.
       * Does NOT add forbidden assignReferee/persistAssignment adapter methods.
       */
      core13Assignment: Object.freeze({
        competitionMode: ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN,
        createTrustedClient: createOfficialCore13AssignmentClient,
        resolveCanonicalRefereeIdFromRoster,
        commands: Object.freeze([
          "assignReferee",
          "replaceReferee",
          "unassignReferee",
          "getActiveAssignment",
          "getMatchAssignmentVersion",
          "listActiveAssignments",
        ]),
      }),
    }),
    sharedContractCapabilityGaps: Object.freeze([
      {
        code: SHARED_REFEREE_CONTRACT_CAPABILITY_GAP,
        reason:
          "Change-end execution remains PARTIAL (CORE-16 hint + session ACK). Durable match_live_states scoring writes require Edge/service_role.",
        officialPolicy: Object.freeze({
          scoringBoundToCore16: true,
          changeEndPartial: true,
          bestOf3Unbound: true,
        }),
      },
    ]),
    getCompetitionContext(request) {
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
      return freezeClone({
        tenantId: req.tenantId,
        competitionId: req.competitionId,
        competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
        venueId: req.venueId,
        clubId: req.clubId || trimId(tournament.clubId) || null,
        competitionType: "official_tournament",
        tournamentName: tournament.name || null,
        matchRulesSummary: resolveOfficialMatchScoringRules(tournament, {}).summaryLabel,
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
      if (isCore16ScoringRules(match.scoringRules)) {
        return assertScoringRulesPayload(match.scoringRules);
      }
      return officialScoringRulesOrGap(tournament, match);
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
