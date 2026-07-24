/**
 * Operation / Compatibility adoption adapters (Platform Core).
 *
 * Pure projection helpers over already-resolved operation, idempotency,
 * version, and compatibility values. Do not generate identifiers, detect
 * duplicates, persist, lock, retry, replay, recover, compare versions,
 * migrate, or access request headers / environment / storage.
 */

export {
  projectIdempotencyKey,
  IDEMPOTENCY_KEY_ADAPTER_ERROR,
} from "./idempotencyKeyAdapter.js";

export {
  projectOperationIdentity,
  OPERATION_IDENTITY_ADAPTER_ERROR,
} from "./operationIdentityAdapter.js";

export {
  projectContractVersion,
  CONTRACT_VERSION_ADAPTER_ERROR,
} from "./contractVersionAdapter.js";

export {
  projectCompatibilityDecision,
  COMPATIBILITY_DECISION_ADAPTER_ERROR,
} from "./compatibilityDecisionAdapter.js";
