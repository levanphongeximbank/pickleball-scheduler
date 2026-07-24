/**
 * Platform Core capability discovery — pure, read-only lookup over the
 * immutable PLATFORM_CAPABILITY_MANIFEST.
 *
 * Does not register, enable, disable, reload, scan the filesystem, load
 * modules, access the network/environment, or maintain a mutable registry.
 */

import { PLATFORM_CAPABILITY_MANIFEST } from "./capabilities.js";

/**
 * Return the canonical immutable Platform Core capability manifest.
 *
 * @returns {readonly object[]}
 */
export function listPlatformCapabilities() {
  return PLATFORM_CAPABILITY_MANIFEST;
}

/**
 * Find a capability descriptor by exact capability code.
 *
 * Surrounding whitespace is trimmed before exact matching. No fuzzy match,
 * aliasing, status filtering, or tenant filtering.
 *
 * @param {*} capabilityCode
 * @returns {object | null}
 */
export function findPlatformCapability(capabilityCode) {
  if (typeof capabilityCode !== "string") {
    return null;
  }

  const code = capabilityCode.trim();
  if (code.length === 0) {
    return null;
  }

  for (const descriptor of PLATFORM_CAPABILITY_MANIFEST) {
    if (descriptor.capabilityCode === code) {
      return descriptor;
    }
  }

  return null;
}

/**
 * Boolean wrapper over exact capability discovery.
 *
 * @param {*} capabilityCode
 * @returns {boolean}
 */
export function hasPlatformCapability(capabilityCode) {
  return findPlatformCapability(capabilityCode) !== null;
}
