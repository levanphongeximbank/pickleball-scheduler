/**
 * Deterministic Finance / Ranking / Performance Analytics projections
 * (I&A-09). Descriptive counts/rates/sums only — no ledger posting, revenue
 * recognition, ranking/rating/standings recalculation, or winner inference
 * from score. Money aggregation never crosses currencies silently.
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
} from "../contracts/shared.js";
import { sumCompatibleAnalyticalMoney } from "./money.js";
import {
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_COMPLETENESS,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION,
  RANK_DIRECTION,
} from "./enums.js";

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
 * Never returns Infinity on a zero denominator — returns null instead.
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
 * Sums a list of AnalyticalMoney amounts. When multiple currencies are
 * present, returns a per-currency breakdown rather than a single total
 * (or fails with CURRENCY_MISMATCH when requireSingleCurrency is set).
 * @param {unknown[]} amounts
 * @param {{ requireSingleCurrency?: boolean }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
function summarizeAmounts(amounts, options = {}) {
  const valid = (Array.isArray(amounts) ? amounts : []).filter(
    (a) =>
      isPlainObject(a) &&
      isNonEmptyString(a.currencyCode) &&
      Number.isInteger(a.amountMinor)
  );

  if (valid.length === 0) {
    return ok({ totalAmount: null, amountsByCurrency: null, currencyMismatch: false });
  }

  const currencyCodes = new Set(valid.map((a) => a.currencyCode));
  if (currencyCodes.size > 1) {
    if (options.requireSingleCurrency) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH,
          "Mixed-currency amounts cannot be summed into a single scalar total",
          "amounts",
          { currencyCodes: Object.freeze([...currencyCodes]) }
        )
      );
    }
    /** @type {Record<string, { currencyCode: string, amountMinor: number, scale: number }>} */
    const byCurrency = {};
    for (const money of valid) {
      const key = money.currencyCode;
      if (!byCurrency[key]) {
        byCurrency[key] = { currencyCode: key, amountMinor: 0, scale: money.scale || 0 };
      }
      byCurrency[key].amountMinor += money.amountMinor;
    }
    return ok({
      totalAmount: null,
      amountsByCurrency: deepFreeze(byCurrency),
      currencyMismatch: true,
    });
  }

  const sumResult = sumCompatibleAnalyticalMoney(valid);
  if (!sumResult.ok) return sumResult;
  return ok({ totalAmount: sumResult.value, amountsByCurrency: null, currencyMismatch: false });
}

/**
 * @param {unknown} payment
 * @returns {boolean}
 */
function isSettledLike(fact) {
  if (!isPlainObject(fact)) return false;
  if (fact.settled === true) return true;
  const status = String(fact.status || "").toUpperCase();
  return status === "SETTLED" || status === "CONFIRMED";
}

/**
 * @param {unknown} invoice
 * @returns {boolean}
 */
function isIssuedInvoice(invoice) {
  if (!isPlainObject(invoice)) return false;
  const status = String(invoice.status || "").toUpperCase();
  return status === "ISSUED" || isNonEmptyString(invoice.issuedAt);
}

/**
 * @param {unknown} receivable
 * @returns {boolean}
 */
function isOutstandingReceivable(receivable) {
  if (!isPlainObject(receivable)) return false;
  const status = String(receivable.status || "").toUpperCase();
  return status === "OUTSTANDING" || status === "OPEN";
}

/**
 * Overdue is only ever explicit — never inferred from due dates.
 * @param {unknown} receivable
 * @returns {boolean}
 */
function isOverdueReceivable(receivable) {
  if (!isPlainObject(receivable)) return false;
  if (receivable.overdue === true) return true;
  return String(receivable.status || "").toUpperCase() === "OVERDUE";
}

/**
 * @param {unknown} snapshot
 * @param {{ requireSingleCurrency?: boolean }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectFinanceSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "projectFinanceSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const transactions = Array.isArray(snapshot.transactions) ? snapshot.transactions : [];
  const invoices = Array.isArray(snapshot.invoices) ? snapshot.invoices : [];
  const payments = Array.isArray(snapshot.payments) ? snapshot.payments : [];
  const refunds = Array.isArray(snapshot.refunds) ? snapshot.refunds : [];
  const settlements = Array.isArray(snapshot.settlements) ? snapshot.settlements : [];
  const receivables = Array.isArray(snapshot.receivables) ? snapshot.receivables : [];
  const recognizedAmounts = Array.isArray(snapshot.recognizedAmounts)
    ? snapshot.recognizedAmounts
    : [];

  const transactionsCount = transactions.length;
  const transactionsStatusDistribution = countBy(transactions, (t) =>
    t.status ? String(t.status) : undefined
  );

  const invoicesIssuedCount = invoices.filter(isIssuedInvoice).length;
  const invoicesStatusDistribution = countBy(invoices, (i) =>
    i.status ? String(i.status) : undefined
  );

  const paymentsCount = payments.length;
  const settledPayments = payments.filter(isSettledLike);
  const paymentsSettledCount = settledPayments.length;
  const paymentsSettledAmountResult = summarizeAmounts(
    settledPayments.map((p) => p.amount).filter(Boolean),
    options
  );
  if (!paymentsSettledAmountResult.ok) return paymentsSettledAmountResult;

  const refundsCount = refunds.length;
  const settledRefunds = refunds.filter(isSettledLike);
  const refundsSettledAmountResult = summarizeAmounts(
    settledRefunds.map((r) => r.amount).filter(Boolean),
    options
  );
  if (!refundsSettledAmountResult.ok) return refundsSettledAmountResult;

  const settlementsCount = settlements.length;
  const settlementsStatusDistribution = countBy(settlements, (s) =>
    s.status ? String(s.status) : undefined
  );

  const outstandingReceivables = receivables.filter(isOutstandingReceivable);
  const receivablesOutstandingCount = outstandingReceivables.length;
  const receivablesOutstandingAmountResult = summarizeAmounts(
    outstandingReceivables.map((r) => r.amount).filter(Boolean),
    options
  );
  if (!receivablesOutstandingAmountResult.ok) return receivablesOutstandingAmountResult;

  const overdueReceivables = receivables.filter(isOverdueReceivable);
  const receivablesOverdueCount = overdueReceivables.length;
  const receivablesOverdueAmountResult = summarizeAmounts(
    overdueReceivables.map((r) => r.amount).filter(Boolean),
    options
  );
  if (!receivablesOverdueAmountResult.ok) return receivablesOverdueAmountResult;

  const collectionsRate = safeRate(
    paymentsSettledCount,
    paymentsSettledCount + receivablesOutstandingCount
  );

  const revenueFacts = recognizedAmounts.filter((r) => r.kind === "revenue");
  const expenseFacts = recognizedAmounts.filter((r) => r.kind === "expense");
  const revenueRecognizedAmountResult = summarizeAmounts(
    revenueFacts.map((r) => r.amount).filter(Boolean),
    options
  );
  if (!revenueRecognizedAmountResult.ok) return revenueRecognizedAmountResult;
  const expensesRecognizedAmountResult = summarizeAmounts(
    expenseFacts.map((r) => r.amount).filter(Boolean),
    options
  );
  if (!expensesRecognizedAmountResult.ok) return expensesRecognizedAmountResult;

  return ok(
    deepFreeze({
      transactionsCount,
      transactionsStatusDistribution,
      invoicesCount: invoices.length,
      invoicesIssuedCount,
      invoicesStatusDistribution,
      paymentsCount,
      paymentsSettledCount,
      paymentsSettledAmount: paymentsSettledAmountResult.value.totalAmount,
      paymentsSettledAmountsByCurrency: paymentsSettledAmountResult.value.amountsByCurrency,
      refundsCount,
      refundsSettledAmount: refundsSettledAmountResult.value.totalAmount,
      refundsSettledAmountsByCurrency: refundsSettledAmountResult.value.amountsByCurrency,
      settlementsCount,
      settlementsStatusDistribution,
      receivablesOutstandingCount,
      receivablesOutstandingAmount: receivablesOutstandingAmountResult.value.totalAmount,
      receivablesOutstandingAmountsByCurrency:
        receivablesOutstandingAmountResult.value.amountsByCurrency,
      receivablesOverdueCount,
      receivablesOverdueAmount: receivablesOverdueAmountResult.value.totalAmount,
      receivablesOverdueAmountsByCurrency: receivablesOverdueAmountResult.value.amountsByCurrency,
      collectionsRate,
      revenueRecognizedAmount: revenueRecognizedAmountResult.value.totalAmount,
      revenueRecognizedAmountsByCurrency: revenueRecognizedAmountResult.value.amountsByCurrency,
      expensesRecognizedAmount: expensesRecognizedAmountResult.value.totalAmount,
      expensesRecognizedAmountsByCurrency: expensesRecognizedAmountResult.value.amountsByCurrency,
      revenueCalculated: false,
      ledgerPosted: false,
      bookingOrPaymentTreatedAsRevenue: false,
      overdueInferredFromDates: false,
      analyticalMethodVersion:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.FINANCE_SUMMARY,
    })
  );
}

/**
 * Compares ranking positions between two ranking snapshots that share the
 * same ranking system, version, and (when present) entity type. "Up"/"down"
 * always reflect the raw numeric rank change — this function never claims
 * that a numeric decrease means "better" unless the source explicitly
 * states a rankDirection.
 * @param {unknown} snapshot
 * @param {{ baselineSnapshotId: string, comparisonSnapshotId: string }} movementCompare
 * @returns {import("../contracts/result.js").Result}
 */
export function projectRankingMovement(snapshot, movementCompare) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "projectRankingMovement requires a snapshot",
        "snapshot"
      )
    );
  }
  if (
    !isPlainObject(movementCompare) ||
    !isNonEmptyString(movementCompare.baselineSnapshotId) ||
    !isNonEmptyString(movementCompare.comparisonSnapshotId)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "movementCompare requires baselineSnapshotId and comparisonSnapshotId",
        "movementCompare"
      )
    );
  }

  const { baselineSnapshotId, comparisonSnapshotId } = movementCompare;
  const rankingSnapshots = Array.isArray(snapshot.rankingSnapshots)
    ? snapshot.rankingSnapshots
    : [];
  const rankingPositions = Array.isArray(snapshot.rankingPositions)
    ? snapshot.rankingPositions
    : [];

  const baselineSnapshotFact = rankingSnapshots.find(
    (s) => s.snapshotId === baselineSnapshotId
  );
  const comparisonSnapshotFact = rankingSnapshots.find(
    (s) => s.snapshotId === comparisonSnapshotId
  );

  if (!baselineSnapshotFact || !comparisonSnapshotFact) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "movementCompare requires both baseline and comparison ranking snapshot facts to exist",
        "movementCompare",
        { baselineSnapshotId, comparisonSnapshotId }
      )
    );
  }

  if (baselineSnapshotFact.rankingSystemId !== comparisonSnapshotFact.rankingSystemId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_SYSTEM_MISMATCH,
        "Ranking movement comparison requires the same rankingSystemId",
        "movementCompare",
        {
          baselineRankingSystemId: baselineSnapshotFact.rankingSystemId,
          comparisonRankingSystemId: comparisonSnapshotFact.rankingSystemId,
        }
      )
    );
  }
  if (
    baselineSnapshotFact.rankingSystemVersion !==
    comparisonSnapshotFact.rankingSystemVersion
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_VERSION_MISMATCH,
        "Ranking movement comparison requires the same rankingSystemVersion",
        "movementCompare",
        {
          baselineRankingSystemVersion: baselineSnapshotFact.rankingSystemVersion,
          comparisonRankingSystemVersion: comparisonSnapshotFact.rankingSystemVersion,
        }
      )
    );
  }
  if (
    baselineSnapshotFact.entityType !== undefined &&
    comparisonSnapshotFact.entityType !== undefined &&
    baselineSnapshotFact.entityType !== comparisonSnapshotFact.entityType
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_COMPATIBILITY_VIOLATION,
        "Ranking movement comparison requires the same entityType",
        "movementCompare",
        {
          baselineEntityType: baselineSnapshotFact.entityType,
          comparisonEntityType: comparisonSnapshotFact.entityType,
        }
      )
    );
  }
  if (baselineSnapshotFact.rankDirection !== comparisonSnapshotFact.rankDirection) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_COMPATIBILITY_VIOLATION,
        "Ranking movement comparison requires matching rankDirection metadata",
        "movementCompare",
        {
          baselineRankDirection: baselineSnapshotFact.rankDirection,
          comparisonRankDirection: comparisonSnapshotFact.rankDirection,
        }
      )
    );
  }

  const rankDirection = baselineSnapshotFact.rankDirection || RANK_DIRECTION.UNKNOWN;
  const rankDirectionInterpretedAsBetter =
    rankDirection === RANK_DIRECTION.ASCENDING_BETTER ||
    rankDirection === RANK_DIRECTION.DESCENDING_BETTER;

  const baselineMap = new Map();
  for (const position of rankingPositions) {
    if (position.snapshotId === baselineSnapshotId) {
      baselineMap.set(position.entityId, position.rank);
    }
  }
  const comparisonMap = new Map();
  for (const position of rankingPositions) {
    if (position.snapshotId === comparisonSnapshotId) {
      comparisonMap.set(position.entityId, position.rank);
    }
  }

  let movementUpCount = 0;
  let movementDownCount = 0;
  let movementUnchangedCount = 0;
  let absoluteChangeSum = 0;
  let matchedEntityCount = 0;

  for (const [entityId, baselineRank] of baselineMap.entries()) {
    if (!comparisonMap.has(entityId)) continue;
    const comparisonRank = comparisonMap.get(entityId);
    matchedEntityCount += 1;
    const delta = comparisonRank - baselineRank;
    absoluteChangeSum += Math.abs(delta);
    if (delta < 0) movementUpCount += 1;
    else if (delta > 0) movementDownCount += 1;
    else movementUnchangedCount += 1;
  }

  const movementAverageAbsoluteChange = safeRate(absoluteChangeSum, matchedEntityCount);

  return ok(
    deepFreeze({
      baselineSnapshotId,
      comparisonSnapshotId,
      rankingSystemId: baselineSnapshotFact.rankingSystemId,
      rankingSystemVersion: baselineSnapshotFact.rankingSystemVersion,
      rankDirection,
      rankDirectionInterpretedAsBetter,
      matchedEntityCount,
      movementUpCount,
      movementDownCount,
      movementUnchangedCount,
      movementAverageAbsoluteChange,
      rankingRecalculated: false,
      analyticalMethodVersion:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.RANKING_MOVEMENT,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @param {{ movementCompare?: { baselineSnapshotId: string, comparisonSnapshotId: string } }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectRankingSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "projectRankingSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const rankingSnapshots = Array.isArray(snapshot.rankingSnapshots)
    ? snapshot.rankingSnapshots
    : [];
  const rankingPositions = Array.isArray(snapshot.rankingPositions)
    ? snapshot.rankingPositions
    : [];

  const rankingSnapshotsCount = rankingSnapshots.length;
  const rankedEntityIds = new Set(
    rankingPositions.filter((p) => isNonEmptyString(p.entityId)).map((p) => p.entityId)
  );
  const positionsDistribution = countBy(rankingPositions, (p) =>
    Number.isFinite(p.rank) ? String(p.rank) : undefined
  );

  /** @type {unknown | null} */
  let movement = null;
  if (options.movementCompare) {
    const movementResult = projectRankingMovement(snapshot, options.movementCompare);
    if (!movementResult.ok) return movementResult;
    movement = movementResult.value;
  }

  return ok(
    deepFreeze({
      rankingSnapshotsCount,
      rankedEntityCount: rankedEntityIds.size,
      positionsDistribution,
      movement,
      standingsCalculated: false,
      rankingCalculated: false,
      analyticalMethodVersion:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.RANKING_SUMMARY,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectRatingSummary(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "projectRatingSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const ratingSnapshots = Array.isArray(snapshot.ratingSnapshots)
    ? snapshot.ratingSnapshots
    : [];
  const ratingChanges = Array.isArray(snapshot.ratingChanges) ? snapshot.ratingChanges : [];

  const ratingSnapshotsCount = ratingSnapshots.length;
  const ratedEntityIds = new Set(
    ratingSnapshots.filter((s) => isNonEmptyString(s.entityId)).map((s) => s.entityId)
  );

  const ratingChangesCount = ratingChanges.length;
  let sum = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let unchangedCount = 0;
  for (const change of ratingChanges) {
    if (!isFiniteNumber(change.delta)) continue;
    sum += change.delta;
    if (change.delta > 0) positiveCount += 1;
    else if (change.delta < 0) negativeCount += 1;
    else unchangedCount += 1;
  }
  const ratingChangesAverage = safeRate(sum, ratingChangesCount);

  return ok(
    deepFreeze({
      ratingSnapshotsCount,
      ratedEntityCount: ratedEntityIds.size,
      ratingChangesCount,
      ratingChangesAverage,
      ratingChangesPositiveCount: positiveCount,
      ratingChangesNegativeCount: negativeCount,
      ratingChangesUnchangedCount: unchangedCount,
      ratingCalculated: false,
      ratingRecalculated: false,
      analyticalMethodVersion:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.RATING_SUMMARY,
    })
  );
}

/**
 * @param {unknown} outcome
 * @returns {boolean}
 */
function isAcceptedOutcome(outcome) {
  return String(outcome.validationStatus || "").trim().toLowerCase() === "accepted";
}

/**
 * @param {unknown} match
 * @returns {boolean}
 */
function isPlayedMatch(match) {
  const status = String(match.lifecycleStatus || "").toUpperCase();
  return status === "PLAYED" || status === "COMPLETED";
}

/**
 * @param {unknown} match
 * @returns {boolean}
 */
function isCompletedMatch(match) {
  if (match.completed === true) return true;
  return String(match.lifecycleStatus || "").toUpperCase() === "COMPLETED";
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectPerformanceSummary(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "projectPerformanceSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const participations = Array.isArray(snapshot.participations) ? snapshot.participations : [];
  const matches = Array.isArray(snapshot.matches) ? snapshot.matches : [];
  const outcomes = Array.isArray(snapshot.outcomes) ? snapshot.outcomes : [];

  const participationCount = participations.length;

  const playedMatches = matches.filter(isPlayedMatch);
  const matchesPlayedCount = playedMatches.length;
  const completedMatches = matches.filter(isCompletedMatch);
  const matchesCompletedCount = completedMatches.length;

  const acceptedOutcomes = outcomes.filter(isAcceptedOutcome);
  const winCount = acceptedOutcomes.filter((o) => o.outcome === "win").length;
  const lossCount = acceptedOutcomes.filter((o) => o.outcome === "loss").length;
  const drawCount = acceptedOutcomes.filter((o) => o.outcome === "draw").length;
  const otherCount = acceptedOutcomes.filter(
    (o) => o.outcome === "other" || o.outcome === "unknown"
  ).length;
  const validatedResultsCount = acceptedOutcomes.length;

  const winRateDenominator = drawCount > 0 ? winCount + lossCount + drawCount : winCount + lossCount;
  const winRate = safeRate(winCount, winRateDenominator);
  const completionRate = safeRate(matchesCompletedCount, matchesPlayedCount);

  return ok(
    deepFreeze({
      participationCount,
      matchesPlayedCount,
      matchesCompletedCount,
      outcomesWinCount: winCount,
      outcomesLossCount: lossCount,
      outcomesDrawCount: drawCount,
      outcomesOtherCount: otherCount,
      validatedResultsCount,
      winRate,
      completionRate,
      winnerInferredFromScore: false,
      performanceScoreInvented: false,
      analyticalMethodVersion:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.PERFORMANCE_SUMMARY,
    })
  );
}

/**
 * Compose full Finance / Ranking / Performance analytics summary.
 * @param {unknown} snapshot
 * @param {{
 *   timeWindow?: unknown,
 *   generatedAt?: string,
 *   movementCompare?: { baselineSnapshotId: string, comparisonSnapshotId: string },
 *   requireSingleCurrency?: boolean,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectFinanceRankingPerformanceSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SNAPSHOT_INVALID,
        "projectFinanceRankingPerformanceSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const finance = projectFinanceSummary(snapshot, {
    requireSingleCurrency: options.requireSingleCurrency,
  });
  if (!finance.ok) return finance;
  const ranking = projectRankingSummary(snapshot, {
    movementCompare: options.movementCompare,
  });
  if (!ranking.ok) return ranking;
  const rating = projectRatingSummary(snapshot);
  if (!rating.ok) return rating;
  const performance = projectPerformanceSummary(snapshot);
  if (!performance.ok) return performance;

  /** @type {unknown[]} */
  const warnings = [];
  if (Array.isArray(snapshot.warnings)) {
    for (const w of snapshot.warnings) warnings.push(w);
  }
  if (snapshot.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_FINANCE_RANKING_PERFORMANCE_STALE_SOURCE",
      message: "Source snapshot freshness is STALE",
      field: "freshness",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  const incompleteSnapshot =
    snapshot.completeness === FINANCE_RANKING_PERFORMANCE_ANALYTICS_COMPLETENESS.PARTIAL ||
    snapshot.completeness === FINANCE_RANKING_PERFORMANCE_ANALYTICS_COMPLETENESS.UNKNOWN;

  const context = isPlainObject(snapshot.context) ? snapshot.context : {};

  return ok(
    deepFreeze(
      clonePlain({
        tenantId: context.tenantScope?.tenantId,
        accountingContextId: context.accountingContextId,
        rankingSystemId: context.rankingSystemId,
        rankingSystemVersion: context.rankingSystemVersion,
        ratingSystemId: context.ratingSystemId,
        ratingSystemVersion: context.ratingSystemVersion,
        competitionId: context.competitionId,
        playerId: context.playerId,
        teamId: context.teamId,
        currencyCode: context.currencyCode,
        ...finance.value,
        ...ranking.value,
        ...rating.value,
        ...performance.value,
        provenance: snapshot.provenance,
        freshness: snapshot.freshness,
        completeness: snapshot.completeness,
        incompleteSnapshot,
        sourceTimestamp: snapshot.sourceTimestamp,
        canonicalSourceRef: snapshot.canonicalSourceRef,
        generatedAt: options.generatedAt,
        warnings: Object.freeze(warnings),
        analyticalMethodVersion: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.SUMMARY,
        ledgerPosted: false,
        revenueRecognizedByAnalytics: false,
        currencyConverted: false,
        rankingCalculated: false,
        ratingCalculated: false,
        standingsCalculated: false,
        scoreRecalculated: false,
        winnerInferredFromScore: false,
        performanceScoreInvented: false,
        isCanonicalFinanceState: false,
        isCanonicalRankingState: false,
        isCanonicalRatingState: false,
        isCanonicalPerformanceState: false,
        isCanonicalModuleState: false,
        privacySafe: true,
        financialDataSafe: true,
      })
    )
  );
}

export { safeRate };
