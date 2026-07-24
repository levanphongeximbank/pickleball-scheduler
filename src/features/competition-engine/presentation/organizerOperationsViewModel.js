/**
 * Minimal Organizer Operations view-model for portal wiring.
 * Presentation-only — no commands, no permission enforcement.
 */

import { ORGANIZER_LIFECYCLE_STATE } from "../operations/constants.js";

/**
 * @param {object} projection
 * @returns {ReadonlyArray<{ id: string, title: string, ready: boolean, detail: string }>}
 */
export function buildOrganizerPortalSections(projection) {
  const p = projection && typeof projection === "object" ? projection : {};
  const readiness = p.readiness || {};

  return Object.freeze([
    Object.freeze({
      id: "overview",
      title: "Overview / Readiness",
      ready: Boolean(p.lifecycleState && p.lifecycleState !== ORGANIZER_LIFECYCLE_STATE.UNINITIALIZED),
      detail: String(p.lifecycleState || ORGANIZER_LIFECYCLE_STATE.UNINITIALIZED),
    }),
    Object.freeze({
      id: "participants",
      title: "Participants",
      ready: readiness.participantFieldLocked === true,
      detail: `eligible=${p.participantSummary?.eligible ?? 0}/${p.participantSummary?.total ?? 0}`,
    }),
    Object.freeze({
      id: "pool-draw",
      title: "Pool and Draw",
      ready: readiness.poolComposition === true,
      detail: readiness.poolMatchPlan ? "match-plan-ready" : "composition-pending",
    }),
    Object.freeze({
      id: "schedule-courts",
      title: "Schedule and Courts",
      ready: readiness.schedule === true && readiness.courtAssignment === true,
      detail: `schedule=${Boolean(readiness.schedule)} courts=${Boolean(readiness.courtAssignment)}`,
    }),
    Object.freeze({
      id: "check-in",
      title: "Check-in Summary",
      ready: readiness.checkIn === true,
      detail: String(p.checkInState || "NOT_OPENED"),
    }),
    Object.freeze({
      id: "match-ops",
      title: "Match Operations",
      ready: readiness.liveOperations === true,
      detail: String(p.liveOperationsState || "CLOSED"),
    }),
    Object.freeze({
      id: "standings-qualification",
      title: "Standings / Qualification Readiness",
      ready: readiness.standings === true && readiness.qualification === true,
      detail: `standings=${Boolean(readiness.standings)} qualification=${Boolean(readiness.qualification)}`,
    }),
    Object.freeze({
      id: "knockout",
      title: "Knockout Activation",
      ready: readiness.knockout === true,
      detail: readiness.knockout ? "active" : "pending",
    }),
    Object.freeze({
      id: "publication",
      title: "Publication / Completion",
      ready: readiness.completion === true,
      detail: String(p.publicationState || "NONE"),
    }),
    Object.freeze({
      id: "archive",
      title: "Archive Readiness",
      ready: readiness.archive === true,
      detail: readiness.archive ? "ready" : "blocked",
    }),
  ]);
}
