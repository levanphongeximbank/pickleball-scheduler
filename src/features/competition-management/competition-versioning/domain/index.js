/**
 * Domain validators / pure helpers for Competition Versioning (CM-03).
 */

export {
  buildVersionContentFromDefinition,
  computeVersionContentFingerprint,
  assembleCompetitionVersion,
  isCompetitionVersion,
  collectDefinitionScopeErrors,
} from "../contracts/snapshot.js";

export {
  createCompetitionVersionId,
  parseCompetitionVersionId,
} from "../contracts/identity.js";

export {
  stableContentFingerprint,
  canonicalizeJson,
} from "../contracts/shared.js";
