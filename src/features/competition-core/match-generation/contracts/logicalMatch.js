/**
 * CORE-09 — LogicalMatch contract (logical plan only — no schedule/score/lifecycle).
 *
 * Defaults (documented):
 * - schemaVersion → MATCH_GENERATION_SCHEMA_VERSION
 * - categoryId / groupId / bracketId omitted → null
 * - dependencyInputs / sourcePlacementRefs omitted → []
 * - winnerTo / loserTo omitted → null
 * - deterministicOrder omitted → matchNumber (after matchNumber validated)
 * - metadata → {}
 * - logicalMatchKey omitted → derived via buildLogicalMatchKey
 *
 * roundNumber / matchNumber must be positive integers (no coerce-to-zero).
 * competitionId, divisionId, stageId required non-empty for key derivation.
 */

import { MATCH_GENERATION_SCHEMA_VERSION } from "../constants.js";
import { createParticipantSlot } from "./participantSlot.js";
import { createMatchDependency } from "./matchDependency.js";
import { buildLogicalMatchKey } from "../services/buildLogicalMatchKey.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";
import { PARTICIPANT_SLOT_KIND } from "../enums/participantSlotKind.js";

/**
 * @typedef {Object} LogicalMatch
 * @property {string} schemaVersion
 * @property {string} logicalMatchKey
 * @property {string} competitionId
 * @property {string} divisionId
 * @property {string|null} categoryId
 * @property {string} stageId
 * @property {string|null} groupId
 * @property {string|null} bracketId
 * @property {number} roundNumber
 * @property {number} matchNumber
 * @property {import('./participantSlot.js').ParticipantSlot} participantSlotA
 * @property {import('./participantSlot.js').ParticipantSlot} participantSlotB
 * @property {ReadonlyArray<import('./matchDependency.js').MatchDependency>} dependencyInputs
 * @property {import('./matchDependency.js').MatchDependency|null} winnerTo
 * @property {import('./matchDependency.js').MatchDependency|null} loserTo
 * @property {boolean} isByeMatch
 * @property {ReadonlyArray<string>} sourcePlacementRefs
 * @property {number} deterministicOrder
 * @property {Readonly<Record<string, unknown>>} metadata
 */

/**
 * @param {Partial<LogicalMatch>} [partial]
 * @returns {LogicalMatch}
 */
export function createLogicalMatch(partial = {}) {
  if (!partial.participantSlotA || !partial.participantSlotB) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH,
      "participantSlotA and participantSlotB are required"
    );
  }

  const competitionId = String(partial.competitionId || "").trim();
  const divisionId = String(partial.divisionId || "").trim();
  const stageId = String(partial.stageId || "").trim();
  const groupId =
    typeof partial.groupId === "string" && partial.groupId.trim()
      ? partial.groupId.trim()
      : null;
  const bracketId =
    typeof partial.bracketId === "string" && partial.bracketId.trim()
      ? partial.bracketId.trim()
      : null;
  const categoryId =
    typeof partial.categoryId === "string" && partial.categoryId.trim()
      ? partial.categoryId.trim()
      : null;

  const roundNumber = partial.roundNumber;
  const matchNumber = partial.matchNumber;

  const logicalMatchKey =
    typeof partial.logicalMatchKey === "string" &&
    partial.logicalMatchKey.trim()
      ? partial.logicalMatchKey.trim()
      : buildLogicalMatchKey({
          competitionId,
          divisionId,
          categoryId,
          stageId,
          groupId,
          bracketId,
          roundNumber,
          matchNumber,
        });

  // When key is supplied explicitly, still require positive ints on the match.
  if (
    typeof roundNumber !== "number" ||
    !Number.isInteger(roundNumber) ||
    roundNumber < 1
  ) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_COORDINATES,
      "roundNumber must be a positive integer",
      { roundNumber }
    );
  }
  if (
    typeof matchNumber !== "number" ||
    !Number.isInteger(matchNumber) ||
    matchNumber < 1
  ) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_COORDINATES,
      "matchNumber must be a positive integer",
      { matchNumber }
    );
  }

  const participantSlotA = createParticipantSlot(partial.participantSlotA);
  const participantSlotB = createParticipantSlot(partial.participantSlotB);
  const isByeMatch =
    partial.isByeMatch === true ||
    participantSlotA.isBye ||
    participantSlotB.isBye ||
    participantSlotA.kind === PARTICIPANT_SLOT_KIND.BYE ||
    participantSlotB.kind === PARTICIPANT_SLOT_KIND.BYE;

  if (
    (participantSlotA.isBye || participantSlotB.isBye) &&
    partial.isByeMatch === false
  ) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_BYE_REPRESENTATION,
      "Bye slot present but isByeMatch is false"
    );
  }

  const dependencyInputs = Object.freeze(
    (Array.isArray(partial.dependencyInputs) ? partial.dependencyInputs : []).map(
      (d) => createMatchDependency(d)
    )
  );

  const sourcePlacementRefs = Object.freeze(
    (Array.isArray(partial.sourcePlacementRefs)
      ? partial.sourcePlacementRefs
      : []
    ).map((r) => {
      const s = String(r || "").trim();
      if (!s) {
        throw new MatchGenerationContractError(
          MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
          "sourcePlacementRefs entries must be non-empty strings"
        );
      }
      return s;
    })
  );

  const deterministicOrder =
    partial.deterministicOrder === undefined ||
    partial.deterministicOrder === null
      ? matchNumber
      : partial.deterministicOrder;
  if (
    typeof deterministicOrder !== "number" ||
    !Number.isInteger(deterministicOrder)
  ) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH,
      "deterministicOrder must be an integer when provided",
      { deterministicOrder }
    );
  }

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    logicalMatchKey,
    competitionId,
    divisionId,
    categoryId,
    stageId,
    groupId,
    bracketId,
    roundNumber,
    matchNumber,
    participantSlotA,
    participantSlotB,
    dependencyInputs,
    winnerTo: partial.winnerTo ? createMatchDependency(partial.winnerTo) : null,
    loserTo: partial.loserTo ? createMatchDependency(partial.loserTo) : null,
    isByeMatch,
    sourcePlacementRefs,
    deterministicOrder,
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
