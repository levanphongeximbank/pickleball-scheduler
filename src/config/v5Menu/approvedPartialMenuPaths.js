/**
 * Approved PARTIAL menu paths — CRM Phase 1B readiness correction.
 *
 * Exact path allowlist (labels may change; paths are the contract).
 * Do not broaden without an explicit owner decision.
 */

export const APPROVED_PARTIAL_MENU_PATHS = Object.freeze([
  "/crm/messages",
  "/crm/templates",
  "/crm/campaigns",
  "/crm/history",
  "/crm/reminders/booking",
]);

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
export function normalizeMenuPathSet(paths) {
  return [...new Set((paths || []).map((p) => String(p || "").trim()).filter(Boolean))].sort();
}
