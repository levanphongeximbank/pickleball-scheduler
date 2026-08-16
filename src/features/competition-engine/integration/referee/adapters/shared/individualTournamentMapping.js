/**
 * Shared Internal/Official individual-tournament match mapping helpers.
 * Keep adapters separate; share only semantically identical translation.
 */

import { REFEREE_ADAPTER_ERROR_CODE } from "../../constants.js";
import { failRefereeAdapter } from "../../errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "../../helpers.js";
import { mapModeStatusToCore15 } from "./matchStatusMapper.js";
import {
  competitionTypeForMode,
  loadModeCompetitionState,
  requireModeMatch,
  resolveInjectedModeState,
  sidesFromIndividualMatch,
} from "./modeContext.js";
import {
  buildAcceptedOnlyPropagation,
  buildStandardCapabilities,
  buildStandardLifecyclePolicy,
} from "./policyBuilders.js";
import { mapModeScoringRulesToCore16 } from "./scoringRulesMapper.js";

/**
 * @param {object} options
 * @param {string} competitionMode
 * @param {string} adapterId
 * @param {string} contractId
 * @param {string} contractVersion
 */
export function createIndividualTournamentRefereeAdapterSurface({
  options,
  competitionMode,
  adapterId,
  contractId,
  contractVersion,
}) {
  function load(request, { requireMatch = true } = {}) {
    const state = resolveInjectedModeState(options, request);
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
    return mapModeScoringRulesToCore16(raw);
  }

  return Object.freeze({
    contractId,
    contractVersion,
    adapterId,
    competitionMode,
    getCompetitionContext(request) {
      const { req, state, tenantId, competitionId } = load(request, {
        requireMatch: false,
      });
      return freezeClone({
        tenantId,
        competitionId,
        competitionMode,
        competitionType:
          state.competitionType || competitionTypeForMode(competitionMode),
        venueId: state.venueId || req.venueId || null,
        clubId: state.clubId || req.clubId || null,
        stageModel: state.stageModel || "individual_tournament",
        registrationContext:
          competitionMode === "OFFICIAL"
            ? state.registrationContext || null
            : undefined,
        eligibilityContext:
          competitionMode === "OFFICIAL"
            ? state.eligibilityContext || null
            : undefined,
        legacyTokenEvidencePresent: state.legacyTokenEvidencePresent === true,
        // Token route is never Adapter B / CORE-13 authority
        tokenRouteIsCanonicalAuthority: false,
      });
    },
    getMatchContext(request) {
      const { match, tenantId, competitionId } = load(request);
      return freezeClone({
        matchId: match.matchId,
        competitionId,
        tenantId,
        status: mapModeStatusToCore15(match.status),
        scheduledAt: match.scheduledAt || null,
        courtId: match.courtId || null,
        stage: match.stage || null,
        round: match.round ?? null,
        eventId: match.eventId || null,
        groupId: match.groupId || null,
        parentMatchId: match.parentMatchId || null,
        childMatchIds: Array.isArray(match.childMatchIds)
          ? match.childMatchIds.map(String)
          : [],
        bracketMatchId: match.bracketMatchId || null,
      });
    },
    getParticipants(request) {
      const { match } = load(request);
      return freezeClone({
        sides: sidesFromIndividualMatch(match),
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
      });
    },
    getCapabilities(request) {
      load(request);
      return buildStandardCapabilities({
        childOverrideAssignment: false,
        dreambreakerInheritsParent: false,
        mode: competitionMode,
      });
    },
    validatePreStart(request) {
      const { match, state } = load(request);
      const blockers = [];

      // Legacy token alone is never sufficient / never authority
      if (
        state.legacyTokenEvidencePresent === true &&
        state.canonicalAssignmentAuthorityAvailable !== true &&
        state.requireCanonicalAssignmentForPreStart === true
      ) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
          message:
            "Legacy /referee/:token evidence is not CORE-13 assignment authority",
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
        const sides = sidesFromIndividualMatch(match);
        if (!sides[0]?.entryId || !sides[1]?.entryId) {
          blockers.push({
            code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
            message: "Both entries are required before start",
          });
        }
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: err instanceof Error ? err.message : "Invalid participants",
        });
      }

      if (state.closedAt || state.tournamentClosed === true) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Competition is closed",
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
        targets: ["standings", "bracket", "qualification", "aggregate"],
        instructions: {
          mode: competitionMode,
          doNotUseTournamentMatchLiveAsAuthority: true,
          doNotUseTokenFinalizeAsAuthority: true,
        },
      });
    },
  });
}

/**
 * Detect unsafe / unsupported individual tournament state.
 * @param {unknown} state
 */
export function assertIndividualModeStateSafe(state) {
  if (!isPlainObject(state)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Individual mode state must be a plain object",
      {}
    );
  }
  if (state.usesTokenAsCanonicalAuthority === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "Adapter B must not treat /referee/:token as canonical authority",
      {}
    );
  }
  if (state.directScoreMutationEnabled === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Adapter B must not enable direct score mutation",
      {}
    );
  }
  if (
    isNonEmptyString(state.browserExposedPrivilegedRpc) ||
    state.callBrowserExposedPrivilegedRpc === true
  ) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "Adapter B must not call browser-exposed privileged RPC",
      {}
    );
  }
}
