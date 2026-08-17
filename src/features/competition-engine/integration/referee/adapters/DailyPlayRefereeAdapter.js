/**
 * DailyPlayRefereeAdapter — Competition Referee Adapter B translator.
 *
 * Translates Daily Play session/match state into competition.referee.adapter.v1.
 * Does NOT own scoring, assignment, lifecycle, or result acceptance.
 * Does NOT legitimize legacy Daily Play roster / score RPCs as CORE-13/16/17.
 */

import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
} from "../constants.js";
import { failRefereeAdapter } from "../errors.js";
import { freezeClone, isPlainObject } from "../helpers.js";
import { mapModeStatusToCore15 } from "./shared/matchStatusMapper.js";
import {
  competitionTypeForMode,
  loadModeCompetitionState,
  requireModeMatch,
  resolveInjectedModeState,
  sidesFromDailyPlayMatch,
} from "./shared/modeContext.js";
import {
  buildAcceptedOnlyPropagation,
  buildStandardCapabilities,
  buildStandardLifecyclePolicy,
} from "./shared/policyBuilders.js";
import { mapModeScoringRulesToCore16 } from "./shared/scoringRulesMapper.js";

function assertDailyPlayStateSafe(state) {
  if (!isPlainObject(state)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Daily Play mode state must be a plain object",
      {}
    );
  }
  if (state.treatRosterAsCore13Assignment === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "Daily Play roster must not be treated as CORE-13 assignment authority",
      {}
    );
  }
  if (state.adoptDailyPlayScoreRpcAsCanonical === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Daily Play score RPCs must not be adopted as CORE-16 authority",
      {}
    );
  }
  if (state.directScoreMutationEnabled === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Adapter B must not mutate Daily Play scores",
      {}
    );
  }
  if (state.browserStorageProductionFallback === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN,
      "Adapter B must not create browser-storage or in-memory production fallback",
      {}
    );
  }
}

/**
 * @param {{
 *   adapterId?: string,
 *   modeState?: object,
 *   getModeState?: (request: object) => object,
 * }} [options]
 */
export function createDailyPlayRefereeAdapter(options = {}) {
  const competitionMode = COMPETITION_REFEREE_MODE.DAILY_PLAY;

  function load(request, { requireMatch = true } = {}) {
    const state = resolveInjectedModeState(options, request);
    assertDailyPlayStateSafe(state);
    const loaded = loadModeCompetitionState(state, request, competitionMode);
    if (!requireMatch) {
      return { ...loaded, match: null };
    }
    const match = requireModeMatch(loaded.state, loaded.req.matchId);
    return { ...loaded, match };
  }

  function resolveScoringRules(match, state) {
    const raw =
      match.scoringRules ||
      match.scoringFormat ||
      state.scoringRules ||
      state.scoringFormat ||
      null;
    // Product default only when rules are absent but scoring is in scope.
    // Never invent rules when explicitly marked unavailable.
    if (raw == null && state.scoringRulesUnavailable === true) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
        "Daily Play scoring rules unavailable",
        { matchId: match.matchId }
      );
    }
    return mapModeScoringRulesToCore16(raw, {
      allowDailyPlayDefault: raw == null,
    });
  }

  return Object.freeze({
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: String(options.adapterId || "daily-play-referee-adapter-b").trim(),
    competitionMode,
    getCompetitionContext(request) {
      const { req, state, tenantId, competitionId } = load(request, {
        requireMatch: false,
      });
      const session = isPlainObject(state.session) ? state.session : {};
      return freezeClone({
        tenantId,
        competitionId,
        competitionMode,
        competitionType: competitionTypeForMode(competitionMode),
        venueId: state.venueId || req.venueId || null,
        clubId: state.clubId || req.clubId || null,
        sessionId: session.sessionId || competitionId,
        matchType: session.matchType || state.matchType || null,
        skipScore: session.skipScore === true || state.skipScore === true,
        enabledCourtIds: Array.isArray(session.enabledCourtIds)
          ? session.enabledCourtIds.map(String)
          : Array.isArray(state.enabledCourtIds)
            ? state.enabledCourtIds.map(String)
            : [],
        checkedInCount: Array.isArray(session.checkedInPlayerIds)
          ? session.checkedInPlayerIds.length
          : Array.isArray(state.checkedInPlayerIds)
            ? state.checkedInPlayerIds.length
            : 0,
        // Honest: roster is not CORE-13
        rosterIsCore13AssignmentAuthority: false,
        canonicalAssignmentAuthorityAvailable:
          state.canonicalAssignmentAuthorityAvailable === true,
      });
    },
    getMatchContext(request) {
      const { match, tenantId, competitionId, state } = load(request);
      return freezeClone({
        matchId: match.matchId,
        competitionId,
        tenantId,
        status: mapModeStatusToCore15(match.status),
        scheduledAt: match.scheduledAt || null,
        courtId: match.courtId || null,
        stage: match.stage || "DAILY_PLAY",
        round: match.round ?? null,
        parentMatchId: null,
        childMatchIds: [],
        sessionId:
          (isPlainObject(state.session) && state.session.sessionId) ||
          competitionId,
        matchType: match.matchType || state.matchType || null,
      });
    },
    getParticipants(request) {
      const { match } = load(request);
      return freezeClone({
        sides: sidesFromDailyPlayMatch(match),
        lineupsLocked: match.lineupsLocked === true,
      });
    },
    getScoringRules(request) {
      const { match, state } = load(request);
      return resolveScoringRules(match, state);
    },
    getLifecyclePolicy(request) {
      load(request);
      return buildStandardLifecyclePolicy({
        requiresLineups: true,
        mode: competitionMode,
        // Policy: CORE-13 assignment is required; Adapter B does not supply it
        assignmentAuthority: "CORE-13",
        dailyPlayRosterNotAssignmentAuthority: true,
      });
    },
    getCapabilities(request) {
      const { state } = load(request);
      const skipScore =
        state.skipScore === true ||
        (isPlainObject(state.session) && state.session.skipScore === true);
      return buildStandardCapabilities({
        scoring: !skipScore,
        childOverrideAssignment: false,
        dreambreakerInheritsParent: false,
        mode: competitionMode,
      });
    },
    validatePreStart(request) {
      const { match, state } = load(request);
      const blockers = [];

      // Honest fail-closed: legacy roster ≠ CORE-13
      if (state.canonicalAssignmentAuthorityAvailable !== true) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
          message:
            "Canonical CORE-13 assignment authority is unavailable at Adapter B boundary; Daily Play roster is not assignment authority",
        });
      }

      try {
        resolveScoringRules(match, state);
      } catch (err) {
        blockers.push({
          code:
            err?.code || REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          message: err instanceof Error ? err.message : "Missing scoring rules",
        });
      }

      try {
        const sides = sidesFromDailyPlayMatch(match);
        const a = sides[0]?.participantIds || [];
        const b = sides[1]?.participantIds || [];
        if (a.length === 0 || b.length === 0) {
          blockers.push({
            code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
            message: "Both Daily Play sides require participants",
          });
        }
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: err instanceof Error ? err.message : "Invalid participants",
        });
      }

      if (state.closedAt || state.sessionClosed === true) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Daily Play session is closed",
        });
      }

      return freezeClone({
        ok: blockers.length === 0,
        blockers,
      });
    },
    resolveResultPropagation(request) {
      load(request);
      return buildAcceptedOnlyPropagation({
        targets: ["standings", "aggregate"],
        instructions: {
          mode: competitionMode,
          doNotAdoptDailyPlayScoreRpc: true,
          doNotMutateDailyPlayScoreFromAdapter: true,
        },
      });
    },
  });
}

export const DailyPlayRefereeAdapter = {
  create: createDailyPlayRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
};
