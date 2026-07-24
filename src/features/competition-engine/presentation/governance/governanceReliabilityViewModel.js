/**
 * Minimal Governance & Reliability view-model for Organizer/Admin ops.
 * Presentation-only — no side effects.
 */

import { RUNTIME_HEALTH_STATE } from "../../operations/governance/constants.js";

/**
 * @param {object} governanceProjection
 * @returns {ReadonlyArray<{ id: string, title: string, available: boolean, detail: string }>}
 */
export function buildGovernanceReliabilitySections(governanceProjection) {
  const p =
    governanceProjection && typeof governanceProjection === "object"
      ? governanceProjection
      : {};

  const healthState = String(p.healthState || RUNTIME_HEALTH_STATE.BLOCKED);
  const blockingCount = Array.isArray(p.blockingIssues)
    ? p.blockingIssues.length
    : 0;
  const warningCount = Array.isArray(p.warnings) ? p.warnings.length : 0;
  const allowed = Array.isArray(p.allowedActions) ? p.allowedActions.length : 0;
  const denied = Array.isArray(p.deniedActions) ? p.deniedActions.length : 0;

  const flag = (node) =>
    node && typeof node === "object" ? node.ready === true : false;

  return Object.freeze([
    Object.freeze({
      id: "overall-health",
      title: "Overall Health",
      available: healthState === RUNTIME_HEALTH_STATE.READY,
      detail: healthState,
    }),
    Object.freeze({
      id: "identity-tenant",
      title: "Identity & Tenant",
      available: Boolean(p.tenantId) && Boolean(p.competitionId),
      detail: `tenant=${p.tenantId || "-"} competition=${p.competitionId || "-"}`,
    }),
    Object.freeze({
      id: "definition-version",
      title: "Definition & Version",
      available: Boolean(p.definition?.version || p.definition?.ruleSetVersion),
      detail: String(
        p.definition?.ruleSetVersion || p.definition?.version || "UNSET"
      ),
    }),
    Object.freeze({
      id: "participants",
      title: "Participants",
      available: flag(p.participantLock),
      detail: flag(p.participantLock) ? "LOCKED" : "NOT_LOCKED",
    }),
    Object.freeze({
      id: "schedule-courts",
      title: "Schedule & Courts",
      available: flag(p.scheduleCourtCertification),
      detail: flag(p.scheduleCourtCertification) ? "CERTIFIED" : "UNCERTIFIED",
    }),
    Object.freeze({
      id: "checkin-referee",
      title: "Check-in & Referee",
      available: flag(p.checkInReadiness) && flag(p.refereeAssignmentReadiness),
      detail: `checkIn=${flag(p.checkInReadiness)} referee=${flag(
        p.refereeAssignmentReadiness
      )}`,
    }),
    Object.freeze({
      id: "scoring-validation",
      title: "Scoring & Validation",
      available:
        flag(p.scoringReadiness) && flag(p.resultValidationReadiness),
      detail: `scoring=${flag(p.scoringReadiness)} validation=${flag(
        p.resultValidationReadiness
      )}`,
    }),
    Object.freeze({
      id: "standings-qualification",
      title: "Standings & Qualification",
      available:
        flag(p.standingsReadiness) && flag(p.qualificationReadiness),
      detail: `standings=${flag(p.standingsReadiness)} qualification=${flag(
        p.qualificationReadiness
      )}`,
    }),
    Object.freeze({
      id: "publication-public",
      title: "Publication & Public Experience",
      available: flag(p.publicVisibilityReadiness),
      detail: String(p.publication?.state || "UNKNOWN"),
    }),
    Object.freeze({
      id: "audit-evidence",
      title: "Audit & Evidence",
      available: flag(p.auditReadiness),
      detail: flag(p.auditReadiness) ? "PRESENT" : "MISSING",
    }),
    Object.freeze({
      id: "replay-import-export",
      title: "Replay & Import/Export",
      available: flag(p.replayReadiness) && flag(p.importExportReadiness),
      detail: `replay=${flag(p.replayReadiness)} importExport=${flag(
        p.importExportReadiness
      )}`,
    }),
    Object.freeze({
      id: "recovery-resume",
      title: "Recovery & Resume",
      available: flag(p.recoveryResumeReadiness),
      detail: flag(p.recoveryResumeReadiness) ? "CHECKPOINT" : "NO_CHECKPOINT",
    }),
    Object.freeze({
      id: "completion-archive",
      title: "Completion & Archive",
      available: flag(p.archiveReadiness) || flag(p.finalResultReadiness),
      detail: String(p.lifecycle?.state || "UNKNOWN"),
    }),
    Object.freeze({
      id: "blocking-issues",
      title: "Blocking Issues",
      available: blockingCount === 0,
      detail: `blocking=${blockingCount} warnings=${warningCount}`,
    }),
    Object.freeze({
      id: "recommended-actions",
      title: "Recommended Actions",
      available: allowed > 0,
      detail: `allowed=${allowed} denied=${denied}`,
    }),
  ]);
}
