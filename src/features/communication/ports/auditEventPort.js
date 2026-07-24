/**
 * AuditEventPort — emit Communication-local / platform envelopes (COMMS-01).
 * Does not replace Identity audit_logs SoT.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} AuditEventPort
 * @property {(event: unknown) => Promise<unknown>} appendAuditEvent
 */

export const AUDIT_EVENT_PORT_METHODS = Object.freeze(["appendAuditEvent"]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesAuditEventPort(port) {
  return matchesPortMethods(port, AUDIT_EVENT_PORT_METHODS);
}

/**
 * @returns {AuditEventPort}
 */
export function createUnimplementedAuditEventPort() {
  return {
    async appendAuditEvent() {
      throwPortUnimplemented("AuditEventPort", "appendAuditEvent");
    },
  };
}
