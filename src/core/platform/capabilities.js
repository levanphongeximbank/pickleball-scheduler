/**
 * Platform Core capability manifest (Phase 2A).
 *
 * Immutable descriptor list of Phase 1 certified contracts.
 * Does not auto-discover modules, mutate a registry, execute capabilities,
 * read feature flags, touch persistence, or claim runtime adoption.
 */

import { createPlatformCapabilityDescriptor } from "./contracts/platformCapabilityDescriptor.js";

const OWNER_MODULE = "platform-core";
const CONTRACT_VERSION = "1.0.0";
const CONTRACT_STATUS = "CONTRACT_AVAILABLE";

/**
 * Phase 1 certified contract capability codes (deterministic order).
 * @type {readonly string[]}
 */
const PHASE_1_CAPABILITY_CODES = Object.freeze([
  "RESULT",
  "OPAQUE_ID",
  "ISO_CLOCK",
  "ACTOR_REFERENCE",
  "SUBJECT_REFERENCE",
  "SECURITY_CONTEXT",
  "TRACE_CONTEXT",
  "COMMON_EVENT_ENVELOPE",
  "PLATFORM_SCOPE",
  "AUTHORIZATION_DECISION",
  "ROLE_CODE",
  "PERMISSION_CODE",
  "AUTHORIZATION_REQUEST",
  "IDEMPOTENCY_KEY",
  "OPERATION_IDENTITY",
  "CONTRACT_VERSION",
  "COMPATIBILITY_DECISION",
  "PLATFORM_ERROR_DESCRIPTOR",
  "INTEGRATION_PORT_DESCRIPTOR",
  "PLATFORM_CAPABILITY_DESCRIPTOR",
]);

/**
 * @param {readonly string[]} capabilityCodes
 * @returns {readonly import("./contracts/platformCapabilityDescriptor.js").PlatformCapabilityDescriptor[]}
 */
function createImmutableCapabilityManifest(capabilityCodes) {
  const seen = new Set();
  /** @type {import("./contracts/platformCapabilityDescriptor.js").PlatformCapabilityDescriptor[]} */
  const items = [];

  for (const capabilityCode of capabilityCodes) {
    if (seen.has(capabilityCode)) {
      throw new Error(
        `Duplicate Platform Core capabilityCode: ${capabilityCode}`
      );
    }
    seen.add(capabilityCode);

    const result = createPlatformCapabilityDescriptor({
      capabilityCode,
      ownerModule: OWNER_MODULE,
      version: CONTRACT_VERSION,
      status: CONTRACT_STATUS,
    });

    if (!result.ok) {
      throw new Error(
        `Invalid Platform Core capability descriptor for ${capabilityCode}: ${result.error.code}`
      );
    }

    items.push(result.value);
  }

  return Object.freeze(items);
}

/**
 * Immutable Platform Core capability manifest.
 * Status reflects contract availability only — not production adoption.
 */
export const PLATFORM_CAPABILITY_MANIFEST = createImmutableCapabilityManifest(
  PHASE_1_CAPABILITY_CODES
);

Object.freeze(PLATFORM_CAPABILITY_MANIFEST);
