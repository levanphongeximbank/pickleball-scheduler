/**
 * CORE-09 — ParticipantSlot contract.
 *
 * Defaults (documented):
 * - schemaVersion omitted → MATCH_GENERATION_SCHEMA_VERSION
 * - participantId / sourceLogicalMatchKey / placementRef omitted → null
 * - dependency omitted → null
 * - metadata omitted → {}
 * - isBye omitted → true iff kind === BYE, else false
 *
 * kind is REQUIRED. Unknown kind → throws (never defaults to DIRECT_PARTICIPANT).
 * isBye true requires kind BYE; kind BYE forces isBye true.
 */

import {
  PARTICIPANT_SLOT_KIND,
  isParticipantSlotKind,
} from "../enums/participantSlotKind.js";
import { MATCH_GENERATION_SCHEMA_VERSION } from "../constants.js";
import { createMatchDependency } from "./matchDependency.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";

/**
 * @typedef {Object} ParticipantSlot
 * @property {string} schemaVersion
 * @property {string} kind
 * @property {string|null} participantId
 * @property {string|null} sourceLogicalMatchKey
 * @property {string|null} placementRef
 * @property {boolean} isBye
 * @property {import('./matchDependency.js').MatchDependency|null} dependency
 * @property {Readonly<Record<string, unknown>>} metadata
 */

/**
 * @param {Partial<ParticipantSlot>} [partial]
 * @returns {ParticipantSlot}
 */
export function createParticipantSlot(partial = {}) {
  if (!isParticipantSlotKind(partial?.kind)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE,
      "ParticipantSlot.kind must be a known PARTICIPANT_SLOT_KIND",
      { kind: partial?.kind ?? null }
    );
  }

  const kind = partial.kind;
  const isBye = kind === PARTICIPANT_SLOT_KIND.BYE || partial.isBye === true;
  if (isBye && kind !== PARTICIPANT_SLOT_KIND.BYE) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_BYE_REPRESENTATION,
      "isBye true requires kind BYE",
      { kind }
    );
  }

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    kind: isBye ? PARTICIPANT_SLOT_KIND.BYE : kind,
    participantId:
      typeof partial.participantId === "string" && partial.participantId.trim()
        ? partial.participantId.trim()
        : null,
    sourceLogicalMatchKey:
      typeof partial.sourceLogicalMatchKey === "string" &&
      partial.sourceLogicalMatchKey.trim()
        ? partial.sourceLogicalMatchKey.trim()
        : null,
    placementRef:
      typeof partial.placementRef === "string" && partial.placementRef.trim()
        ? partial.placementRef.trim()
        : null,
    isBye,
    dependency: partial.dependency
      ? createMatchDependency(partial.dependency)
      : null,
    metadata: freezeMetadata(partial.metadata || {}),
  });
}

/**
 * @param {Record<string, unknown>} [metadata]
 * @returns {ParticipantSlot}
 */
export function createByeParticipantSlot(metadata = {}) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.BYE,
    isBye: true,
    metadata,
  });
}
