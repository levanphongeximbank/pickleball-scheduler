/**
 * Deterministic Customer / Player Analytics projections (I&A-08).
 * Descriptive counts/rates only — no CRM conversion, revenue, rating,
 * ranking, performance, or eligibility recalculation. Customer identity is
 * never deduplicated and customer↔player links are never inferred.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import {
  clonePlain,
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS,
  CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION,
  ENTITY_LIFECYCLE_BUCKET,
  PROFILE_COMPLETENESS_STATUS,
} from "./enums.js";

/**
 * Normalize explicit lifecycle/status to analytical bucket (label mapping
 * only). "merged" is aliased to ARCHIVED — it is never inferred, only
 * mapped from an explicit source-provided status label.
 * @param {string} status
 * @returns {string}
 */
export function mapEntityLifecycleBucket(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    active: ENTITY_LIFECYCLE_BUCKET.ACTIVE,
    enabled: ENTITY_LIFECYCLE_BUCKET.ACTIVE,
    inactive: ENTITY_LIFECYCLE_BUCKET.INACTIVE,
    disabled: ENTITY_LIFECYCLE_BUCKET.INACTIVE,
    dormant: ENTITY_LIFECYCLE_BUCKET.INACTIVE,
    suspended: ENTITY_LIFECYCLE_BUCKET.SUSPENDED,
    locked: ENTITY_LIFECYCLE_BUCKET.SUSPENDED,
    archived: ENTITY_LIFECYCLE_BUCKET.ARCHIVED,
    closed: ENTITY_LIFECYCLE_BUCKET.ARCHIVED,
    deleted: ENTITY_LIFECYCLE_BUCKET.ARCHIVED,
    merged: ENTITY_LIFECYCLE_BUCKET.ARCHIVED,
  };
  return aliases[normalized] || ENTITY_LIFECYCLE_BUCKET.UNKNOWN;
}

/**
 * Normalize explicit profile-completeness signals to an analytical bucket.
 * Missing signals map to UNKNOWN — never coerced to incomplete/false.
 * @param {unknown} fact
 * @returns {string}
 */
export function mapProfileCompletenessStatus(fact) {
  if (!isPlainObject(fact)) return PROFILE_COMPLETENESS_STATUS.UNKNOWN;
  if (typeof fact.profileComplete === "boolean") {
    return fact.profileComplete
      ? PROFILE_COMPLETENESS_STATUS.COMPLETE
      : PROFILE_COMPLETENESS_STATUS.INCOMPLETE;
  }
  if (isNonEmptyString(fact.completenessStatus)) {
    const normalized = String(fact.completenessStatus).trim().toLowerCase();
    if (normalized === "complete") return PROFILE_COMPLETENESS_STATUS.COMPLETE;
    if (normalized === "incomplete")
      return PROFILE_COMPLETENESS_STATUS.INCOMPLETE;
    return PROFILE_COMPLETENESS_STATUS.UNKNOWN;
  }
  return PROFILE_COMPLETENESS_STATUS.UNKNOWN;
}

/**
 * @param {unknown[]} items
 * @param {(item: *) => string | undefined} keyFn
 * @returns {Readonly<Record<string, number>>}
 */
function countBy(items, keyFn) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.freeze({ ...counts });
}

/**
 * @param {number | null | undefined} numerator
 * @param {number | null | undefined} denominator
 * @returns {number | null}
 */
function safeRate(numerator, denominator) {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * @param {unknown} timestamp
 * @param {unknown} timeWindow
 * @returns {boolean}
 */
function isWithinTimeWindow(timestamp, timeWindow) {
  if (!isValidIsoTimestamp(timestamp)) return false;
  if (!isPlainObject(timeWindow)) return false;
  const ts = Date.parse(String(timestamp));
  const start = Date.parse(String(timeWindow.startAt));
  const end = Date.parse(String(timeWindow.endAt));
  if (!Number.isFinite(ts) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return false;
  }
  if (timeWindow.inclusive === false) return ts > start && ts < end;
  return ts >= start && ts <= end;
}

/**
 * @param {unknown} snapshot
 * @param {{ timeWindow?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCustomerSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "projectCustomerSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const timeWindow = isPlainObject(options.timeWindow)
    ? options.timeWindow
    : undefined;

  const customers = Array.isArray(snapshot.customers) ? snapshot.customers : [];
  const lifecycles = Array.isArray(snapshot.customerLifecycles)
    ? snapshot.customerLifecycles
    : [];
  const completeness = Array.isArray(snapshot.customerProfileCompleteness)
    ? snapshot.customerProfileCompleteness
    : [];
  const activities = Array.isArray(snapshot.customerActivities)
    ? snapshot.customerActivities
    : [];

  const customerCount = customers.length;

  const lifecycleSource = lifecycles.length > 0 ? lifecycles : customers;
  const lifecycleDistribution = countBy(lifecycleSource, (c) =>
    mapEntityLifecycleBucket(c.lifecycleStatus || c.status)
  );
  const activeCount = lifecycleDistribution[ENTITY_LIFECYCLE_BUCKET.ACTIVE] || 0;
  const inactiveCount =
    lifecycleDistribution[ENTITY_LIFECYCLE_BUCKET.INACTIVE] || 0;

  let createdCount = 0;
  for (const customer of customers) {
    if (!isValidIsoTimestamp(customer.createdAt)) continue;
    if (timeWindow) {
      if (isWithinTimeWindow(customer.createdAt, timeWindow)) createdCount += 1;
    } else {
      createdCount += 1;
    }
  }

  let activeInWindowCount = null;
  if (timeWindow) {
    const activeCustomerIds = new Set();
    for (const activity of activities) {
      if (
        isNonEmptyString(activity.customerId) &&
        isWithinTimeWindow(activity.occurredAt, timeWindow)
      ) {
        activeCustomerIds.add(String(activity.customerId));
      }
    }
    activeInWindowCount = activeCustomerIds.size;
  }

  let completeCount = 0;
  let incompleteCount = 0;
  for (const fact of completeness) {
    const bucket = mapProfileCompletenessStatus(fact);
    if (bucket === PROFILE_COMPLETENESS_STATUS.COMPLETE) completeCount += 1;
    else if (bucket === PROFILE_COMPLETENESS_STATUS.INCOMPLETE)
      incompleteCount += 1;
  }
  const hasCompletenessFacts = completeness.length > 0;
  const profileCompleteCount = hasCompletenessFacts ? completeCount : null;
  const profileCompletenessRate = hasCompletenessFacts
    ? safeRate(completeCount, completeCount + incompleteCount)
    : null;

  return ok(
    deepFreeze({
      customerCount,
      customerActiveCount: activeCount,
      customerInactiveCount: inactiveCount,
      customerLifecycleDistribution: lifecycleDistribution,
      customerCreatedCount: createdCount,
      customerActiveInWindowCount: activeInWindowCount,
      customerProfileCompleteCount: profileCompleteCount,
      customerProfileCompletenessRate: profileCompletenessRate,
      customerIdentityDeduplicated: false,
      analyticalMethodVersion:
        CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.DISTRIBUTION,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @param {{ timeWindow?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectPlayerSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "projectPlayerSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const timeWindow = isPlainObject(options.timeWindow)
    ? options.timeWindow
    : undefined;

  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const lifecycles = Array.isArray(snapshot.playerLifecycles)
    ? snapshot.playerLifecycles
    : [];
  const completeness = Array.isArray(snapshot.playerProfileCompleteness)
    ? snapshot.playerProfileCompleteness
    : [];
  const activities = Array.isArray(snapshot.playerActivities)
    ? snapshot.playerActivities
    : [];

  const playerCount = players.length;

  const lifecycleSource = lifecycles.length > 0 ? lifecycles : players;
  const lifecycleDistribution = countBy(lifecycleSource, (p) =>
    mapEntityLifecycleBucket(p.lifecycleStatus || p.status)
  );
  const activeCount = lifecycleDistribution[ENTITY_LIFECYCLE_BUCKET.ACTIVE] || 0;
  const inactiveCount =
    lifecycleDistribution[ENTITY_LIFECYCLE_BUCKET.INACTIVE] || 0;

  let createdCount = 0;
  for (const player of players) {
    if (!isValidIsoTimestamp(player.createdAt)) continue;
    if (timeWindow) {
      if (isWithinTimeWindow(player.createdAt, timeWindow)) createdCount += 1;
    } else {
      createdCount += 1;
    }
  }

  let activeInWindowCount = null;
  if (timeWindow) {
    const activePlayerIds = new Set();
    for (const activity of activities) {
      if (
        isNonEmptyString(activity.playerId) &&
        isWithinTimeWindow(activity.occurredAt, timeWindow)
      ) {
        activePlayerIds.add(String(activity.playerId));
      }
    }
    activeInWindowCount = activePlayerIds.size;
  }

  let completeCount = 0;
  let incompleteCount = 0;
  for (const fact of completeness) {
    const bucket = mapProfileCompletenessStatus(fact);
    if (bucket === PROFILE_COMPLETENESS_STATUS.COMPLETE) completeCount += 1;
    else if (bucket === PROFILE_COMPLETENESS_STATUS.INCOMPLETE)
      incompleteCount += 1;
  }
  const hasCompletenessFacts = completeness.length > 0;
  const profileCompleteCount = hasCompletenessFacts ? completeCount : null;
  const profileCompletenessRate = hasCompletenessFacts
    ? safeRate(completeCount, completeCount + incompleteCount)
    : null;

  return ok(
    deepFreeze({
      playerCount,
      playerActiveCount: activeCount,
      playerInactiveCount: inactiveCount,
      playerLifecycleDistribution: lifecycleDistribution,
      playerCreatedCount: createdCount,
      playerActiveInWindowCount: activeInWindowCount,
      playerProfileCompleteCount: profileCompleteCount,
      playerProfileCompletenessRate: profileCompletenessRate,
      analyticalMethodVersion:
        CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.DISTRIBUTION,
    })
  );
}

/**
 * Linkage from explicit customer↔player link facts only — never inferred.
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCustomerPlayerLinkage(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "projectCustomerPlayerLinkage requires a snapshot",
        "snapshot"
      )
    );
  }

  const customers = Array.isArray(snapshot.customers) ? snapshot.customers : [];
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const linkageAvailable = Array.isArray(snapshot.customerPlayerLinks);
  const links = linkageAvailable ? snapshot.customerPlayerLinks : [];

  const linkedCustomerIds = new Set();
  const linkedPlayerIds = new Set();
  for (const link of links) {
    if (isNonEmptyString(link.customerId)) {
      linkedCustomerIds.add(String(link.customerId));
    }
    if (isNonEmptyString(link.playerId)) {
      linkedPlayerIds.add(String(link.playerId));
    }
  }

  const linkStatusDistribution = countBy(links, (l) =>
    l.linkStatus ? String(l.linkStatus) : undefined
  );

  const customerCount = customers.length;
  const playerCount = players.length;

  const linkedCustomerCount = linkageAvailable ? linkedCustomerIds.size : null;
  const linkedPlayerCount = linkageAvailable ? linkedPlayerIds.size : null;
  const customerLinkageRate = linkageAvailable
    ? safeRate(linkedCustomerIds.size, customerCount)
    : null;
  const playerLinkageRate = linkageAvailable
    ? safeRate(linkedPlayerIds.size, playerCount)
    : null;

  /** @type {unknown[]} */
  const warnings = [];
  if (!linkageAvailable) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_CUSTOMER_PLAYER_LINKS_MISSING",
      message:
        "customerPlayerLinks fact list is absent; linkage counts/rates are indeterminate (not coerced to zero)",
      field: "customerPlayerLinks",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  return ok(
    deepFreeze({
      linkageAvailable,
      linkCount: links.length,
      linkedCustomerCount,
      linkedPlayerCount,
      customerLinkageRate,
      playerLinkageRate,
      linkStatusDistribution,
      customerPlayerLinkInferred: false,
      warnings: Object.freeze(warnings),
      analyticalMethodVersion: CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.LINKAGE,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @param {{ timeWindow?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCustomerPlayerActivity(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "projectCustomerPlayerActivity requires a snapshot",
        "snapshot"
      )
    );
  }

  const timeWindow = isPlainObject(options.timeWindow)
    ? options.timeWindow
    : undefined;

  const customerActivities = Array.isArray(snapshot.customerActivities)
    ? snapshot.customerActivities
    : [];
  const playerActivities = Array.isArray(snapshot.playerActivities)
    ? snapshot.playerActivities
    : [];

  const filteredCustomerActivities = timeWindow
    ? customerActivities.filter((a) => isWithinTimeWindow(a.occurredAt, timeWindow))
    : customerActivities;
  const filteredPlayerActivities = timeWindow
    ? playerActivities.filter((a) => isWithinTimeWindow(a.occurredAt, timeWindow))
    : playerActivities;

  const customerActivityKindDistribution = countBy(
    filteredCustomerActivities,
    (a) => (a.activityKind ? String(a.activityKind) : a.category ? String(a.category) : undefined)
  );
  const playerActivityKindDistribution = countBy(
    filteredPlayerActivities,
    (a) => (a.activityKind ? String(a.activityKind) : a.category ? String(a.category) : undefined)
  );

  return ok(
    deepFreeze({
      customerActivityCount: filteredCustomerActivities.length,
      playerActivityCount: filteredPlayerActivities.length,
      customerActivityKindDistribution,
      playerActivityKindDistribution,
      analyticalMethodVersion: CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.ACTIVITY,
    })
  );
}

/**
 * Descriptive-only competition-participation projection. No eligibility or
 * performance calculation.
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectPlayerCompetitionParticipation(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "projectPlayerCompetitionParticipation requires a snapshot",
        "snapshot"
      )
    );
  }

  const list = Array.isArray(snapshot.playerCompetitionParticipations)
    ? snapshot.playerCompetitionParticipations
    : [];

  const statusDistribution = countBy(list, (p) =>
    p.status ? String(p.status) : undefined
  );
  const distinctPlayerIds = new Set(
    list.filter((p) => isNonEmptyString(p.playerId)).map((p) => String(p.playerId))
  );
  const distinctCompetitionIds = new Set(
    list
      .filter((p) => isNonEmptyString(p.competitionId))
      .map((p) => String(p.competitionId))
  );

  return ok(
    deepFreeze({
      participationCount: list.length,
      participationStatusDistribution: statusDistribution,
      distinctParticipatingPlayerCount: distinctPlayerIds.size,
      distinctCompetitionCount: distinctCompetitionIds.size,
      eligibilityCalculated: false,
      performanceCalculated: false,
      analyticalMethodVersion:
        CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.PARTICIPATION,
    })
  );
}

/**
 * Descriptive-only club-membership projection. No ranking calculation.
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectPlayerClubMembership(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "projectPlayerClubMembership requires a snapshot",
        "snapshot"
      )
    );
  }

  const list = Array.isArray(snapshot.playerClubMemberships)
    ? snapshot.playerClubMemberships
    : [];

  const statusDistribution = countBy(list, (m) =>
    m.status ? String(m.status) : undefined
  );
  const distinctPlayerIds = new Set(
    list.filter((m) => isNonEmptyString(m.playerId)).map((m) => String(m.playerId))
  );
  const distinctClubIds = new Set(
    list.filter((m) => isNonEmptyString(m.clubId)).map((m) => String(m.clubId))
  );

  return ok(
    deepFreeze({
      membershipCount: list.length,
      membershipStatusDistribution: statusDistribution,
      distinctMemberPlayerCount: distinctPlayerIds.size,
      distinctClubCount: distinctClubIds.size,
      rankingCalculated: false,
      analyticalMethodVersion:
        CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.MEMBERSHIP,
    })
  );
}

/**
 * Compose full Customer / Player analytics summary.
 * @param {unknown} snapshot
 * @param {{ timeWindow?: unknown, generatedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCustomerPlayerSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "projectCustomerPlayerSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const customer = projectCustomerSummary(snapshot, {
    timeWindow: options.timeWindow,
  });
  if (!customer.ok) return customer;
  const player = projectPlayerSummary(snapshot, {
    timeWindow: options.timeWindow,
  });
  if (!player.ok) return player;
  const linkage = projectCustomerPlayerLinkage(snapshot);
  if (!linkage.ok) return linkage;
  const activity = projectCustomerPlayerActivity(snapshot, {
    timeWindow: options.timeWindow,
  });
  if (!activity.ok) return activity;
  const participation = projectPlayerCompetitionParticipation(snapshot);
  if (!participation.ok) return participation;
  const membership = projectPlayerClubMembership(snapshot);
  if (!membership.ok) return membership;

  /** @type {unknown[]} */
  const warnings = [];
  for (const list of [snapshot.warnings, linkage.value.warnings]) {
    if (Array.isArray(list)) {
      for (const w of list) warnings.push(w);
    }
  }

  if (snapshot.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_CUSTOMER_PLAYER_STALE_SOURCE",
      message: "Source snapshot freshness is STALE",
      field: "freshness",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  const incompleteSnapshot =
    snapshot.completeness === CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS.PARTIAL ||
    snapshot.completeness === CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS.UNKNOWN;

  const context = isPlainObject(snapshot.context) ? snapshot.context : {};

  return ok(
    deepFreeze(
      clonePlain({
        tenantId: context.tenantScope?.tenantId,
        customerId: context.customerId,
        playerId: context.playerId,
        ...customer.value,
        ...player.value,
        linkageAvailable: linkage.value.linkageAvailable,
        linkCount: linkage.value.linkCount,
        linkedCustomerCount: linkage.value.linkedCustomerCount,
        linkedPlayerCount: linkage.value.linkedPlayerCount,
        customerLinkageRate: linkage.value.customerLinkageRate,
        playerLinkageRate: linkage.value.playerLinkageRate,
        linkStatusDistribution: linkage.value.linkStatusDistribution,
        customerActivityCount: activity.value.customerActivityCount,
        playerActivityCount: activity.value.playerActivityCount,
        customerActivityKindDistribution:
          activity.value.customerActivityKindDistribution,
        playerActivityKindDistribution:
          activity.value.playerActivityKindDistribution,
        participationCount: participation.value.participationCount,
        participationStatusDistribution:
          participation.value.participationStatusDistribution,
        distinctParticipatingPlayerCount:
          participation.value.distinctParticipatingPlayerCount,
        distinctCompetitionCount: participation.value.distinctCompetitionCount,
        membershipCount: membership.value.membershipCount,
        membershipStatusDistribution: membership.value.membershipStatusDistribution,
        distinctMemberPlayerCount: membership.value.distinctMemberPlayerCount,
        distinctClubCount: membership.value.distinctClubCount,
        provenance: snapshot.provenance,
        freshness: snapshot.freshness,
        completeness: snapshot.completeness,
        incompleteSnapshot,
        sourceTimestamp: snapshot.sourceTimestamp,
        canonicalSourceRef: snapshot.canonicalSourceRef,
        generatedAt: options.generatedAt,
        warnings: Object.freeze(warnings),
        analyticalMethodVersion: CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.SUMMARY,
        isCanonicalCustomerPlayerState: false,
        isCanonicalModuleState: false,
        customerIdentityDeduplicated: false,
        customerPlayerLinkInferred: false,
        crmConversionCalculated: false,
        revenueCalculated: false,
        ratingCalculated: false,
        rankingCalculated: false,
        performanceCalculated: false,
        eligibilityCalculated: false,
        privacySafe: true,
      })
    )
  );
}
