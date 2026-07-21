/**
 * CORE-06 Phase 1F — fixture LineupFormatAdapter (test double).
 * Deterministic. Pure mapping. No clock. No random. No TT imports.
 */

import {
  LINEUP_FORMAT_ADAPTER_KIND,
  isLineupFormatAdapter,
} from "../contracts/lineupFormatAdapter.js";
import { mapTeamTournamentLineupInputToCanonical } from "./mapTeamTournamentInput.js";
import { mapCanonicalLineupResultToTeamTournament } from "./mapCanonicalToTeamTournament.js";
import { createDefaultLineupHardeningPolicy } from "../contracts/lineupHardeningPolicy.js";
import { createLineupDeadlineTimestamps } from "../contracts/lineupDeadlinePhase.js";
import { lineupMappingFail, lineupMappingOk } from "../contracts/mappingResult.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @param {object} mapped — successful canonical mapping value
 * @param {string} commandType
 */
function commandFromMapped(mapped, commandType) {
  return Object.freeze({
    commandType,
    lineupInput: Object.freeze({
      tenantId: mapped.tenantId,
      competitionId: mapped.competitionId,
      teamId: mapped.teamId,
      contextId: mapped.contextId,
      identityKey: mapped.identityKey,
      rosterId: mapped.rosterId,
      rosterVersion: mapped.rosterVersion,
      slots: mapped.slots,
      visibilityState: mapped.visibilityState,
      status: mapped.status,
    }),
    command: mapped.command,
    deadlineTimestamps: mapped.deadlineTimestamps,
    seed: mapped.seed,
  });
}

/**
 * @param {object} [options]
 * @returns {import('../contracts/lineupFormatAdapter.js').LineupFormatAdapter}
 */
export function createFixtureLineupFormatAdapter(options = {}) {
  const id =
    typeof options.id === "string" && options.id.trim() !== ""
      ? options.id.trim()
      : "FIXTURE_TT_COMPAT_ADAPTER";

  function requireMapped(input) {
    const mapped = mapTeamTournamentLineupInputToCanonical(input);
    if (!mapped.ok) return mapped;
    return lineupMappingOk(mapped.value);
  }

  const adapter = {
    id,
    kind: LINEUP_FORMAT_ADAPTER_KIND,

    resolveAggregateIdentity(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(
        Object.freeze({
          tenantId: mapped.value.tenantId,
          competitionId: mapped.value.competitionId,
          teamId: mapped.value.teamId,
          contextId: mapped.value.contextId,
          identityKey: mapped.value.identityKey,
        })
      );
    },

    mapCreateCommand(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(commandFromMapped(mapped.value, "createLineup"));
    },

    mapSubmitCommand(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(commandFromMapped(mapped.value, "submit"));
    },

    mapLockCommand(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(commandFromMapped(mapped.value, "lock"));
    },

    mapPublishCommand(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(commandFromMapped(mapped.value, "publish"));
    },

    mapCorrectionCommand(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      if (!mapped.value.command.reason) {
        return lineupMappingFail(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_OVERRIDE_REASON_REQUIRED,
          "Correction requires an explicit reason"
        );
      }
      // Do not infer correction authorization.
      return lineupMappingOk(
        Object.freeze({
          ...commandFromMapped(mapped.value, "correctLockedLineup"),
          correctionAuthorized: mapped.value.command.correctionAuthorized === true,
        })
      );
    },

    mapRandomFallbackCommand(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      if (!mapped.value.seed) {
        return lineupMappingFail(
          LINEUP_RUNTIME_ERROR_CODE.MISSING_SEED,
          "Random fallback requires an explicit seed"
        );
      }
      return lineupMappingOk(
        Object.freeze({
          ...commandFromMapped(mapped.value, "random_fallback"),
          seed: mapped.value.seed,
        })
      );
    },

    mapVisibilityContext(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(
        Object.freeze({
          visibilityState: mapped.value.visibilityState,
          revealEligible: mapped.value.revealEligible === true,
          relationship: input.relationship ?? null,
          viewerScope: input.viewerScope ?? null,
          evaluatedAt: mapped.value.command.evaluatedAt,
        })
      );
    },

    mapDeadlinePolicy(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(
        createLineupDeadlineTimestamps(mapped.value.deadlineTimestamps || {})
      );
    },

    mapHardeningPolicy(input) {
      // Adapter returns policy config flags only — never invents authorization.
      const base = createDefaultLineupHardeningPolicy();
      const allowsCorrection = input?.allowsLockedCorrection === true;
      return lineupMappingOk(
        Object.freeze({
          id: `${base.id}::FIXTURE`,
          allowsLockedCorrection: allowsCorrection,
          requiresExpectedVersion: input?.requiresExpectedVersion === true,
          allowsLateMutation: input?.allowsLateMutation === true,
          allowsReveal: input?.allowsReveal === true,
          allowsVisibilityStageSkip: input?.allowsVisibilityStageSkip === true,
        })
      );
    },

    mapActorContext(input) {
      return lineupMappingOk(
        Object.freeze({
          actorId: input?.actorId != null ? String(input.actorId).trim() : null,
          actorRole:
            input?.actorRole != null ? String(input.actorRole).trim() : null,
          source:
            input?.source != null
              ? String(input.source).trim()
              : "tt_compatibility_fixture",
        })
      );
    },

    mapIdempotencyContext(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      const key = mapped.value.command.idempotencyKey;
      if (!key) {
        return lineupMappingFail(
          LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_MAPPING,
          "idempotencyKey is required for idempotency context",
          { field: "idempotencyKey" }
        );
      }
      return lineupMappingOk(
        Object.freeze({
          idempotencyKey: key,
          aggregateIdentity: mapped.value.identityKey,
          commandType: input.commandType ?? null,
          expectedVersion: mapped.value.command.expectedVersion,
        })
      );
    },

    mapExpectedVersion(input) {
      const mapped = requireMapped(input);
      if (!mapped.ok) return mapped;
      return lineupMappingOk(
        Object.freeze({
          expectedVersion: mapped.value.command.expectedVersion,
          synthesize: false,
        })
      );
    },

    mapCanonicalResultToFormat(result) {
      return mapCanonicalLineupResultToTeamTournament(result, {
        opponentAuthorized: result?.details?.opponentAuthorized === true,
        includeSelections: result?.details?.includeSelections === true,
      });
    },
  };

  if (!isLineupFormatAdapter(adapter)) {
    throw new TypeError("Fixture adapter failed contract validation");
  }
  return Object.freeze(adapter);
}
