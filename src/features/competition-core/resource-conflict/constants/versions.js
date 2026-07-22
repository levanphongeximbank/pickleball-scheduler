/**
 * CORE-14 — frozen identity / serialization versions.
 */

export const CORE14_ENGINE_ID = "competition-core-14-resource-conflict-resolver";
export const CORE14_ENGINE_VERSION = "0.1.0-phase1c";
export const CORE14_SCHEMA_VERSION = "core14-domain-foundation-v1";

export const CORE14_CRK_V1 = "CORE14_CRK_V1";
export const CORE14_LAK_V1 = "CORE14_LAK_V1";
export const CORE14_OIK_V1 = "CORE14_OIK_V1";
export const CORE14_FP_V1 = "CORE14_FP_V1";
export const CORE14_FID_V1 = "CORE14_FID_V1";

/** Phase 1F adapter / projector / shadow identity versions. */
export const CORE14_ADAPTER_CONTRACT_V1 = "core14-adapter-contract-v1";
export const CORE14_OID_V1 = "CORE14_OID_V1";
export const CORE14_ADAPTER_RESULT_V1 = "core14-adapter-result-v1";
export const CORE14_SHADOW_PARITY_V1 = "core14-shadow-parity-v1";
export const CORE14_LEGACY_MAP_V1 = "core14-legacy-cc09-map-v1";
export const CORE14_PROJECTOR_CONTRACT_V1 = "core14-projector-contract-v1";

export const CORE14_IDENTITY = Object.freeze({
  engineId: CORE14_ENGINE_ID,
  engineVersion: CORE14_ENGINE_VERSION,
  schemaVersion: CORE14_SCHEMA_VERSION,
  crkVersion: CORE14_CRK_V1,
  lakVersion: CORE14_LAK_V1,
  oikVersion: CORE14_OIK_V1,
  fingerprintVersion: CORE14_FP_V1,
  findingIdVersion: CORE14_FID_V1,
  adapterContractVersion: CORE14_ADAPTER_CONTRACT_V1,
  occupancyIdVersion: CORE14_OID_V1,
  adapterResultVersion: CORE14_ADAPTER_RESULT_V1,
  shadowParityVersion: CORE14_SHADOW_PARITY_V1,
  legacyMapVersion: CORE14_LEGACY_MAP_V1,
  projectorContractVersion: CORE14_PROJECTOR_CONTRACT_V1,
});
