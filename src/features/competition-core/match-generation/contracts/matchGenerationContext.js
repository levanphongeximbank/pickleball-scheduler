/**
 * CORE-09 — immutable MatchGenerationContext.
 */

import {
  MATCH_GENERATION_SCHEMA_VERSION,
  MATCH_GENERATOR_IDENTITY,
} from "../constants.js";
import { createDrawSnapshot } from "./drawSnapshot.js";
import { createEvaluatedMatchGenerationRules } from "./evaluatedMatchGenerationRules.js";
import { createParticipantSnapshotRef } from "./participantSnapshot.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";

/**
 * @param {Partial<object>} [partial]
 */
export function createMatchGenerationContext(partial = {}) {
  const deterministicOrderingInputs = Object.freeze(
    (Array.isArray(partial.deterministicOrderingInputs)
      ? partial.deterministicOrderingInputs
      : []
    ).map((v) => String(v ?? ""))
  );

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    drawSnapshot: createDrawSnapshot(partial.drawSnapshot || {}),
    evaluatedRules: createEvaluatedMatchGenerationRules(
      partial.evaluatedRules || {}
    ),
    participantSnapshot: createParticipantSnapshotRef(
      partial.participantSnapshot || {}
    ),
    deterministicOrderingInputs,
    generatorVersion: String(
      partial.generatorVersion || MATCH_GENERATOR_IDENTITY.version
    ).trim(),
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
