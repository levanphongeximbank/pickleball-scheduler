/**
 * Explicit Customer / Player analytical fact contracts (I&A-08).
 * Facts are immutable, module-neutral, and carry explicit tenant + entity
 * identity + provenance. No mutation methods, callbacks, DB table identities,
 * React state, or business-rule recalculation (no CRM conversion, revenue,
 * rating, ranking, performance, or eligibility inference). No PII.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { rejectForbiddenPiiFields } from "./privacy.js";

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function requireTenant(input, field) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
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
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
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
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TIMESTAMP_INVALID,
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
  if (input.canonicalSourceRef !== undefined) {
    if (!isNonEmptyString(input.canonicalSourceRef)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
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
 * @param {Record<string, unknown>} base
 * @param {unknown} input
 * @param {string[]} keys
 * @returns {import("../contracts/result.js").Result}
 */
function attachOptionalStrings(base, input, keys) {
  for (const key of keys) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
            `${key} must be a non-empty string when provided`,
            key
          )
        );
      }
      base[key] = String(input[key]).trim();
    }
  }
  return ok(base);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function requireNonEmptyString(input, key, field) {
  if (!isNonEmptyString(input[key])) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
        `${key} is required`,
        field
      )
    );
  }
  return ok(String(input[key]).trim());
}

/**
 * Explicit customer analytical fact — descriptive lifecycle/status only.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerAnalyticalFact(input) {
  const pii = rejectForbiddenPiiFields(input, "CustomerAnalyticalFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "CustomerAnalyticalFact");
  if (!identity.ok) return identity;
  const customerId = requireNonEmptyString(
    input,
    "customerId",
    "customerId"
  );
  if (!customerId.ok) return customerId;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    customerId: customerId.value,
  };
  const strings = attachOptionalStrings(fact, input, [
    "status",
    "lifecycleStatus",
  ]);
  if (!strings.ok) return strings;
  if (input.createdAt !== undefined) {
    const ts = optionalIso(input.createdAt, "createdAt");
    if (!ts.ok) return ts;
    fact.createdAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit customer lifecycle observation — never recalculated here.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerLifecycleFact(input) {
  const pii = rejectForbiddenPiiFields(input, "CustomerLifecycleFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "CustomerLifecycleFact");
  if (!identity.ok) return identity;
  const customerId = requireNonEmptyString(
    input,
    "customerId",
    "customerId"
  );
  if (!customerId.ok) return customerId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    customerId: customerId.value,
    status: status.value,
  };
  const strings = attachOptionalStrings(fact, input, ["lifecycleStatus"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit customer profile-completeness signal. Never computed from raw
 * PII — the source system must supply either an explicit boolean or an
 * explicit completeness status string.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerProfileCompletenessFact(input) {
  const pii = rejectForbiddenPiiFields(
    input,
    "CustomerProfileCompletenessFact"
  );
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "CustomerProfileCompletenessFact");
  if (!identity.ok) return identity;
  const customerId = requireNonEmptyString(
    input,
    "customerId",
    "customerId"
  );
  if (!customerId.ok) return customerId;

  const hasProfileComplete = input.profileComplete !== undefined;
  const hasCompletenessStatus = input.completenessStatus !== undefined;
  if (!hasProfileComplete && !hasCompletenessStatus) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
        "Either profileComplete or completenessStatus is required",
        "profileComplete"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    customerId: customerId.value,
  };

  if (hasProfileComplete) {
    if (typeof input.profileComplete !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
          "profileComplete must be a boolean when provided",
          "profileComplete"
        )
      );
    }
    fact.profileComplete = input.profileComplete;
  }

  if (hasCompletenessStatus) {
    if (!isNonEmptyString(input.completenessStatus)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
          "completenessStatus must be a non-empty string when provided",
          "completenessStatus"
        )
      );
    }
    fact.completenessStatus = String(input.completenessStatus).trim();
  }

  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit customer activity fact — descriptive only.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerActivityFact(input) {
  const pii = rejectForbiddenPiiFields(input, "CustomerActivityFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "CustomerActivityFact");
  if (!identity.ok) return identity;
  const customerId = requireNonEmptyString(
    input,
    "customerId",
    "customerId"
  );
  if (!customerId.ok) return customerId;
  const activityId = requireNonEmptyString(
    input,
    "activityId",
    "activityId"
  );
  if (!activityId.ok) return activityId;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    customerId: customerId.value,
    activityId: activityId.value,
  };
  const strings = attachOptionalStrings(fact, input, [
    "activityKind",
    "category",
  ]);
  if (!strings.ok) return strings;
  if (input.occurredAt !== undefined) {
    const ts = optionalIso(input.occurredAt, "occurredAt");
    if (!ts.ok) return ts;
    fact.occurredAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit player analytical fact — descriptive lifecycle/status only.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPlayerAnalyticalFact(input) {
  const pii = rejectForbiddenPiiFields(input, "PlayerAnalyticalFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "PlayerAnalyticalFact");
  if (!identity.ok) return identity;
  const playerId = requireNonEmptyString(input, "playerId", "playerId");
  if (!playerId.ok) return playerId;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    playerId: playerId.value,
  };
  const strings = attachOptionalStrings(fact, input, [
    "status",
    "lifecycleStatus",
  ]);
  if (!strings.ok) return strings;
  if (input.createdAt !== undefined) {
    const ts = optionalIso(input.createdAt, "createdAt");
    if (!ts.ok) return ts;
    fact.createdAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit player lifecycle observation — never recalculated here.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPlayerLifecycleFact(input) {
  const pii = rejectForbiddenPiiFields(input, "PlayerLifecycleFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "PlayerLifecycleFact");
  if (!identity.ok) return identity;
  const playerId = requireNonEmptyString(input, "playerId", "playerId");
  if (!playerId.ok) return playerId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    playerId: playerId.value,
    status: status.value,
  };
  const strings = attachOptionalStrings(fact, input, ["lifecycleStatus"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit player profile-completeness signal — see
 * createCustomerProfileCompletenessFact for the identical policy.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPlayerProfileCompletenessFact(input) {
  const pii = rejectForbiddenPiiFields(
    input,
    "PlayerProfileCompletenessFact"
  );
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "PlayerProfileCompletenessFact");
  if (!identity.ok) return identity;
  const playerId = requireNonEmptyString(input, "playerId", "playerId");
  if (!playerId.ok) return playerId;

  const hasProfileComplete = input.profileComplete !== undefined;
  const hasCompletenessStatus = input.completenessStatus !== undefined;
  if (!hasProfileComplete && !hasCompletenessStatus) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
        "Either profileComplete or completenessStatus is required",
        "profileComplete"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    playerId: playerId.value,
  };

  if (hasProfileComplete) {
    if (typeof input.profileComplete !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
          "profileComplete must be a boolean when provided",
          "profileComplete"
        )
      );
    }
    fact.profileComplete = input.profileComplete;
  }

  if (hasCompletenessStatus) {
    if (!isNonEmptyString(input.completenessStatus)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
          "completenessStatus must be a non-empty string when provided",
          "completenessStatus"
        )
      );
    }
    fact.completenessStatus = String(input.completenessStatus).trim();
  }

  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit player activity fact — descriptive only.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPlayerActivityFact(input) {
  const pii = rejectForbiddenPiiFields(input, "PlayerActivityFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "PlayerActivityFact");
  if (!identity.ok) return identity;
  const playerId = requireNonEmptyString(input, "playerId", "playerId");
  if (!playerId.ok) return playerId;
  const activityId = requireNonEmptyString(
    input,
    "activityId",
    "activityId"
  );
  if (!activityId.ok) return activityId;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    playerId: playerId.value,
    activityId: activityId.value,
  };
  const strings = attachOptionalStrings(fact, input, [
    "activityKind",
    "category",
  ]);
  if (!strings.ok) return strings;
  if (input.occurredAt !== undefined) {
    const ts = optionalIso(input.occurredAt, "occurredAt");
    if (!ts.ok) return ts;
    fact.occurredAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit customer↔player link fact. Links must be sourced explicitly —
 * this module never infers a link from matching names/emails/phones.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerPlayerLinkFact(input) {
  const pii = rejectForbiddenPiiFields(input, "CustomerPlayerLinkFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "CustomerPlayerLinkFact");
  if (!identity.ok) return identity;
  const customerId = requireNonEmptyString(
    input,
    "customerId",
    "customerId"
  );
  if (!customerId.ok) return customerId;
  const playerId = requireNonEmptyString(input, "playerId", "playerId");
  if (!playerId.ok) return playerId;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    customerId: customerId.value,
    playerId: playerId.value,
  };
  const strings = attachOptionalStrings(fact, input, [
    "linkId",
    "linkStatus",
    "relationRef",
  ]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit player competition-participation fact — descriptive only, no
 * eligibility or performance inference.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPlayerCompetitionParticipationFact(input) {
  const pii = rejectForbiddenPiiFields(
    input,
    "PlayerCompetitionParticipationFact"
  );
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "PlayerCompetitionParticipationFact");
  if (!identity.ok) return identity;
  const playerId = requireNonEmptyString(input, "playerId", "playerId");
  if (!playerId.ok) return playerId;
  const participationId = requireNonEmptyString(
    input,
    "participationId",
    "participationId"
  );
  if (!participationId.ok) return participationId;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    playerId: playerId.value,
    participationId: participationId.value,
  };
  const strings = attachOptionalStrings(fact, input, [
    "competitionId",
    "status",
  ]);
  if (!strings.ok) return strings;
  for (const key of ["startedAt", "endedAt"]) {
    if (input[key] !== undefined) {
      const ts = optionalIso(input[key], key);
      if (!ts.ok) return ts;
      fact[key] = ts.value;
    }
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit player club-membership fact — descriptive only, no ranking
 * inference.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPlayerClubMembershipFact(input) {
  const pii = rejectForbiddenPiiFields(input, "PlayerClubMembershipFact");
  if (!pii.ok) return pii;
  const identity = requireTenant(input, "PlayerClubMembershipFact");
  if (!identity.ok) return identity;
  const playerId = requireNonEmptyString(input, "playerId", "playerId");
  if (!playerId.ok) return playerId;
  const membershipId = requireNonEmptyString(
    input,
    "membershipId",
    "membershipId"
  );
  if (!membershipId.ok) return membershipId;
  const clubId = requireNonEmptyString(input, "clubId", "clubId");
  if (!clubId.ok) return clubId;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    playerId: playerId.value,
    membershipId: membershipId.value,
    clubId: clubId.value,
  };
  const strings = attachOptionalStrings(fact, input, ["status"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}
