/**
 * Contact timeline projector (Phase 1B foundation).
 * Pure read-model helper — no persistence, no UI coupling.
 */

/**
 * @param {object[]} interactions
 * @returns {object[]}
 */
export function projectContactTimeline(interactions = []) {
  if (!Array.isArray(interactions)) return [];
  return [...interactions]
    .filter(Boolean)
    .map((row) =>
      Object.freeze({
        interactionId: row.interactionId,
        type: row.type,
        body: row.body ?? null,
        actorUserId: row.actorUserId ?? null,
        occurredAt: row.occurredAt ?? row.createdAt ?? null,
        contactRefId: row.contactRefId ?? null,
        tenantId: row.tenantId,
        venueId: row.venueId,
      })
    )
    .sort((a, b) => String(b.occurredAt || "").localeCompare(String(a.occurredAt || "")));
}
