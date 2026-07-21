/**
 * CORE-09 — participant snapshot reference bound into generation context.
 */

import { MATCH_GENERATION_SCHEMA_VERSION } from "../constants.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";

/**
 * @param {Partial<object>} [partial]
 */
export function createParticipantSnapshotRef(partial = {}) {
  const participantIds = Object.freeze(
    (Array.isArray(partial.participantIds) ? partial.participantIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    snapshotId: String(partial.snapshotId || "").trim(),
    participantFingerprint: String(partial.participantFingerprint || "").trim(),
    participantIds,
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
