/**
 * Core-05 — roster / team domain invariant validation.
 * Issues are sorted deterministically by code → path → message.
 */

import {
  COMPETITION_ROSTER_MEMBER_STATUS,
  COMPETITION_ROSTER_STATUS,
} from "../../participants/enums/statuses.js";
import { formatParticipantReferenceToken } from "../contracts/rosterMemberIdentity.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} DomainIssue
 * @property {string} code
 * @property {string} path
 * @property {string} message
 */

/**
 * @param {DomainIssue[]} issues
 * @returns {DomainIssue[]}
 */
export function sortDomainIssues(issues) {
  return [...issues].sort((a, b) => {
    const c = String(a.code).localeCompare(String(b.code));
    if (c !== 0) return c;
    const p = String(a.path).localeCompare(String(b.path));
    if (p !== 0) return p;
    return String(a.message).localeCompare(String(b.message));
  });
}

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @returns {DomainIssue}
 */
export function domainIssue(code, path, message) {
  return { code, path, message };
}

/**
 * @param {unknown} person
 * @returns {string}
 */
export function personTokenOf(person) {
  return formatParticipantReferenceToken(person) || "";
}

/**
 * @param {unknown} roster
 * @returns {unknown[]}
 */
export function listActiveMembers(roster) {
  const members = Array.isArray(roster?.members) ? roster.members : [];
  return members.filter(
    (m) => m && typeof m === "object" && m.status === COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE
  );
}

/**
 * @param {unknown} team
 * @param {unknown} roster
 * @param {{ requireTenantId?: boolean, requireDivisionId?: boolean, requireDivisionCategoryId?: boolean }} [requirements]
 * @returns {DomainIssue[]}
 */
export function validateIsolationContext(team, roster, requirements = {}) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!team || typeof team !== "object") {
    issues.push(
      domainIssue(TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM, "team", "Team is required")
    );
    return sortDomainIssues(issues);
  }
  if (!String(team.competitionId || "").trim()) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
        "competitionId",
        "competitionId is required"
      )
    );
  }
  if (requirements.requireTenantId && !String(team.tenantId || "").trim()) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
        "tenantId",
        "tenantId is required by classification adapter"
      )
    );
  }
  if (requirements.requireDivisionId && !String(team.divisionId || "").trim()) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
        "divisionId",
        "divisionId is required by classification adapter"
      )
    );
  }
  if (
    requirements.requireDivisionCategoryId &&
    !String(team.divisionCategoryId || "").trim()
  ) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
        "divisionCategoryId",
        "divisionCategoryId is required by classification adapter"
      )
    );
  }

  if (roster && typeof roster === "object") {
    if (
      String(roster.competitionId || "") &&
      String(team.competitionId || "") &&
      String(roster.competitionId) !== String(team.competitionId)
    ) {
      issues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.COMPETITION_MISMATCH,
          "roster.competitionId",
          "Roster competitionId does not match team"
        )
      );
    }
    if (
      team.tenantId != null &&
      roster.tenantId != null &&
      String(team.tenantId) !== String(roster.tenantId)
    ) {
      issues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.TENANT_MISMATCH,
          "roster.tenantId",
          "Roster tenantId does not match team"
        )
      );
    }
    if (
      team.divisionId != null &&
      roster.divisionId != null &&
      String(team.divisionId) !== String(roster.divisionId)
    ) {
      issues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.DIVISION_MISMATCH,
          "roster.divisionId",
          "Roster divisionId does not match team"
        )
      );
    }
    if (
      team.divisionCategoryId != null &&
      roster.divisionCategoryId != null &&
      String(team.divisionCategoryId) !== String(roster.divisionCategoryId)
    ) {
      issues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.DIVISION_MISMATCH,
          "roster.divisionCategoryId",
          "Roster divisionCategoryId does not match team"
        )
      );
    }
    if (String(roster.teamId || "") && String(roster.teamId) !== String(team.id)) {
      issues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
          "roster.teamId",
          "Roster teamId does not match team.id"
        )
      );
    }
  }

  return sortDomainIssues(issues);
}

/**
 * @param {unknown} roster
 * @returns {DomainIssue[]}
 */
export function validateUniqueActiveMembers(roster) {
  /** @type {DomainIssue[]} */
  const issues = [];
  const active = listActiveMembers(roster);
  /** @type {Set<string>} */
  const seen = new Set();
  active.forEach((member, index) => {
    const token = personTokenOf(member.person);
    if (!token) {
      issues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
          `members[${index}].person`,
          "Active member requires participant reference"
        )
      );
      return;
    }
    if (seen.has(token)) {
      issues.push(
        domainIssue(
          TEAM_RUNTIME_ERROR_CODE.DUPLICATE_ACTIVE_MEMBER,
          `members[${index}]`,
          `Duplicate active participant ${token}`
        )
      );
    }
    seen.add(token);
  });
  return sortDomainIssues(issues);
}

/**
 * @param {unknown} roster
 * @returns {DomainIssue[]}
 */
export function validateRosterSize(roster) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!roster || typeof roster !== "object") return issues;
  const activeCount = listActiveMembers(roster).length;
  if (typeof roster.minSize === "number" && activeCount < roster.minSize) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_SIZE_VIOLATION,
        "minSize",
        `Active roster size ${activeCount} is below minSize ${roster.minSize}`
      )
    );
  }
  if (typeof roster.maxSize === "number" && activeCount > roster.maxSize) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_SIZE_VIOLATION,
        "maxSize",
        `Active roster size ${activeCount} exceeds maxSize ${roster.maxSize}`
      )
    );
  }
  return sortDomainIssues(issues);
}

/**
 * @param {unknown} team
 * @param {unknown} roster
 * @returns {DomainIssue[]}
 */
export function validateCaptainOnRoster(team, roster) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!team?.captainRef) return issues;
  const captainToken = personTokenOf(team.captainRef);
  if (!captainToken) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.CAPTAIN_NOT_ON_ROSTER,
        "captainRef",
        "Captain reference is invalid"
      )
    );
    return sortDomainIssues(issues);
  }
  const active = listActiveMembers(roster);
  const onRoster = active.some((m) => personTokenOf(m.person) === captainToken);
  if (!onRoster) {
    issues.push(
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.CAPTAIN_NOT_ON_ROSTER,
        "captainRef",
        "Captain must be an active roster member"
      )
    );
  }
  return sortDomainIssues(issues);
}

/**
 * @param {unknown} roster
 * @returns {DomainIssue[]}
 */
export function validateRosterNotLocked(roster) {
  if (roster?.status === COMPETITION_ROSTER_STATUS.ROSTER_LOCKED) {
    return [
      domainIssue(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_LOCKED,
        "status",
        "Roster is locked — membership mutations are blocked"
      ),
    ];
  }
  return [];
}

/**
 * Full roster validation for validateRoster operation.
 * @param {unknown} team
 * @param {unknown} roster
 * @param {{ requireTenantId?: boolean, requireDivisionId?: boolean, requireDivisionCategoryId?: boolean }} [requirements]
 */
export function validateRosterInvariants(team, roster, requirements = {}) {
  const issues = [
    ...validateIsolationContext(team, roster, requirements),
    ...validateUniqueActiveMembers(roster),
    ...validateRosterSize(roster),
    ...validateCaptainOnRoster(team, roster),
  ];
  return sortDomainIssues(issues);
}
