/**
 * Compatibility shim — legacy TT-1B idempotency + shadow compare exports.
 * New setup canonical exports live in ../canonical/teamTournamentCanonical.js
 */
export {
  canonicalizeTeamTournamentValue,
  canonicalizeTeamTournamentPayload,
  stableStringifyTeamTournamentValue,
  hashTeamTournamentCanonicalValue,
} from "../canonical/teamTournamentCanonicalLegacy.js";

export {
  canonicalizeSetupSnapshot,
  serializeCanonicalSetupSnapshot,
  hashCanonicalSetupSnapshot,
  hashCanonicalSetupSnapshotAsync,
  hashEngineInput,
  hashEngineInputAsync,
  hashEngineOutput,
  hashEngineOutputAsync,
  compareSnapshotHashes,
  buildSetupMutationEnvelope,
  buildSetupMutationEnvelopeAsync,
  validateSetupMutationEnvelope,
  validateSetupMutationEnvelopeAsync,
  calculateSetupMutationPayloadHash,
  calculateSetupMutationPayloadHashAsync,
  buildCanonicalSetupSnapshot,
  validateCanonicalSetupSnapshot,
  SETUP_COMMAND_REGISTRY,
  CANONICAL_SCHEMA_VERSION,
} from "../canonical/teamTournamentCanonical.js";
