import { REGISTRATION_STATUS, isRegistrationStatus } from "../enums/registrationStatus.js";
import { COMPETITION_FORMAT_HINT, isCompetitionFormatHint } from "../enums/competitionFormatHint.js";
import {
  createAuditMetadata,
  isNonEmptyString,
  REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
} from "./shared.js";
import {
  assertRegistrationTarget,
  buildRegistrationTargetStableIdentity,
  createRegistrationTarget,
} from "./registrationTarget.js";
import { createRegistrationApplicant } from "./registrationApplicant.js";

/**
 * CompetitionRegistration — Core-03 application lifecycle aggregate.
 *
 * @typedef {Object} CompetitionRegistration
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} registrationRequestId
 * @property {string|null} idempotencyKey
 * @property {string} competitionId
 * @property {string|null} divisionId
 * @property {string|null} divisionCategoryId
 * @property {string|null} categoryId
 * @property {string} status
 * @property {import('./registrationTarget.js').RegistrationTarget} target
 * @property {import('./registrationApplicant.js').RegistrationApplicant|null} [applicant]
 * @property {string} [formatHint]
 * @property {string|null} [entryId] — Core-02 Entry after conversion handoff
 * @property {string|null} [eligibilityDecisionId]
 * @property {number|null} [waitlistPosition]
 * @property {string|null} [submittedAt]
 * @property {string|null} [decidedAt]
 * @property {string|null} [decidedBy]
 * @property {string|null} [identityKey]
 * @property {Record<string, unknown>|null} [metadata]
 * @property {import('./shared.js').RegistrationAuditMetadata} [audit]
 */

/**
 * Deterministic identity key for duplicate prevention (not random).
 * competitionId::divisionId|NONE::targetStableIdentity
 *
 * @param {{
 *   competitionId: string,
 *   divisionId?: string|null,
 *   target: import('./registrationTarget.js').RegistrationTarget,
 * }} parts
 * @returns {string}
 */
export function buildCompetitionRegistrationIdentityKey(parts) {
  const competitionId = String(parts.competitionId || "").trim();
  if (!isNonEmptyString(competitionId)) {
    throw new TypeError("identityKey requires competitionId");
  }
  const divisionId =
    parts.divisionId != null && String(parts.divisionId).trim() !== ""
      ? String(parts.divisionId).trim()
      : "NONE";
  const stable = buildRegistrationTargetStableIdentity(parts.target);
  return `${competitionId}::${divisionId}::${stable}`;
}

/**
 * @param {Partial<CompetitionRegistration>} partial
 * @returns {CompetitionRegistration}
 */
export function createCompetitionRegistration(partial = {}) {
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("CompetitionRegistration requires competitionId");
  }
  if (!isNonEmptyString(partial.registrationRequestId)) {
    throw new TypeError("CompetitionRegistration requires registrationRequestId");
  }
  if (!partial.target) {
    throw new TypeError("CompetitionRegistration requires target");
  }

  const target = createRegistrationTarget(partial.target);
  const status = isRegistrationStatus(partial.status)
    ? partial.status
    : REGISTRATION_STATUS.DRAFT;

  const divisionId =
    partial.divisionId != null && String(partial.divisionId).trim() !== ""
      ? String(partial.divisionId).trim()
      : null;

  const identityKey =
    partial.identityKey != null && String(partial.identityKey).trim() !== ""
      ? String(partial.identityKey).trim()
      : buildCompetitionRegistrationIdentityKey({
          competitionId: partial.competitionId,
          divisionId,
          target,
        });

  const formatHint = isCompetitionFormatHint(partial.formatHint)
    ? partial.formatHint
    : COMPETITION_FORMAT_HINT.UNSPECIFIED;

  return {
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    id: String(partial.id || ""),
    registrationRequestId: String(partial.registrationRequestId).trim(),
    idempotencyKey:
      partial.idempotencyKey != null && String(partial.idempotencyKey).trim() !== ""
        ? String(partial.idempotencyKey).trim()
        : null,
    competitionId: String(partial.competitionId).trim(),
    divisionId,
    divisionCategoryId:
      partial.divisionCategoryId != null && String(partial.divisionCategoryId).trim() !== ""
        ? String(partial.divisionCategoryId).trim()
        : null,
    categoryId:
      partial.categoryId != null && String(partial.categoryId).trim() !== ""
        ? String(partial.categoryId).trim()
        : null,
    status,
    target: assertRegistrationTarget(target),
    applicant: partial.applicant ? createRegistrationApplicant(partial.applicant) : null,
    formatHint,
    entryId:
      partial.entryId != null && String(partial.entryId).trim() !== ""
        ? String(partial.entryId).trim()
        : null,
    eligibilityDecisionId:
      partial.eligibilityDecisionId != null &&
      String(partial.eligibilityDecisionId).trim() !== ""
        ? String(partial.eligibilityDecisionId).trim()
        : null,
    waitlistPosition:
      typeof partial.waitlistPosition === "number" && Number.isFinite(partial.waitlistPosition)
        ? partial.waitlistPosition
        : null,
    submittedAt:
      partial.submittedAt != null && String(partial.submittedAt).trim() !== ""
        ? String(partial.submittedAt).trim()
        : null,
    decidedAt:
      partial.decidedAt != null && String(partial.decidedAt).trim() !== ""
        ? String(partial.decidedAt).trim()
        : null,
    decidedBy:
      partial.decidedBy != null && String(partial.decidedBy).trim() !== ""
        ? String(partial.decidedBy).trim()
        : null,
    identityKey,
    metadata:
      partial.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : null,
    audit: createAuditMetadata(partial.audit),
  };
}
