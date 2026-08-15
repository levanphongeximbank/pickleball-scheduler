/**
 * Translator-only mapping from CORE-15 match status to live match_live_states.status.
 * CORE-15 remains the lifecycle authority; this does not invent a second engine.
 */

export function mapCore15ToLiveStatus(coreStatus) {
  const status = String(coreStatus || "").toUpperCase();
  if (status === "IN_PROGRESS") return "in_progress";
  if (status === "PAUSED" || status === "SUSPENDED") return "paused";
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "not_started";
}
