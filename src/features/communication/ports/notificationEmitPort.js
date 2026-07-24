/**
 * NotificationEmitPort — emit-only bridge to Notification Foundation (COMMS-01).
 * Does not own inbox / worker / delivery providers.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} NotificationEmitPort
 * @property {(event: unknown) => Promise<unknown>} emitDomainNotificationEvent
 */

export const NOTIFICATION_EMIT_PORT_METHODS = Object.freeze([
  "emitDomainNotificationEvent",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesNotificationEmitPort(port) {
  return matchesPortMethods(port, NOTIFICATION_EMIT_PORT_METHODS);
}

/**
 * @returns {NotificationEmitPort}
 */
export function createUnimplementedNotificationEmitPort() {
  return {
    async emitDomainNotificationEvent() {
      throwPortUnimplemented(
        "NotificationEmitPort",
        "emitDomainNotificationEvent"
      );
    },
  };
}
