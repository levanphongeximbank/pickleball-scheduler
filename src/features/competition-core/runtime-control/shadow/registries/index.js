/**
 * Shadow registries (Phase 3A.3).
 * Integrator-owned. Empty stubs — Shadow remains deny / OFF.
 */

export {
  SHADOW_COMPARATOR_REGISTRY_VERSION,
  createShadowComparatorRegistry,
  defaultShadowComparatorRegistry,
  getShadowComparatorRegistration,
  listShadowComparatorRegistrations,
  isShadowComparatorRegistryEmpty,
  registerShadowComparator,
  resolveShadowComparator,
  unregisterShadowComparator,
  resetShadowComparatorRegistryForTests,
} from "./comparators.js";

export {
  SHADOW_NORMALIZER_REGISTRY_VERSION,
  createShadowNormalizerRegistry,
  defaultShadowNormalizerRegistry,
  getShadowNormalizerRegistration,
  listShadowNormalizerRegistrations,
  isShadowNormalizerRegistryEmpty,
  registerShadowNormalizer,
  resolveShadowNormalizer,
  unregisterShadowNormalizer,
  resetShadowNormalizerRegistryForTests,
} from "./normalizers.js";

export {
  SHADOW_ELIGIBILITY_ALLOWLIST_REGISTRY_VERSION,
  createEligibilityAllowlistRegistry,
  defaultEligibilityAllowlistRegistry,
  getDefaultCapabilityAllowlist,
  getDefaultOperationAllowlist,
  getEligibilityAllowlistRegistration,
  resolveEligibilityAllowlist,
  resolveEligibilityAllowlistsFromRegistry,
  listEligibilityAllowlistRegistrations,
  isEligibilityAllowlistRegistryEmpty,
  registerEligibilityAllowlist,
  unregisterEligibilityAllowlist,
  resetEligibilityAllowlistRegistryForTests,
} from "./eligibilityAllowlists.js";
