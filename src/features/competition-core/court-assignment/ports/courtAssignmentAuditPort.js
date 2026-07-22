/**
 * CORE-12 — CourtAssignmentAuditPort (optional; in-memory double for Phase 1B).
 */

/**
 * @returns {{ append: (event: object) => { auditEventId: string }, events: () => object[] }}
 */
export function createInMemoryCourtAssignmentAuditPort() {
  /** @type {object[]} */
  const events = [];
  let seq = 0;
  return Object.freeze({
    append(event) {
      seq += 1;
      const auditEventId = `ca-audit-${String(seq).padStart(4, "0")}`;
      events.push(Object.freeze({ auditEventId, ...(event || {}) }));
      return Object.freeze({ auditEventId });
    },
    events() {
      return events.slice();
    },
  });
}
