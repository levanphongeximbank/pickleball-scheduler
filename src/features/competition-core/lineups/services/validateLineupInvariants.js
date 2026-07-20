/**
 * CORE-06 Phase 1C — domain invariant validation (fail-closed, structured issues).
 * No locale-dependent normalization. No Math.random / Date.now.
 */

import { COMPETITION_LINEUP_STATUS } from "../../participants/enums/statuses.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { buildLineupIdentityKey, buildLineupSlotId } from "../contracts/lineupIdentity.js";
import {
  participantToken,
  buildRosterMemberTokenSet,
} from "./rosterMembership.js";

/**
 * @typedef {Object} DomainIssue
 * @property {string} code
 * @property {string} path
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {DomainIssue}
 */
export function domainIssue(code, path, message, details = {}) {
  return {
    code: String(code),
    path: String(path || ""),
    message: String(message || ""),
    details: details && typeof details === "object" ? { ...details } : {},
  };
}

/**
 * @param {DomainIssue[]} issues
 * @returns {DomainIssue[]}
 */
/** ASCII lexicographic compare — no locale-dependent collation. */
function asciiCompare(a, b) {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function sortDomainIssues(issues) {
  return [...(issues || [])].sort((a, b) => {
    const c = asciiCompare(a.code, b.code);
    if (c !== 0) return c;
    const p = asciiCompare(a.path, b.path);
    if (p !== 0) return p;
    return asciiCompare(a.message, b.message);
  });
}

/**
 * ASCII-safe trim only — no locale case folding for ids/scopes.
 * @param {unknown} value
 * @returns {string}
 */
export function requireNonEmptyScope(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Required CORE-06 scope: tenantId, competitionId, teamId, rosterId, contextId.
 * rosterVersion must be a positive integer when required.
 *
 * @param {unknown} lineup
 * @param {{ requireRosterVersion?: boolean }} [options]
 * @returns {DomainIssue[]}
 */
export function validateLineupScope(lineup, options = {}) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!lineup || typeof lineup !== "object") {
    issues.push(
      domainIssue(
        LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
        "",
        "Lineup must be an object"
      )
    );
    return issues;
  }

  const required = [
    ["tenantId", lineup.tenantId],
    ["competitionId", lineup.competitionId],
    ["teamId", lineup.teamId],
    ["rosterId", lineup.rosterId],
    ["contextId", lineup.contextId],
  ];

  for (const [path, raw] of required) {
    if (!requireNonEmptyScope(raw)) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_SCOPE_REQUIRED,
          path,
          `${path} is required and must not be inferred`,
          { value: raw ?? null }
        )
      );
    }
  }

  const requireRosterVersion = options.requireRosterVersion !== false;
  if (requireRosterVersion) {
    const version = lineup.rosterVersion;
    if (
      typeof version !== "number" ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_SCOPE_REQUIRED,
          "rosterVersion",
          "rosterVersion must be a positive integer",
          { value: version ?? null }
        )
      );
    }
  }

  return issues;
}

/**
 * @param {unknown} lineup
 * @returns {DomainIssue[]}
 */
export function validateLineupIdentityDeterminism(lineup) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!lineup || typeof lineup !== "object") return issues;

  const expectedKey = buildLineupIdentityKey({
    competitionId: lineup.competitionId,
    contextId: lineup.contextId,
    teamId: lineup.teamId,
  });

  if (
    lineup.identityKey != null &&
    String(lineup.identityKey).trim() !== "" &&
    String(lineup.identityKey) !== expectedKey
  ) {
    issues.push(
      domainIssue(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_MISMATCH,
        "identityKey",
        "Lineup identityKey must match competitionId::LINEUP::contextId::teamId",
        { expected: expectedKey, actual: lineup.identityKey }
      )
    );
  }

  const slots = Array.isArray(lineup.slots) ? lineup.slots : [];
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    if (!slot || typeof slot !== "object") continue;
    const expectedSlotId = buildLineupSlotId({
      lineupIdentityKey: expectedKey,
      disciplineOrSideKey: slot.disciplineOrSideKey,
      index: slot.index,
    });
    if (
      slot.id != null &&
      String(slot.id).trim() !== "" &&
      String(slot.id) !== expectedSlotId
    ) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDENTITY_MISMATCH,
          `slots[${i}].id`,
          "Slot id must be deterministic",
          { expected: expectedSlotId, actual: slot.id }
        )
      );
    }
  }

  return issues;
}

/**
 * @param {unknown} lineup
 * @returns {DomainIssue[]}
 */
export function validateRevisionNumber(lineup) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!lineup || typeof lineup !== "object") return issues;
  const revision = lineup.revision;
  if (
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    issues.push(
      domainIssue(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVISION_INVALID,
        "revision",
        "Revision number must be a positive integer",
        { value: revision ?? null }
      )
    );
  }
  return issues;
}

/**
 * @param {unknown} lineup
 * @param {unknown} [roster]
 * @param {{ allowDuplicateParticipants?: boolean }} [options]
 * @returns {DomainIssue[]}
 */
export function validateLineupMembershipInvariants(lineup, roster, options = {}) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!lineup || typeof lineup !== "object") return issues;

  const slots = Array.isArray(lineup.slots) ? lineup.slots : [];
  const allowDuplicates = options.allowDuplicateParticipants === true;
  let rosterTokens;
  try {
    rosterTokens = buildRosterMemberTokenSet(roster);
  } catch (err) {
    issues.push(
      domainIssue(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_ROSTER_MISMATCH,
        "roster",
        err instanceof Error ? err.message : "Invalid roster",
        {}
      )
    );
    return issues;
  }

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Set<string>} */
  const slotKeys = new Set();

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const path = `slots[${i}]`;
    if (!slot || typeof slot !== "object") {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_REQUIRED,
          path,
          "Lineup slot must be an object"
        )
      );
      continue;
    }

    const discipline = String(slot.disciplineOrSideKey || "").trim();
    const index =
      typeof slot.index === "number" && Number.isInteger(slot.index)
        ? slot.index
        : -1;
    if (!discipline || index < 0) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_REQUIRED,
          path,
          "Each slot requires disciplineOrSideKey and non-negative index"
        )
      );
      continue;
    }

    const slotKey = `${discipline}::${index}`;
    if (slotKeys.has(slotKey)) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_SLOT_DUPLICATE,
          path,
          "Duplicate lineup slot key",
          { slotKey }
        )
      );
    }
    slotKeys.add(slotKey);

    const token = participantToken(slot.person);
    if (!token) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
          `${path}.person`,
          "Slot person requires kind and id"
        )
      );
      continue;
    }

    if (!allowDuplicates && seen.has(token)) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_DUPLICATE_PARTICIPANT,
          path,
          "Duplicate participant in lineup slots",
          { participant: token }
        )
      );
    }
    seen.add(token);

    if (rosterTokens && !rosterTokens.has(token)) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_PARTICIPANT_NOT_IN_ROSTER,
          path,
          "Lineup participant is not in supplied roster snapshot",
          { participant: token }
        )
      );
    }
  }

  return issues;
}

/**
 * Published / superseded / voided revision rows must not be mutated in place.
 * Callers pass the previous frozen revision and a candidate mutation.
 *
 * @param {unknown} previousRevision
 * @param {unknown} candidateRevision
 * @returns {DomainIssue[]}
 */
export function validateRevisionImmutability(previousRevision, candidateRevision) {
  /** @type {DomainIssue[]} */
  const issues = [];
  if (!previousRevision || typeof previousRevision !== "object") return issues;

  const status = String(previousRevision.status || "").trim().toUpperCase();
  const protectedStatuses = new Set([
    COMPETITION_LINEUP_STATUS.PUBLISHED,
    COMPETITION_LINEUP_STATUS.SUPERSEDED,
    COMPETITION_LINEUP_STATUS.LOCKED,
    COMPETITION_LINEUP_STATUS.VOIDED,
  ]);

  if (!protectedStatuses.has(status)) return issues;
  if (!candidateRevision || typeof candidateRevision !== "object") return issues;

  const keys = [
    "id",
    "lineupId",
    "revision",
    "status",
    "previousRevisionId",
    "submittedAt",
    "submittedBy",
    "lockedAt",
    "publishedAt",
    "reason",
    "slots",
  ];

  for (const key of keys) {
    const prev = JSON.stringify(previousRevision[key] ?? null);
    const next = JSON.stringify(candidateRevision[key] ?? null);
    if (prev !== next) {
      issues.push(
        domainIssue(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_REVISION_IMMUTABLE,
          key,
          "Immutable revision cannot be mutated in place",
          { status }
        )
      );
    }
  }

  return issues;
}

/**
 * @param {unknown} lineup
 * @param {unknown} [roster]
 * @param {{ allowDuplicateParticipants?: boolean, requireRosterVersion?: boolean }} [options]
 * @returns {DomainIssue[]}
 */
export function validateLineupInvariants(lineup, roster, options = {}) {
  return sortDomainIssues([
    ...validateLineupScope(lineup, options),
    ...validateRevisionNumber(lineup),
    ...validateLineupIdentityDeterminism(lineup),
    ...validateLineupMembershipInvariants(lineup, roster, options),
  ]);
}
