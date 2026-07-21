/**
 * Contact timeline projector (Phase 1B foundation + Phase 1E field aliases).
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
        interactionType: row.interactionType ?? row.type ?? null,
        type: row.interactionType ?? row.type ?? null,
        direction: row.direction ?? null,
        channel: row.channel ?? null,
        summary: row.summary ?? row.body ?? null,
        body: row.summary ?? row.body ?? null,
        outcome: row.outcome ?? null,
        recordedByActorId: row.recordedByActorId ?? row.actorUserId ?? null,
        actorUserId: row.recordedByActorId ?? row.actorUserId ?? null,
        occurredAt: row.occurredAt ?? row.createdAt ?? null,
        contactRefId: row.contactRefId ?? null,
        leadId: row.leadId ?? null,
        opportunityId: row.opportunityId ?? null,
        tenantId: row.tenantId,
        venueId: row.venueId,
      })
    )
    .sort((a, b) => {
      const occurredCmp = String(b.occurredAt || "").localeCompare(String(a.occurredAt || ""));
      if (occurredCmp !== 0) return occurredCmp;
      return String(a.interactionId || "").localeCompare(String(b.interactionId || ""));
    });
}
