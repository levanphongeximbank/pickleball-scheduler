/**
 * TeamTournamentRefereeAdapter — Competition Referee Adapter B translator.
 *
 * Translates existing Team Tournament referee / matchup state into End A.
 * Preserves locked semantics by projection only:
 * - parent matchup assignment SSOT
 * - child override where defined
 * - DreamBreaker inherits parent; no duplicate DreamBreaker assignment
 * - organizer can_manage OR assigned canonical uid (write policy description)
 * - automatic/idempotent V5 ensure (policy note — not executed here)
 *
 * DreamBreaker rotation authority remains in Team Tournament domain.
 */

import {
  canAssignedRefereeWriteMatchup,
  resolveEffectiveRefereeAssignment,
} from "../../../../team-tournament/engines/teamRefereeCanonicalLifecycle.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
} from "../constants.js";
import { failRefereeAdapter } from "../errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "../helpers.js";
import { mapModeStatusToCore15 } from "./shared/matchStatusMapper.js";
import {
  competitionTypeForMode,
  loadModeCompetitionState,
  resolveInjectedModeState,
  sidesFromTeamMatchup,
} from "./shared/modeContext.js";
import {
  buildAcceptedOnlyPropagation,
  buildStandardCapabilities,
  buildStandardLifecyclePolicy,
} from "./shared/policyBuilders.js";
import { mapModeScoringRulesToCore16 } from "./shared/scoringRulesMapper.js";

const MATCH_STATUS_FALLBACK = "READY_TO_START";

function assertTeamStateSafe(state) {
  if (!isPlainObject(state)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Team mode state must be a plain object",
      {}
    );
  }
  if (state.duplicateDreambreakerAssignmentRequired === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "DreamBreaker must inherit parent assignment; duplicate assignment is forbidden",
      {}
    );
  }
  if (state.moveDreambreakerAuthorityIntoAdapter === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      "DreamBreaker authority must remain in Team Tournament domain",
      {}
    );
  }
  if (state.directScoreMutationEnabled === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      "Adapter B must not mutate Team scores",
      {}
    );
  }
  if (state.acceptOfficialResult === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_RESULT_AUTHORITY_FORBIDDEN,
      "Adapter B must not accept official results",
      {}
    );
  }
}

/**
 * Resolve matchup + optional sub-match from request.matchId.
 * matchId may be subMatch id, or matchup id (parent).
 *
 * @param {object} state
 * @param {string|null} matchId
 */
function resolveTeamMatch(state, matchId) {
  if (!isNonEmptyString(matchId)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      "matchId is required",
      {}
    );
  }
  const id = String(matchId).trim();
  const matchups = isPlainObject(state.matchups) ? state.matchups : {};
  const matches = isPlainObject(state.matches) ? state.matches : {};

  // Direct match projection (already flattened)
  if (isPlainObject(matches[id])) {
    const row = matches[id];
    const matchupId = String(row.matchupId || row.parentMatchId || "").trim();
    const matchup = matchupId && isPlainObject(matchups[matchupId])
      ? matchups[matchupId]
      : null;
    return freezeClone({
      matchId: id,
      matchupId: matchupId || id,
      matchup: matchup || {
        matchupId: matchupId || id,
        teamAId: row.teamAId,
        teamBId: row.teamBId,
        sides: row.sides,
        lineupA: row.lineupA,
        lineupB: row.lineupB,
        lineupsLocked: row.lineupsLocked,
        dreambreaker: row.dreambreaker,
      },
      subMatch: row.isParent === true ? null : row,
      isParent: row.isParent === true || (!row.parentMatchId && !row.subMatchId),
      isDreambreaker:
        row.isDreambreaker === true ||
        String(row.discipline || "").toLowerCase() === "dreambreaker" ||
        String(id).startsWith("db-"),
    });
  }

  // Parent matchup id
  if (isPlainObject(matchups[id])) {
    const matchup = {
      ...matchups[id],
      matchupId: matchups[id].matchupId || id,
    };
    return freezeClone({
      matchId: id,
      matchupId: id,
      matchup,
      subMatch: null,
      isParent: true,
      isDreambreaker: false,
    });
  }

  // Search sub-matches
  for (const [matchupId, rawMatchup] of Object.entries(matchups)) {
    if (!isPlainObject(rawMatchup)) continue;
    const matchup = { ...rawMatchup, matchupId: rawMatchup.matchupId || matchupId };
    const subs = Array.isArray(matchup.subMatches) ? matchup.subMatches : [];
    const sub = subs.find((item) => String(item?.id || item?.subMatchId || "") === id);
    if (sub) {
      const isDreambreaker =
        sub.isDreambreaker === true ||
        String(sub.discipline || "").toLowerCase() === "dreambreaker" ||
        String(id).startsWith("db-");
      return freezeClone({
        matchId: id,
        matchupId,
        matchup,
        subMatch: sub,
        isParent: false,
        isDreambreaker,
      });
    }
  }

  failRefereeAdapter(
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
    `Unknown Team match/matchup: ${id}`,
    { matchId: id }
  );
}

function resolveTeamScoringRules(resolved, state) {
  const { subMatch, matchup, isDreambreaker } = resolved;
  const raw =
    subMatch?.scoringRules ||
    subMatch?.scoringFormat ||
    (isDreambreaker
      ? matchup?.dreambreaker?.scoringFormat ||
        matchup?.scheduleMeta?.dreambreakerScoringFormat ||
        state.dreambreakerScoringFormat ||
        null
      : null) ||
    matchup?.scoringRules ||
    matchup?.scoringFormat ||
    state.scoringRules ||
    state.scoringFormat ||
    null;

  if (raw == null && isDreambreaker) {
    // Documented Team DreamBreaker default projection (domain default), not Adapter authority
    return mapModeScoringRulesToCore16({
      scoringSystem: "RALLY",
      pointsToWin: 21,
      winBy: 2,
      bestOfGames: 1,
    });
  }
  return mapModeScoringRulesToCore16(raw);
}

/**
 * @param {{
 *   adapterId?: string,
 *   modeState?: object,
 *   getModeState?: (request: object) => object,
 * }} [options]
 */
export function createTeamTournamentRefereeAdapter(options = {}) {
  const competitionMode = COMPETITION_REFEREE_MODE.TEAM;

  function load(request, { requireMatch = true } = {}) {
    const state = resolveInjectedModeState(options, request);
    assertTeamStateSafe(state);
    const loaded = loadModeCompetitionState(state, request, competitionMode);
    if (!requireMatch) {
      return { ...loaded, resolved: null };
    }
    const resolved = resolveTeamMatch(loaded.state, loaded.req.matchId);
    return { ...loaded, resolved };
  }

  return Object.freeze({
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: String(options.adapterId || "team-tournament-referee-adapter-b").trim(),
    competitionMode,
    getCompetitionContext(request) {
      const { req, state, tenantId, competitionId } = load(request, {
        requireMatch: false,
      });
      return freezeClone({
        tenantId,
        competitionId,
        competitionMode,
        competitionType: competitionTypeForMode(competitionMode),
        venueId: state.venueId || req.venueId || null,
        clubId: state.clubId || req.clubId || null,
        parentMatchupAssignmentSsot: true,
        childOverrideAssignment: true,
        dreambreakerInheritsParent: true,
        noDuplicateDreambreakerAssignment: true,
        writePolicy: "organizer_can_manage_OR_assigned_canonical_uid",
        automaticIdempotentV5Ensure: true,
        dreambreakerAuthorityOwner: "team_tournament_domain",
      });
    },
    getMatchContext(request) {
      const { resolved, tenantId, competitionId, state } = load(request);
      const { matchup, subMatch, matchId, matchupId, isParent, isDreambreaker } =
        resolved;
      const childMatchIds = isParent
        ? (Array.isArray(matchup.subMatches)
            ? matchup.subMatches.map((s) => String(s.id || s.subMatchId))
            : Array.isArray(matchup.childMatchIds)
              ? matchup.childMatchIds.map(String)
              : [])
        : [];

      const assignments = Array.isArray(state.assignments) ? state.assignments : [];
      const effective = resolveEffectiveRefereeAssignment({
        assignments,
        matchupId,
        subMatchId: isParent ? null : matchId,
      });

      return freezeClone({
        matchId,
        competitionId,
        tenantId,
        status: mapModeStatusToCore15(
          subMatch?.status || matchup.status || MATCH_STATUS_FALLBACK
        ),
        scheduledAt: subMatch?.scheduledAt || matchup.scheduledAt || null,
        courtId: subMatch?.courtId || matchup.courtId || null,
        stage: matchup.stage || null,
        round: matchup.round ?? null,
        parentMatchId: isParent ? null : matchupId,
        childMatchIds,
        matchupId,
        isParentMatchup: isParent,
        isDreambreaker,
        // Projection only — Team domain remains assignment SSOT
        effectiveRefereeAssignment: effective
          ? {
              refereeUserId: effective.refereeUserId || null,
              scope: effective.scope || null,
              inherited: effective.inherited === true,
            }
          : null,
        dreambreakerProjection: isPlainObject(matchup.dreambreaker)
          ? {
              status: matchup.dreambreaker.status || null,
              required: matchup.dreambreaker.required === true,
              // Rotation state stays in Team domain; expose presence only
              rotationOwnedByTeamDomain: true,
            }
          : null,
      });
    },
    getParticipants(request) {
      const { resolved } = load(request);
      return freezeClone({
        sides: sidesFromTeamMatchup(resolved.matchup, resolved.subMatch),
        lineupsLocked:
          resolved.subMatch?.lineupsLocked === true ||
          resolved.matchup.lineupsLocked === true,
      });
    },
    getScoringRules(request) {
      const { resolved, state } = load(request);
      return resolveTeamScoringRules(resolved, state);
    },
    getLifecyclePolicy(request) {
      load(request);
      return buildStandardLifecyclePolicy({
        requiresLineups: true,
        mode: competitionMode,
        parentMatchupAssignmentSsot: true,
        dreambreakerInheritsParentAssignment: true,
        automaticIdempotentV5Ensure: true,
      });
    },
    getCapabilities(request) {
      load(request);
      return buildStandardCapabilities({
        childOverrideAssignment: true,
        dreambreakerInheritsParent: true,
        mode: competitionMode,
        // Write policy description for UI — Adapter B does not authorize
        writePolicyDescription:
          "organizer_can_manage_OR_assigned_canonical_uid",
        canEvaluateWritePolicyProjection: true,
      });
    },
    validatePreStart(request) {
      const { resolved, state } = load(request);
      const blockers = [];

      try {
        resolveTeamScoringRules(resolved, state);
      } catch (err) {
        blockers.push({
          code:
            err?.code || REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
          message: err instanceof Error ? err.message : "Missing scoring rules",
        });
      }

      try {
        sidesFromTeamMatchup(resolved.matchup, resolved.subMatch);
      } catch (err) {
        blockers.push({
          code: err?.code || REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: err instanceof Error ? err.message : "Invalid participants",
        });
      }

      // DreamBreaker: must NOT require a second assignment row
      if (resolved.isDreambreaker) {
        const assignments = Array.isArray(state.assignments)
          ? state.assignments
          : [];
        const effective = resolveEffectiveRefereeAssignment({
          assignments,
          matchupId: resolved.matchupId,
          subMatchId: resolved.matchId,
        });
        if (
          state.requireDreambreakerOwnAssignment === true &&
          effective?.inherited !== false
        ) {
          blockers.push({
            code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
            message:
              "Unsupported state: DreamBreaker must inherit parent assignment",
          });
        }
      }

      if (state.tournamentClosed === true || state.closedAt) {
        blockers.push({
          code: REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          message: "Team tournament is closed",
        });
      }

      return freezeClone({
        ok: blockers.length === 0,
        blockers,
      });
    },
    resolveResultPropagation(request) {
      const { resolved } = load(request);
      return buildAcceptedOnlyPropagation({
        targets: ["standings", "bracket", "qualification", "aggregate"],
        instructions: {
          mode: competitionMode,
          matchupId: resolved.matchupId,
          isDreambreaker: resolved.isDreambreaker,
          doNotAcceptResultInAdapter: true,
          writeGuardProjection:
            "organizer_can_manage_OR_assigned_canonical_uid",
        },
      });
    },
    /**
     * Read-only projection helper for tests/UI policy display.
     * Does NOT authorize writes.
     */
    projectWritePolicy(request, { refereeUserId, isOrganizer = false } = {}) {
      const { resolved, state } = load(request);
      const allowed = canAssignedRefereeWriteMatchup({
        assignments: Array.isArray(state.assignments) ? state.assignments : [],
        matchupId: resolved.matchupId,
        subMatchId: resolved.isParent ? null : resolved.matchId,
        refereeUserId,
        isOrganizer,
      });
      return freezeClone({
        allowed,
        authority: false,
        policy: "organizer_can_manage_OR_assigned_canonical_uid",
        projectionOnly: true,
      });
    },
  });
}

export const TeamTournamentRefereeAdapter = {
  create: createTeamTournamentRefereeAdapter,
  competitionMode: COMPETITION_REFEREE_MODE.TEAM,
};
