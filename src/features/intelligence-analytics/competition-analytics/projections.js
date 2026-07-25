/**
 * Deterministic Competition Analytics projections (I&A-06).
 * Descriptive counts/rates only — no scoring, standings, ranking, or eligibility.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  clonePlain,
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  COMPETITION_ANALYTICS_COMPLETENESS,
  COMPETITION_ANALYTICS_METHOD_VERSION,
  COMPETITION_MATCH_LIFECYCLE_BUCKET,
  COMPETITION_PROGRESS_EXCLUSION_POLICY,
  COMPETITION_RESULT_ACCEPTANCE_BUCKET,
  COMPETITION_SCHEDULE_ON_TIME_THRESHOLD_SECONDS_DEFAULT,
} from "./enums.js";

/**
 * Normalize explicit lifecycle status to analytical bucket (label mapping only).
 * @param {string} status
 * @returns {string}
 */
export function mapLifecycleBucket(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    scheduled: COMPETITION_MATCH_LIFECYCLE_BUCKET.SCHEDULED,
    ready: COMPETITION_MATCH_LIFECYCLE_BUCKET.SCHEDULED,
    delayed: COMPETITION_MATCH_LIFECYCLE_BUCKET.SCHEDULED,
    postponed: COMPETITION_MATCH_LIFECYCLE_BUCKET.SCHEDULED,
    in_progress: COMPETITION_MATCH_LIFECYCLE_BUCKET.IN_PROGRESS,
    active: COMPETITION_MATCH_LIFECYCLE_BUCKET.IN_PROGRESS,
    completed: COMPETITION_MATCH_LIFECYCLE_BUCKET.COMPLETED,
    cancelled: COMPETITION_MATCH_LIFECYCLE_BUCKET.CANCELLED,
    canceled: COMPETITION_MATCH_LIFECYCLE_BUCKET.CANCELLED,
    suspended: COMPETITION_MATCH_LIFECYCLE_BUCKET.SUSPENDED,
    paused: COMPETITION_MATCH_LIFECYCLE_BUCKET.SUSPENDED,
    void: COMPETITION_MATCH_LIFECYCLE_BUCKET.VOID,
    abandoned: COMPETITION_MATCH_LIFECYCLE_BUCKET.ABANDONED,
  };
  return aliases[normalized] || COMPETITION_MATCH_LIFECYCLE_BUCKET.UNKNOWN;
}

/**
 * @param {string} status
 * @returns {string}
 */
export function mapAcceptanceBucket(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    accepted: COMPETITION_RESULT_ACCEPTANCE_BUCKET.ACCEPTED,
    rejected: COMPETITION_RESULT_ACCEPTANCE_BUCKET.REJECTED,
    pending: COMPETITION_RESULT_ACCEPTANCE_BUCKET.PENDING,
    correction_required: COMPETITION_RESULT_ACCEPTANCE_BUCKET.PENDING,
    superseded: COMPETITION_RESULT_ACCEPTANCE_BUCKET.UNKNOWN,
  };
  return aliases[normalized] || COMPETITION_RESULT_ACCEPTANCE_BUCKET.UNKNOWN;
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
 * @param {number | null} numerator
 * @param {number} denominator
 * @returns {number | null}
 */
function safeRate(numerator, denominator) {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionDistributions(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionDistributions requires a snapshot",
        "snapshot"
      )
    );
  }

  const participants = Array.isArray(snapshot.participants)
    ? snapshot.participants
    : [];
  const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
  const registrations = Array.isArray(snapshot.registrations)
    ? snapshot.registrations
    : [];
  const divisions = Array.isArray(snapshot.divisions) ? snapshot.divisions : [];
  const categories = Array.isArray(snapshot.categories)
    ? snapshot.categories
    : [];
  const teams = Array.isArray(snapshot.teams) ? snapshot.teams : [];
  const matches = Array.isArray(snapshot.matches) ? snapshot.matches : [];
  const results = Array.isArray(snapshot.results) ? snapshot.results : [];

  const lifecycle = countBy(matches, (m) => mapLifecycleBucket(m.lifecycleStatus));
  const registrationStatus = countBy(registrations, (r) =>
    r.status ? String(r.status) : undefined
  );
  const participantStatus = countBy(participants, (p) =>
    p.status ? String(p.status) : undefined
  );
  const divisionDist = countBy(participants, (p) =>
    p.divisionId ? String(p.divisionId) : undefined
  );
  const categoryDist = countBy(participants, (p) =>
    p.categoryId ? String(p.categoryId) : undefined
  );
  const entryKindDist = countBy(participants, (p) =>
    p.entryKind ? String(p.entryKind) : undefined
  );
  const acceptance = countBy(results, (r) =>
    mapAcceptanceBucket(r.acceptanceStatus)
  );

  return ok(
    deepFreeze({
      participantCount: participants.length,
      entryCount: entries.length,
      registrationCount: registrations.length,
      divisionCount: divisions.length,
      categoryCount: categories.length,
      teamCount: teams.length,
      matchCount: matches.length,
      resultCount: results.length,
      participantStatusDistribution: participantStatus,
      registrationStatusDistribution: registrationStatus,
      divisionDistribution: divisionDist,
      categoryDistribution: categoryDist,
      entryKindDistribution: entryKindDist,
      matchLifecycleDistribution: lifecycle,
      resultAcceptanceDistribution: acceptance,
      analyticalMethodVersion: COMPETITION_ANALYTICS_METHOD_VERSION.DISTRIBUTION,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @param {{ exclusionPolicy?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionProgress(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionProgress requires a snapshot",
        "snapshot"
      )
    );
  }

  const exclusionPolicy =
    options.exclusionPolicy ||
    COMPETITION_PROGRESS_EXCLUSION_POLICY.EXCLUDE_CANCELLED_VOID;

  const matches = Array.isArray(snapshot.matches) ? snapshot.matches : [];
  let completed = 0;
  let eligible = 0;
  let cancelled = 0;
  let voided = 0;
  let abandoned = 0;
  let unknown = 0;

  for (const match of matches) {
    const bucket = mapLifecycleBucket(match.lifecycleStatus);
    if (bucket === COMPETITION_MATCH_LIFECYCLE_BUCKET.COMPLETED) completed += 1;
    if (bucket === COMPETITION_MATCH_LIFECYCLE_BUCKET.CANCELLED) cancelled += 1;
    if (bucket === COMPETITION_MATCH_LIFECYCLE_BUCKET.VOID) voided += 1;
    if (bucket === COMPETITION_MATCH_LIFECYCLE_BUCKET.ABANDONED) abandoned += 1;
    if (bucket === COMPETITION_MATCH_LIFECYCLE_BUCKET.UNKNOWN) unknown += 1;

    if (
      exclusionPolicy ===
      COMPETITION_PROGRESS_EXCLUSION_POLICY.EXCLUDE_CANCELLED_VOID
    ) {
      if (
        bucket !== COMPETITION_MATCH_LIFECYCLE_BUCKET.CANCELLED &&
        bucket !== COMPETITION_MATCH_LIFECYCLE_BUCKET.VOID
      ) {
        eligible += 1;
      }
    } else {
      eligible += 1;
    }
  }

  const completionRate = safeRate(completed, eligible);
  const progressPercentage =
    completionRate === null ? null : completionRate * 100;

  /** @type {unknown[]} */
  const warnings = [];
  if (unknown > 0) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_COMPETITION_UNKNOWN_LIFECYCLE",
      message: `Snapshot contains matches with unknown lifecycle status (${unknown})`,
      field: "matches",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  const incomplete =
    snapshot.completeness === COMPETITION_ANALYTICS_COMPLETENESS.PARTIAL ||
    snapshot.completeness === COMPETITION_ANALYTICS_COMPLETENESS.UNKNOWN;

  return ok(
    deepFreeze({
      completedCount: completed,
      eligibleTotal: eligible,
      totalMatchCount: matches.length,
      cancelledCount: cancelled,
      voidCount: voided,
      abandonedCount: abandoned,
      unknownCount: unknown,
      completionRate,
      progressPercentage,
      exclusionPolicy,
      incompleteSnapshot: incomplete,
      claimedCompetitionComplete: false,
      warnings: Object.freeze(warnings),
      analyticalMethodVersion: COMPETITION_ANALYTICS_METHOD_VERSION.PROGRESS,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionResultAcceptance(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionResultAcceptance requires a snapshot",
        "snapshot"
      )
    );
  }

  const results = Array.isArray(snapshot.results) ? snapshot.results : [];
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  let unknown = 0;

  for (const result of results) {
    const bucket = mapAcceptanceBucket(result.acceptanceStatus);
    if (bucket === COMPETITION_RESULT_ACCEPTANCE_BUCKET.ACCEPTED) accepted += 1;
    else if (bucket === COMPETITION_RESULT_ACCEPTANCE_BUCKET.REJECTED)
      rejected += 1;
    else if (bucket === COMPETITION_RESULT_ACCEPTANCE_BUCKET.PENDING)
      pending += 1;
    else unknown += 1;
  }

  const denominator = accepted + rejected;
  const acceptanceRate = safeRate(accepted, denominator);

  return ok(
    deepFreeze({
      acceptedCount: accepted,
      rejectedCount: rejected,
      pendingCount: pending,
      unknownCount: unknown,
      totalResultCount: results.length,
      acceptanceRate,
      pendingExcludedFromRate: true,
      analyticalMethodVersion:
        COMPETITION_ANALYTICS_METHOD_VERSION.RESULT_ACCEPTANCE,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @param {{ onTimeThresholdSeconds?: number }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionScheduleAdherence(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionScheduleAdherence requires a snapshot",
        "snapshot"
      )
    );
  }

  const threshold =
    options.onTimeThresholdSeconds === undefined
      ? COMPETITION_SCHEDULE_ON_TIME_THRESHOLD_SECONDS_DEFAULT
      : options.onTimeThresholdSeconds;

  if (!isFiniteNumber(threshold) || threshold < 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        "onTimeThresholdSeconds must be a finite non-negative number",
        "onTimeThresholdSeconds"
      )
    );
  }

  const schedules = Array.isArray(snapshot.schedules) ? snapshot.schedules : [];
  let onTime = 0;
  let delayed = 0;
  let early = 0;
  let missingTimestamps = 0;
  /** @type {number[]} */
  const delays = [];
  /** @type {unknown[]} */
  const warnings = [];

  for (const schedule of schedules) {
    const scheduled = schedule.scheduledStartAt;
    const actual = schedule.actualStartAt;
    if (!scheduled || !actual) {
      missingTimestamps += 1;
      continue;
    }
    if (!isValidIsoTimestamp(scheduled) || !isValidIsoTimestamp(actual)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_TIMESTAMP_INVALID,
          "Schedule timestamps must be valid ISO timestamps",
          "schedules",
          { matchId: schedule.matchId }
        )
      );
    }
    const deltaSeconds =
      (Date.parse(String(actual)) - Date.parse(String(scheduled))) / 1000;
    delays.push(deltaSeconds);
    if (deltaSeconds < 0) {
      early += 1;
      onTime += 1; // early is still within on-time for default threshold semantics
    } else if (deltaSeconds <= threshold) {
      onTime += 1;
    } else {
      delayed += 1;
    }
  }

  if (missingTimestamps > 0) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_COMPETITION_MISSING_SCHEDULE_TIMESTAMPS",
      message: `Missing scheduled/actual start timestamps preserved as missing (${missingTimestamps}) — not coerced to zero`,
      field: "schedules",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  const adherenceDenom = onTime + delayed;
  const adherenceRate = safeRate(onTime, adherenceDenom);
  const averageDelay =
    delays.length === 0
      ? null
      : delays.reduce((sum, value) => sum + value, 0) / delays.length;

  return ok(
    deepFreeze({
      onTimeCount: onTime,
      delayedCount: delayed,
      earlyCount: early,
      evaluatedCount: onTime + delayed,
      missingTimestamps,
      adherenceRate,
      averageDelaySeconds: averageDelay,
      onTimeThresholdSeconds: threshold,
      startDeltasSeconds: Object.freeze([...delays]),
      warnings: Object.freeze(warnings),
      analyticalMethodVersion:
        COMPETITION_ANALYTICS_METHOD_VERSION.SCHEDULE_ADHERENCE,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionDurations(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionDurations requires a snapshot",
        "snapshot"
      )
    );
  }

  const schedules = Array.isArray(snapshot.schedules) ? snapshot.schedules : [];
  /** @type {number[]} */
  const durations = [];
  let missingTimestamps = 0;

  for (const schedule of schedules) {
    const start = schedule.actualStartAt;
    const end = schedule.actualEndAt;
    if (!start || !end) {
      missingTimestamps += 1;
      continue;
    }
    if (!isValidIsoTimestamp(start) || !isValidIsoTimestamp(end)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_TIMESTAMP_INVALID,
          "Duration timestamps must be valid ISO timestamps",
          "schedules",
          { matchId: schedule.matchId }
        )
      );
    }
    const durationSeconds =
      (Date.parse(String(end)) - Date.parse(String(start))) / 1000;
    if (durationSeconds < 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_DURATION_INVALID,
          "Negative match duration is not allowed",
          "schedules",
          { matchId: schedule.matchId, durationSeconds }
        )
      );
    }
    durations.push(durationSeconds);
  }

  const averageDuration =
    durations.length === 0
      ? null
      : durations.reduce((sum, value) => sum + value, 0) / durations.length;

  /** @type {Record<string, number>} */
  const distribution = {};
  for (const duration of durations) {
    let bucket;
    if (duration < 1800) bucket = "under_30m";
    else if (duration < 3600) bucket = "30m_to_60m";
    else if (duration < 7200) bucket = "60m_to_120m";
    else bucket = "over_120m";
    distribution[bucket] = (distribution[bucket] || 0) + 1;
  }

  return ok(
    deepFreeze({
      durationsSeconds: Object.freeze([...durations]),
      averageDurationSeconds: averageDuration,
      durationCount: durations.length,
      missingTimestamps,
      durationDistribution: Object.freeze({ ...distribution }),
      analyticalMethodVersion: COMPETITION_ANALYTICS_METHOD_VERSION.DURATION,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionAssignments(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionAssignments requires a snapshot",
        "snapshot"
      )
    );
  }

  const assignments = Array.isArray(snapshot.assignments)
    ? snapshot.assignments
    : [];
  /** @type {Set<string>} */
  const courtMatches = new Set();
  /** @type {Set<string>} */
  const refereeMatches = new Set();

  for (const assignment of assignments) {
    if (assignment.courtId) courtMatches.add(String(assignment.matchId));
    if (assignment.refereeId) refereeMatches.add(String(assignment.matchId));
  }

  return ok(
    deepFreeze({
      courtAssignedMatchCount: courtMatches.size,
      refereeAssignedMatchCount: refereeMatches.size,
      assignmentFactCount: assignments.length,
      inferredCoverage: false,
      analyticalMethodVersion: COMPETITION_ANALYTICS_METHOD_VERSION.DISTRIBUTION,
    })
  );
}

/**
 * Opaque standings snapshot consumption — no recalculation.
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionStandingsConsumption(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionStandingsConsumption requires a snapshot",
        "snapshot"
      )
    );
  }

  const standings = Array.isArray(snapshot.standingsSnapshots)
    ? snapshot.standingsSnapshots
    : [];

  const references = standings.map((item) =>
    deepFreeze({
      snapshotId: item.snapshotId,
      snapshotVersion: item.snapshotVersion,
      rowCount: item.rowCount,
      opaqueRankCount: Array.isArray(item.opaqueRanks)
        ? item.opaqueRanks.length
        : 0,
      recalculated: false,
    })
  );

  return ok(
    deepFreeze({
      standingsSnapshotCount: standings.length,
      references: Object.freeze(references),
      standsAsCanonical: false,
      scoringCalculated: false,
      winnerCalculated: false,
      rankingCalculated: false,
    })
  );
}

/**
 * Full competition summary projection.
 * @param {unknown} snapshot
 * @param {{
 *   onTimeThresholdSeconds?: number,
 *   exclusionPolicy?: string,
 *   generatedAt?: string,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCompetitionSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "projectCompetitionSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const distributions = projectCompetitionDistributions(snapshot);
  if (!distributions.ok) return distributions;
  const progress = projectCompetitionProgress(snapshot, {
    exclusionPolicy: options.exclusionPolicy,
  });
  if (!progress.ok) return progress;
  const results = projectCompetitionResultAcceptance(snapshot);
  if (!results.ok) return results;
  const schedule = projectCompetitionScheduleAdherence(snapshot, {
    onTimeThresholdSeconds: options.onTimeThresholdSeconds,
  });
  if (!schedule.ok) return schedule;
  const durations = projectCompetitionDurations(snapshot);
  if (!durations.ok) return durations;
  const assignments = projectCompetitionAssignments(snapshot);
  if (!assignments.ok) return assignments;
  const standings = projectCompetitionStandingsConsumption(snapshot);
  if (!standings.ok) return standings;

  const lifecycle = distributions.value.matchLifecycleDistribution;
  /** @type {unknown[]} */
  const warnings = [
    ...(progress.value.warnings || []),
    ...(schedule.value.warnings || []),
    ...(Array.isArray(snapshot.warnings) ? snapshot.warnings : []),
  ];

  if (snapshot.freshness === "stale") {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_COMPETITION_STALE_SOURCE",
      message: "Competition analytics source freshness is stale",
      field: "freshness",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  const context = snapshot.context || {};
  const generatedAt =
    options.generatedAt ||
    context.generatedAt ||
    new Date().toISOString();

  return ok(
    deepFreeze(
      clonePlain({
        tenantId: context.tenantScope?.tenantId,
        competitionId: context.competitionId,
        competitionVersion: context.competitionVersion,
        participantCount: distributions.value.participantCount,
        entryCount: distributions.value.entryCount,
        registrationCount: distributions.value.registrationCount,
        divisionCount: distributions.value.divisionCount,
        categoryCount: distributions.value.categoryCount,
        teamCount: distributions.value.teamCount,
        totalMatchCount: distributions.value.matchCount,
        scheduledCount: lifecycle.scheduled || 0,
        inProgressCount: lifecycle.in_progress || 0,
        completedCount: progress.value.completedCount,
        cancelledCount: progress.value.cancelledCount,
        voidCount: progress.value.voidCount,
        abandonedCount: progress.value.abandonedCount,
        suspendedCount: lifecycle.suspended || 0,
        acceptedResultCount: results.value.acceptedCount,
        rejectedResultCount: results.value.rejectedCount,
        pendingResultCount: results.value.pendingCount,
        completionRate: progress.value.completionRate,
        progressPercentage: progress.value.progressPercentage,
        acceptanceRate: results.value.acceptanceRate,
        scheduleAdherence: {
          onTimeCount: schedule.value.onTimeCount,
          delayedCount: schedule.value.delayedCount,
          adherenceRate: schedule.value.adherenceRate,
          averageDelaySeconds: schedule.value.averageDelaySeconds,
          onTimeThresholdSeconds: schedule.value.onTimeThresholdSeconds,
        },
        durationSummary: {
          averageDurationSeconds: durations.value.averageDurationSeconds,
          durationCount: durations.value.durationCount,
          durationDistribution: durations.value.durationDistribution,
        },
        assignmentSummary: {
          courtAssignedMatchCount: assignments.value.courtAssignedMatchCount,
          refereeAssignedMatchCount:
            assignments.value.refereeAssignedMatchCount,
        },
        distributions: distributions.value,
        progress: progress.value,
        results: results.value,
        schedule: schedule.value,
        durations: durations.value,
        assignments: assignments.value,
        standings: standings.value,
        sourceTimestamp: snapshot.sourceTimestamp,
        generatedAt,
        provenance: snapshot.provenance,
        freshness: snapshot.freshness,
        completeness: snapshot.completeness,
        incompleteSnapshot: progress.value.incompleteSnapshot,
        warnings: Object.freeze(warnings),
        analyticalMethodVersion: COMPETITION_ANALYTICS_METHOD_VERSION.SUMMARY,
        isCanonicalCompetitionState: false,
        isCanonicalModuleState: false,
      })
    )
  );
}
