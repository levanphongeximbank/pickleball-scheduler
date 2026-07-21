/**
 * CORE-06 Phase 1F — generic TT compatibility fixture → canonical command input.
 * Accepts fixtures only. No Production / TT runtime imports.
 */

import { buildLineupIdentityKey, buildLineupSlotId } from "../contracts/lineupIdentity.js";
import { lineupMappingFail, lineupMappingOk } from "../contracts/mappingResult.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { mapLegacyLineupStatus } from "../mappers/statusMapper.js";
import { LINEUP_VISIBILITY_STATE } from "../contracts/lineupVisibilityState.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../participants/enums/identityKinds.js";

/**
 * ASCII-only trim; no locale case folding for ids.
 * @param {unknown} value
 * @returns {string}
 */
function trimId(value) {
  return value == null ? "" : String(value).trim();
}

/**
 * @param {unknown} slots
 * @param {string} identityKey
 */
function mapSlots(slots, identityKey) {
  if (slots == null) return [];
  if (!Array.isArray(slots)) {
    throw new Error("INVALID_SLOTS");
  }
  return slots.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("INVALID_SLOT");
    }
    const disciplineOrSideKey = trimId(
      raw.disciplineOrSideKey ?? raw.discipline ?? raw.side ?? ""
    );
    const index =
      typeof raw.index === "number" && Number.isInteger(raw.index)
        ? raw.index
        : i;
    const personId = trimId(
      raw.personId ?? raw.playerId ?? raw.person?.id ?? ""
    );
    const personKind = trimId(
      raw.personKind ?? raw.person?.kind ?? PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE
    );
    if (!disciplineOrSideKey || !personId) {
      throw new Error("INVALID_SLOT");
    }
    return Object.freeze({
      id: buildLineupSlotId({
        lineupIdentityKey: identityKey,
        disciplineOrSideKey,
        index,
      }),
      disciplineOrSideKey,
      index,
      person: Object.freeze({ kind: personKind, id: personId }),
    });
  });
}

/**
 * Map a generic Team Tournament compatibility fixture to canonical input.
 * @param {object} input
 * @returns {import('../contracts/mappingResult.js').LineupMappingOk|import('../contracts/mappingResult.js').LineupMappingFail}
 */
export function mapTeamTournamentLineupInputToCanonical(input = {}) {
  if (!input || typeof input !== "object") {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_MAPPING,
      "Fixture input must be an object"
    );
  }

  const tenantId = trimId(input.tenantId);
  const competitionId = trimId(input.competitionId ?? input.tournamentId);
  const teamId = trimId(input.teamId);
  const contextId = trimId(input.contextId ?? input.matchupId);

  if (!tenantId || !competitionId || !teamId || !contextId) {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_SCOPE_REQUIRED,
      "tenantId, competitionId, teamId, and contextId/matchupId are required",
      { tenantId: !!tenantId, competitionId: !!competitionId, teamId: !!teamId, contextId: !!contextId }
    );
  }

  const identityKey = buildLineupIdentityKey({
    competitionId,
    contextId,
    teamId,
  });
  const providedKey = trimId(input.identityKey ?? input.lineupIdentityKey);
  if (providedKey && providedKey !== identityKey) {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_MISMATCH,
      "Ambiguous or conflicting lineup identity",
      { providedKey, identityKey }
    );
  }

  let status;
  try {
    status = mapLegacyLineupStatus(input.status ?? input.lineupStatus);
  } catch {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.UNSUPPORTED_LINEUP_STATUS,
      "Unsupported legacy lineup status",
      { status: input.status ?? input.lineupStatus }
    );
  }

  let slots;
  try {
    slots = mapSlots(input.slots ?? input.selections, identityKey);
  } catch {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_MAPPING,
      "Invalid legacy slot/selection payload"
    );
  }

  // Never infer reveal/visibility from lifecycle.
  const visibilityState =
    typeof input.visibilityState === "string" &&
    Object.values(LINEUP_VISIBILITY_STATE).includes(input.visibilityState)
      ? input.visibilityState
      : LINEUP_VISIBILITY_STATE.PRIVATE;

  const expectedVersion =
    input.expectedVersion != null &&
    Number.isInteger(Number(input.expectedVersion))
      ? Number(input.expectedVersion)
      : null;

  const evaluatedAt = trimId(input.evaluatedAt ?? input.commandTime ?? input.policyTime);
  if (!evaluatedAt) {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_CLOCK_REQUIRED,
      "evaluatedAt (or commandTime/policyTime) is required"
    );
  }

  const correctionAuthorized = input.correctionAuthorized === true;
  // Do not infer correction authorization from role or status.
  void input.actorRole;

  return lineupMappingOk(
    Object.freeze({
      tenantId,
      competitionId,
      teamId,
      contextId,
      identityKey,
      rosterId: trimId(input.rosterId) || null,
      rosterVersion:
        input.rosterVersion != null && Number.isInteger(Number(input.rosterVersion))
          ? Number(input.rosterVersion)
          : null,
      status,
      visibilityState,
      slots,
      sourceVersion: trimId(input.sourceVersion ?? input.schemaVersion) || null,
      legacyStatus: trimId(input.status ?? input.lineupStatus) || null,
      command: Object.freeze({
        actorId: trimId(input.actorId) || null,
        actorRole: trimId(input.actorRole) || null,
        source: trimId(input.source) || "tt_compatibility_fixture",
        idempotencyKey: trimId(input.idempotencyKey) || null,
        expectedVersion,
        evaluatedAt,
        reason: trimId(input.reason ?? input.correctionReason) || null,
        correctionAuthorized,
        // Never synthesize expectedVersion.
        synthesizeExpectedVersion: false,
      }),
      deadlineTimestamps: input.deadlineTimestamps
        ? Object.freeze({ ...input.deadlineTimestamps })
        : Object.freeze({
            opensAt: trimId(input.opensAt) || null,
            submitBy: trimId(input.submitBy) || null,
            lockAt: trimId(input.lockAt ?? input.lineupLockAt) || null,
            revealAt: trimId(input.revealAt) || null,
            graceUntil: trimId(input.graceUntil) || null,
            correctionUntil: trimId(input.correctionUntil) || null,
          }),
      seed: trimId(input.seed ?? input.ownerSeed) || null,
      revealEligible: input.revealEligible === true,
    }),
    { mapper: "mapTeamTournamentLineupInputToCanonical" }
  );
}
