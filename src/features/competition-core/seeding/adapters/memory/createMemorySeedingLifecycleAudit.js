/**
 * Explicit MEMORY/TEST adapter for SeedingLifecycleAuditPort (Phase 1F).
 * Per-instance storage. Idempotent append by eventId. Not a Production default.
 */

import { deepFreezeClone } from "../../domain/deepFreeze.js";
import {
  createSeedingDomainError,
} from "../../errors/SeedingDomainError.js";
import { SEEDING_ERROR_CODE } from "../../errors/seedingErrorCodes.js";
import { CORE07_LIFECYCLE_AUDIT_PORT_VERSION } from "../../ports/SeedingLifecycleAuditPort.js";

/**
 * @returns {import('../../ports/SeedingLifecycleAuditPort.js').SeedingLifecycleAuditPort & {
 *   listEvents: () => ReadonlyArray<object>,
 *   _debug: { size: () => number, appendCalls: () => number }
 * }}
 */
export function createMemorySeedingLifecycleAudit() {
  /** @type {Map<string, object>} */
  const byEventId = new Map();
  /** @type {string[]} */
  const order = [];
  let appendCalls = 0;

  return {
    contractVersion: CORE07_LIFECYCLE_AUDIT_PORT_VERSION,
    appendLifecycleEvents(events) {
      appendCalls += 1;
      if (!Array.isArray(events)) {
        throw createSeedingDomainError(
          SEEDING_ERROR_CODE.INVALID_REQUEST,
          "lifecycle events must be an array"
        );
      }
      const out = [];
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        if (!event || typeof event !== "object" || !event.eventId) {
          throw createSeedingDomainError(
            SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
            "lifecycle event requires eventId"
          );
        }
        const id = String(event.eventId);
        const existing = byEventId.get(id);
        if (existing) {
          // Idempotent by eventId — return existing immutable copy; no overwrite.
          out.push(deepFreezeClone(existing));
          continue;
        }
        const copy = deepFreezeClone(event);
        byEventId.set(id, copy);
        order.push(id);
        out.push(deepFreezeClone(copy));
      }
      return out;
    },
    listEvents() {
      return order.map((id) => deepFreezeClone(byEventId.get(id)));
    },
    _debug: {
      size: () => byEventId.size,
      appendCalls: () => appendCalls,
    },
  };
}
