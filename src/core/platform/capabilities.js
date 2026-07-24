/**
 * Platform Core capability manifest (Phase 2A + Identity/Tenant + Event/Audit
 * adapters).
 *
 * Immutable descriptor list of Phase 1 certified contracts and certified
 * Identity/Tenant and Event/Audit projection adapters. Does not auto-discover
 * modules, mutate a registry, execute capabilities, read feature flags, touch
 * persistence, or claim runtime/production adoption.
 */

import { createPlatformCapabilityDescriptor } from "./contracts/platformCapabilityDescriptor.js";

const OWNER_MODULE = "platform-core";
const CONTRACT_VERSION = "1.0.0";
const CONTRACT_STATUS = "CONTRACT_AVAILABLE";
const ADAPTER_STATUS = "ADAPTER_AVAILABLE";

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
 * Identity/Tenant adapter capability codes (deterministic order).
 * Status is ADAPTER_AVAILABLE only — not PRODUCTION_READY.
 * @type {readonly string[]}
 */
const IDENTITY_TENANT_ADAPTER_CAPABILITY_CODES = Object.freeze([
  "IDENTITY_ACTOR_ADAPTER",
  "SECURITY_CONTEXT_ADAPTER",
  "TENANT_SCOPE_ADAPTER",
  "PERMISSION_CODE_ADAPTER",
  "AUTHORIZATION_REQUEST_ADAPTER",
  "AUTHORIZATION_DECISION_ADAPTER",
]);

/**
 * Event/Audit adapter capability codes (deterministic order).
 * Status is ADAPTER_AVAILABLE only — not PRODUCTION_READY / RUNTIME_ADOPTED.
 * @type {readonly string[]}
 */
const EVENT_AUDIT_ADAPTER_CAPABILITY_CODES = Object.freeze([
  "EVENT_TRACE_CONTEXT_ADAPTER",
  "COMMON_EVENT_ENVELOPE_ADAPTER",
  "AUDIT_EVENT_ENVELOPE_ADAPTER",
  "EVENT_ERROR_DESCRIPTOR_ADAPTER",
]);

/**
 * @param {readonly { capabilityCode: string, status: string }[]} entries
 * @returns {readonly import("./contracts/platformCapabilityDescriptor.js").PlatformCapabilityDescriptor[]}
 */
function createImmutableCapabilityManifest(entries) {
  const seen = new Set();
  /** @type {import("./contracts/platformCapabilityDescriptor.js").PlatformCapabilityDescriptor[]} */
  const items = [];

  for (const entry of entries) {
    const { capabilityCode, status } = entry;
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
      status,
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

const MANIFEST_ENTRIES = Object.freeze([
  ...PHASE_1_CAPABILITY_CODES.map((capabilityCode) => ({
    capabilityCode,
    status: CONTRACT_STATUS,
  })),
  ...IDENTITY_TENANT_ADAPTER_CAPABILITY_CODES.map((capabilityCode) => ({
    capabilityCode,
    status: ADAPTER_STATUS,
  })),
  ...EVENT_AUDIT_ADAPTER_CAPABILITY_CODES.map((capabilityCode) => ({
    capabilityCode,
    status: ADAPTER_STATUS,
  })),
]);

/**
 * Immutable Platform Core capability manifest.
 * Contract items reflect contract availability; adapter items reflect
 * adapter availability only — not production runtime adoption.
 */
export const PLATFORM_CAPABILITY_MANIFEST = createImmutableCapabilityManifest(
  MANIFEST_ENTRIES
);

Object.freeze(PLATFORM_CAPABILITY_MANIFEST);
