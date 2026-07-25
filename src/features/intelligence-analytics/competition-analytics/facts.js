/**
 * Explicit Competition analytical fact contracts (I&A-06).
 * Facts are immutable, module-neutral, Competition-specific, and carry
 * explicit tenant / competition identity + provenance. No mutation methods,
 * callbacks, DB table identities, or React state.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function requireIdentity(input, field) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        `${field} must be a plain object`,
        field
      )
    );
  }
  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        `${field}.tenantId is required`,
        `${field}.tenantId`
      )
    );
  }
  if (!isNonEmptyString(input.competitionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_ID_REQUIRED,
        `${field}.competitionId is required`,
        `${field}.competitionId`
      )
    );
  }
  return ok(null);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalProvenance(input, field) {
  if (input === undefined) return ok(undefined);
  const result = createAnalyticsMetricProvenance(input);
  if (!result.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        result.error.message,
        `${field}.provenance`,
        result.error.details
      )
    );
  }
  return ok(result.value);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalIso(input, field) {
  if (input === undefined) return ok(undefined);
  if (!isValidIsoTimestamp(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_TIMESTAMP_INVALID,
        `${field} must be a valid ISO timestamp`,
        field
      )
    );
  }
  return ok(String(input).trim());
}

/**
 * @param {Record<string, unknown>} base
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function attachCommonOptional(base, input) {
  if (input.competitionVersion !== undefined) {
    if (!isNonEmptyString(input.competitionVersion)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          "competitionVersion must be a non-empty string when provided",
          "competitionVersion"
        )
      );
    }
    base.competitionVersion = String(input.competitionVersion).trim();
  }
  if (input.canonicalSourceRef !== undefined) {
    if (!isNonEmptyString(input.canonicalSourceRef)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          "canonicalSourceRef must be a non-empty string when provided",
          "canonicalSourceRef"
        )
      );
    }
    base.canonicalSourceRef = String(input.canonicalSourceRef).trim();
  }
  if (input.sourceTimestamp !== undefined) {
    const ts = optionalIso(input.sourceTimestamp, "sourceTimestamp");
    if (!ts.ok) return ts;
    base.sourceTimestamp = ts.value;
  }
  const provenance = optionalProvenance(input.provenance, "fact");
  if (!provenance.ok) return provenance;
  if (provenance.value !== undefined) base.provenance = provenance.value;
  return ok(base);
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionParticipantFact(input) {
  const identity = requireIdentity(input, "CompetitionParticipantFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.participantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "participantId is required",
        "participantId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    participantId: String(input.participantId).trim(),
  };
  if (input.status !== undefined) {
    if (!isNonEmptyString(input.status)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          "status must be a non-empty string when provided",
          "status"
        )
      );
    }
    fact.status = String(input.status).trim();
  }
  if (input.divisionId !== undefined && isNonEmptyString(input.divisionId)) {
    fact.divisionId = String(input.divisionId).trim();
  }
  if (input.categoryId !== undefined && isNonEmptyString(input.categoryId)) {
    fact.categoryId = String(input.categoryId).trim();
  }
  if (input.entryKind !== undefined && isNonEmptyString(input.entryKind)) {
    fact.entryKind = String(input.entryKind).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionEntryFact(input) {
  const identity = requireIdentity(input, "CompetitionEntryFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.entryId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "entryId is required",
        "entryId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    entryId: String(input.entryId).trim(),
  };
  if (input.status !== undefined && isNonEmptyString(input.status)) {
    fact.status = String(input.status).trim();
  }
  if (input.participantId !== undefined && isNonEmptyString(input.participantId)) {
    fact.participantId = String(input.participantId).trim();
  }
  if (input.divisionId !== undefined && isNonEmptyString(input.divisionId)) {
    fact.divisionId = String(input.divisionId).trim();
  }
  if (input.categoryId !== undefined && isNonEmptyString(input.categoryId)) {
    fact.categoryId = String(input.categoryId).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionRegistrationFact(input) {
  const identity = requireIdentity(input, "CompetitionRegistrationFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.registrationId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "registrationId is required",
        "registrationId"
      )
    );
  }
  if (!isNonEmptyString(input.status)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "registration status is required",
        "status"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    registrationId: String(input.registrationId).trim(),
    status: String(input.status).trim(),
  };
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionDivisionFact(input) {
  const identity = requireIdentity(input, "CompetitionDivisionFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.divisionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "divisionId is required",
        "divisionId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    divisionId: String(input.divisionId).trim(),
  };
  if (input.label !== undefined && isNonEmptyString(input.label)) {
    fact.label = String(input.label).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionCategoryFact(input) {
  const identity = requireIdentity(input, "CompetitionCategoryFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.categoryId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "categoryId is required",
        "categoryId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    categoryId: String(input.categoryId).trim(),
  };
  if (input.divisionId !== undefined && isNonEmptyString(input.divisionId)) {
    fact.divisionId = String(input.divisionId).trim();
  }
  if (input.label !== undefined && isNonEmptyString(input.label)) {
    fact.label = String(input.label).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionTeamFact(input) {
  const identity = requireIdentity(input, "CompetitionTeamFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.teamId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "teamId is required",
        "teamId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    teamId: String(input.teamId).trim(),
  };
  if (input.status !== undefined && isNonEmptyString(input.status)) {
    fact.status = String(input.status).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionRosterFact(input) {
  const identity = requireIdentity(input, "CompetitionRosterFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.rosterId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "rosterId is required",
        "rosterId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    rosterId: String(input.rosterId).trim(),
  };
  if (input.teamId !== undefined && isNonEmptyString(input.teamId)) {
    fact.teamId = String(input.teamId).trim();
  }
  if (input.status !== undefined && isNonEmptyString(input.status)) {
    fact.status = String(input.status).trim();
  }
  if (input.memberCount !== undefined) {
    if (
      typeof input.memberCount !== "number" ||
      !Number.isFinite(input.memberCount) ||
      input.memberCount < 0
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          "memberCount must be a finite non-negative number",
          "memberCount"
        )
      );
    }
    fact.memberCount = input.memberCount;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionMatchFact(input) {
  const identity = requireIdentity(input, "CompetitionMatchFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.matchId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "matchId is required",
        "matchId"
      )
    );
  }
  if (!isNonEmptyString(input.lifecycleStatus)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "lifecycleStatus is required",
        "lifecycleStatus"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    matchId: String(input.matchId).trim(),
    lifecycleStatus: String(input.lifecycleStatus).trim(),
  };
  if (input.divisionId !== undefined && isNonEmptyString(input.divisionId)) {
    fact.divisionId = String(input.divisionId).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionScheduleFact(input) {
  const identity = requireIdentity(input, "CompetitionScheduleFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.matchId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "matchId is required",
        "matchId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    matchId: String(input.matchId).trim(),
  };
  for (const key of ["scheduledStartAt", "actualStartAt", "actualEndAt"]) {
    if (input[key] !== undefined) {
      const ts = optionalIso(input[key], key);
      if (!ts.ok) return ts;
      fact[key] = ts.value;
    }
  }
  if (input.timezone !== undefined && isNonEmptyString(input.timezone)) {
    fact.timezone = String(input.timezone).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Assignment descriptive fact — only explicit court/referee assignment refs.
 * Does not infer coverage or optimality.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAssignmentFact(input) {
  const identity = requireIdentity(input, "CompetitionAssignmentFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.matchId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "matchId is required",
        "matchId"
      )
    );
  }
  const hasCourt = isNonEmptyString(input.courtId);
  const hasReferee = isNonEmptyString(input.refereeId);
  if (!hasCourt && !hasReferee) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "Assignment fact requires explicit courtId and/or refereeId",
        "assignment"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    matchId: String(input.matchId).trim(),
  };
  if (hasCourt) fact.courtId = String(input.courtId).trim();
  if (hasReferee) fact.refereeId = String(input.refereeId).trim();
  if (input.assignmentKind !== undefined && isNonEmptyString(input.assignmentKind)) {
    fact.assignmentKind = String(input.assignmentKind).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Result acceptance fact — opaque acceptance status from canonical source.
 * Does not validate scores or determine winners.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionResultFact(input) {
  const identity = requireIdentity(input, "CompetitionResultFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.matchId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "matchId is required",
        "matchId"
      )
    );
  }
  if (!isNonEmptyString(input.acceptanceStatus)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "acceptanceStatus is required",
        "acceptanceStatus"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    matchId: String(input.matchId).trim(),
    acceptanceStatus: String(input.acceptanceStatus).trim(),
  };
  if (input.resultType !== undefined && isNonEmptyString(input.resultType)) {
    fact.resultType = String(input.resultType).trim();
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Opaque standings snapshot reference — no recalculation.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionStandingsSnapshotFact(input) {
  const identity = requireIdentity(input, "CompetitionStandingsSnapshotFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.snapshotId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "snapshotId is required",
        "snapshotId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    snapshotId: String(input.snapshotId).trim(),
  };
  if (input.snapshotVersion !== undefined && isNonEmptyString(input.snapshotVersion)) {
    fact.snapshotVersion = String(input.snapshotVersion).trim();
  }
  if (input.rowCount !== undefined) {
    if (
      typeof input.rowCount !== "number" ||
      !Number.isFinite(input.rowCount) ||
      input.rowCount < 0
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          "rowCount must be a finite non-negative number",
          "rowCount"
        )
      );
    }
    fact.rowCount = input.rowCount;
  }
  // Opaque ranks — descriptive distribution only; never re-sort/recalculate.
  if (input.opaqueRanks !== undefined) {
    if (!Array.isArray(input.opaqueRanks)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          "opaqueRanks must be an array when provided",
          "opaqueRanks"
        )
      );
    }
    fact.opaqueRanks = Object.freeze(
      input.opaqueRanks.map((rank) =>
        rank === null || rank === undefined ? null : clonePlain(rank)
      )
    );
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Opaque ranking snapshot reference — no ranking/rating calculation.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionRankingSnapshotFact(input) {
  const identity = requireIdentity(input, "CompetitionRankingSnapshotFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.snapshotId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
        "snapshotId is required",
        "snapshotId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    competitionId: String(input.competitionId).trim(),
    snapshotId: String(input.snapshotId).trim(),
  };
  if (input.snapshotVersion !== undefined && isNonEmptyString(input.snapshotVersion)) {
    fact.snapshotVersion = String(input.snapshotVersion).trim();
  }
  if (input.entryCount !== undefined) {
    if (
      typeof input.entryCount !== "number" ||
      !Number.isFinite(input.entryCount) ||
      input.entryCount < 0
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          "entryCount must be a finite non-negative number",
          "entryCount"
        )
      );
    }
    fact.entryCount = input.entryCount;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}
