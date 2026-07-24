/**
 * Publication + privacy gates for public reads — fail-closed.
 */

import { PUBLICATION_OPS_STATE } from "../../constants.js";
import {
  PUBLIC_BLOCKER_CODE,
  PUBLIC_ERROR_CODE,
  PUBLICATION_VISIBILITY_DEFAULTS,
} from "../constants.js";
import { failPublic } from "../errors.js";
import { isNonEmptyString } from "../fingerprint.js";

/**
 * @param {object|null|undefined} visibility
 * @param {string} publicationState
 * @returns {Readonly<{
 *   competitionPublished: boolean,
 *   schedulePublished: boolean,
 *   participantsVisible: boolean,
 *   resultsPublished: boolean,
 *   bracketPublished: boolean,
 *   finalResultsPublished: boolean,
 *   archiveVisible: boolean,
 * }>}
 */
export function resolvePublicVisibility(visibility, publicationState) {
  const state = String(publicationState || PUBLICATION_OPS_STATE.NONE).trim();
  const defaults =
    PUBLICATION_VISIBILITY_DEFAULTS[state] ||
    PUBLICATION_VISIBILITY_DEFAULTS.NONE;
  const overrides =
    visibility && typeof visibility === "object" ? visibility : {};

  return Object.freeze({
    competitionPublished:
      overrides.competitionPublished != null
        ? overrides.competitionPublished === true
        : defaults.competitionPublished === true,
    schedulePublished:
      overrides.schedulePublished != null
        ? overrides.schedulePublished === true
        : defaults.schedulePublished === true,
    participantsVisible:
      overrides.participantsVisible != null
        ? overrides.participantsVisible === true
        : defaults.participantsVisible === true,
    resultsPublished:
      overrides.resultsPublished != null
        ? overrides.resultsPublished === true
        : defaults.resultsPublished === true,
    bracketPublished:
      overrides.bracketPublished != null
        ? overrides.bracketPublished === true
        : defaults.bracketPublished === true,
    finalResultsPublished:
      overrides.finalResultsPublished != null
        ? overrides.finalResultsPublished === true
        : defaults.finalResultsPublished === true,
    archiveVisible:
      overrides.archiveVisible != null
        ? overrides.archiveVisible === true
        : defaults.archiveVisible === true,
  });
}

/**
 * @param {object} query
 * @returns {{ tenantId: string, competitionId: string }}
 */
export function requirePublicScope(query) {
  const tenantId = String(query?.tenantId || "").trim();
  const competitionId = String(query?.competitionId || "").trim();
  if (!isNonEmptyString(tenantId)) {
    failPublic(
      PUBLIC_ERROR_CODE.MISSING_TENANT,
      "tenantId is required for public competition reads",
      { blocker: PUBLIC_BLOCKER_CODE.MISSING_TENANT }
    );
  }
  if (!isNonEmptyString(competitionId)) {
    failPublic(
      PUBLIC_ERROR_CODE.MISSING_COMPETITION,
      "competitionId is required for public competition reads",
      { blocker: PUBLIC_BLOCKER_CODE.MISSING_COMPETITION }
    );
  }
  return { tenantId, competitionId };
}

/**
 * @param {object} record
 * @param {string} tenantId
 * @param {string} competitionId
 */
export function assertPublicTenantScope(record, tenantId, competitionId) {
  if (!record || typeof record !== "object") {
    failPublic(
      PUBLIC_ERROR_CODE.RECORD_NOT_FOUND,
      "Published competition record not found",
      { blocker: PUBLIC_BLOCKER_CODE.RECORD_NOT_FOUND, tenantId, competitionId }
    );
  }
  const recordTenant = String(record.tenantId || "").trim();
  const recordCompetition = String(record.competitionId || "").trim();
  if (recordTenant && recordTenant !== tenantId) {
    failPublic(
      PUBLIC_ERROR_CODE.CROSS_TENANT_REJECTED,
      "Cross-tenant public competition read rejected",
      {
        blocker: PUBLIC_BLOCKER_CODE.CROSS_TENANT,
        tenantId,
        recordTenant,
        competitionId,
      }
    );
  }
  if (recordCompetition && recordCompetition !== competitionId) {
    failPublic(
      PUBLIC_ERROR_CODE.CROSS_TENANT_REJECTED,
      "Competition identity mismatch for public read",
      {
        blocker: PUBLIC_BLOCKER_CODE.CROSS_TENANT,
        competitionId,
        recordCompetition,
        tenantId,
      }
    );
  }
}

/**
 * @param {ReturnType<typeof resolvePublicVisibility>} visibility
 */
export function assertCompetitionPublished(visibility) {
  if (!visibility.competitionPublished) {
    failPublic(
      PUBLIC_ERROR_CODE.COMPETITION_UNPUBLISHED,
      "Competition is not published for public experience",
      { blocker: PUBLIC_BLOCKER_CODE.COMPETITION_UNPUBLISHED }
    );
  }
}

/**
 * @param {ReturnType<typeof resolvePublicVisibility>} visibility
 */
export function assertSchedulePublished(visibility) {
  if (!visibility.schedulePublished) {
    failPublic(
      PUBLIC_ERROR_CODE.SCHEDULE_UNPUBLISHED,
      "Schedule is not published for public experience",
      { blocker: PUBLIC_BLOCKER_CODE.SCHEDULE_UNPUBLISHED }
    );
  }
}

/**
 * @param {ReturnType<typeof resolvePublicVisibility>} visibility
 */
export function assertParticipantsVisible(visibility) {
  if (!visibility.participantsVisible) {
    failPublic(
      PUBLIC_ERROR_CODE.PARTICIPANTS_HIDDEN,
      "Participants are not visible on the public experience",
      { blocker: PUBLIC_BLOCKER_CODE.PARTICIPANTS_HIDDEN }
    );
  }
}

/**
 * @param {ReturnType<typeof resolvePublicVisibility>} visibility
 */
export function assertResultsPublished(visibility) {
  if (!visibility.resultsPublished) {
    failPublic(
      PUBLIC_ERROR_CODE.RESULTS_UNPUBLISHED,
      "Results are not published for public experience",
      { blocker: PUBLIC_BLOCKER_CODE.RESULTS_UNPUBLISHED }
    );
  }
}

/**
 * @param {ReturnType<typeof resolvePublicVisibility>} visibility
 */
export function assertBracketPublished(visibility) {
  if (!visibility.bracketPublished) {
    failPublic(
      PUBLIC_ERROR_CODE.BRACKET_UNPUBLISHED,
      "Bracket is not published for public experience",
      { blocker: PUBLIC_BLOCKER_CODE.BRACKET_UNPUBLISHED }
    );
  }
}

/**
 * @param {ReturnType<typeof resolvePublicVisibility>} visibility
 */
export function assertFinalResultsPublished(visibility) {
  if (!visibility.finalResultsPublished) {
    failPublic(
      PUBLIC_ERROR_CODE.FINAL_RESULTS_UNPUBLISHED,
      "Final results are not published for public experience",
      { blocker: PUBLIC_BLOCKER_CODE.FINAL_RESULTS_UNPUBLISHED }
    );
  }
}

/**
 * @param {ReturnType<typeof resolvePublicVisibility>} visibility
 */
export function assertArchiveVisible(visibility) {
  if (!visibility.archiveVisible) {
    failPublic(
      PUBLIC_ERROR_CODE.ARCHIVE_HIDDEN,
      "Archive state is not visible on the public experience",
      { blocker: PUBLIC_BLOCKER_CODE.ARCHIVE_HIDDEN }
    );
  }
}
