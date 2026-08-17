/**
 * Composition binding — Mobile offline queue cleanup on auth session clear.
 */
import { registerAuthSessionClearHook } from "../../../auth/authSessionHooks.js";
import { quarantineOfflineQueueOnLogout } from "../services/offlineQueueQuarantine.js";

function onAuthSessionClear() {
  quarantineOfflineQueueOnLogout();
}

export function registerMobileOfflineQueueAuthCleanup() {
  registerAuthSessionClearHook(onAuthSessionClear);
}
