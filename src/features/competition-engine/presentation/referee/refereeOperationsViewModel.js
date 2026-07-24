/**
 * Referee Hub MVP sections — presentation adapter only (E2E-04).
 */

import { deepFreeze } from "../../operations/fingerprint.js";

/**
 * @param {object} projection
 * @returns {ReadonlyArray<object>}
 */
export function buildRefereePortalSections(projection) {
  const p = projection || {};
  const assigned = p.assignedMatch || null;
  const sections = [
    {
      id: "assignment-queue",
      title: "Assignment queue",
      queue: p.assignmentQueue || [],
      referee: p.referee || null,
    },
    {
      id: "match-detail",
      title: "Match detail",
      assignedMatch: assigned,
    },
    {
      id: "readiness",
      title: "Readiness",
      checkInReady: assigned?.checkInReady === true,
      lifecycleState: assigned?.lifecycleState || null,
      scoreEntryReady: assigned?.scoreEntryReady === true,
    },
    {
      id: "score-entry",
      title: "Score entry",
      scoreProjection: assigned?.scoreProjection || null,
      scoreEntryReady: assigned?.scoreEntryReady === true,
    },
    {
      id: "validation-status",
      title: "Validation status",
      validationStatus: assigned?.validationStatus || null,
      validatedResult: assigned?.validatedResult || null,
      standingsNote: "Standings only consume accepted results",
      winnerInference: false,
    },
    {
      id: "correction-flow",
      title: "Correction flow",
      correctionRequired: assigned?.correctionRequired === true,
      correctionRequiredCodes: assigned?.correctionRequiredCodes || [],
    },
  ];

  return deepFreeze(
    sections.map((s) => ({
      ...s,
      allowedActions: p.allowedActions || [],
      deniedActions: p.deniedActions || [],
    }))
  );
}
