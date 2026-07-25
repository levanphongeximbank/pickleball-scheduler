/**
 * I&A-09 — Finance, Ranking and Performance Analytics certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(__dirname, "../src/features/intelligence-analytics");
const FRPA_ROOT = join(MODULE_ROOT, "finance-ranking-performance-analytics");

const SOURCE = Object.freeze({
  sourceId: "finance-ranking-performance-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-09-certification",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-20T12:00:00.000Z",
  ingestedAt: "2026-07-20T12:05:00.000Z",
  transformer: "in-memory-finance-ranking-performance-analytics",
});

const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const TENANT = "tenant-a";
const CURRENCY = "VND";
const PLAYER_A = "player-1";
const PLAYER_B = "player-2";
const TEAM_A = "team-1";
const COMPETITION_A = "comp-1";
const RANKING_SYSTEM = "rank-sys-1";
const RANKING_VERSION = "v1";
const RATING_SYSTEM = "rating-sys-1";
const RATING_VERSION = "v1";

function tenantScope(overrides = {}) {
  return {
    kind: IA.ANALYTICS_TENANT_SCOPE_KIND.TENANT,
    tenantId: TENANT,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    tenantScope: tenantScope(),
    ...overrides,
  };
}

function identity(overrides = {}) {
  return {
    tenantId: TENANT,
    provenance: PROVENANCE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    canonicalSourceRef: "explicit-certification-snapshot",
    ...overrides,
  };
}

function money(amountMinor, overrides = {}) {
  return { currencyCode: CURRENCY, amountMinor, ...overrides };
}

function baseSnapshot(overrides = {}) {
  return {
    context: context(),
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    completeness: IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_COMPLETENESS.COMPLETE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    transactions: [
      { ...identity(), transactionId: "txn-1", status: "POSTED", amount: money(10000) },
      { ...identity(), transactionId: "txn-2", status: "PENDING", amount: money(5000) },
    ],
    invoices: [
      {
        ...identity(),
        invoiceId: "inv-1",
        status: "ISSUED",
        issuedAt: "2026-07-01T00:00:00.000Z",
      },
      { ...identity(), invoiceId: "inv-2", status: "DRAFT" },
    ],
    payments: [
      { ...identity(), paymentId: "pay-1", status: "SETTLED", amount: money(10000) },
      { ...identity(), paymentId: "pay-2", status: "PENDING", amount: money(3000) },
    ],
    refunds: [
      { ...identity(), refundId: "ref-1", status: "SETTLED", amount: money(2000) },
      { ...identity(), refundId: "ref-2", status: "PENDING", amount: money(500) },
    ],
    settlements: [{ ...identity(), settlementId: "settle-1", status: "COMPLETED" }],
    receivables: [
      { ...identity(), receivableId: "rec-1", status: "OUTSTANDING", amount: money(4000) },
      {
        ...identity(),
        receivableId: "rec-2",
        status: "OVERDUE",
        overdue: true,
        amount: money(1500),
      },
    ],
    recognizedAmounts: [
      {
        ...identity(),
        recognitionId: "rec-amt-1",
        kind: "revenue",
        amount: money(8000),
        recognitionStatus: "RECOGNIZED",
      },
      {
        ...identity(),
        recognitionId: "rec-amt-2",
        kind: "expense",
        amount: money(3000),
        recognized: true,
      },
    ],
    rankingSystems: [
      {
        ...identity(),
        rankingSystemId: RANKING_SYSTEM,
        rankingSystemVersion: RANKING_VERSION,
        entityType: "player",
      },
    ],
    rankingSnapshots: [
      {
        ...identity(),
        snapshotId: "rank-snap-1",
        rankingSystemId: RANKING_SYSTEM,
        rankingSystemVersion: RANKING_VERSION,
        rankDirection: IA.RANK_DIRECTION.ASCENDING_BETTER,
        entityType: "player",
      },
      {
        ...identity(),
        snapshotId: "rank-snap-2",
        rankingSystemId: RANKING_SYSTEM,
        rankingSystemVersion: RANKING_VERSION,
        rankDirection: IA.RANK_DIRECTION.ASCENDING_BETTER,
        entityType: "player",
      },
    ],
    rankingPositions: [
      {
        ...identity(),
        snapshotId: "rank-snap-1",
        rankingSystemId: RANKING_SYSTEM,
        rankingSystemVersion: RANKING_VERSION,
        entityId: PLAYER_A,
        rank: 3,
        entityType: "player",
      },
      {
        ...identity(),
        snapshotId: "rank-snap-1",
        rankingSystemId: RANKING_SYSTEM,
        rankingSystemVersion: RANKING_VERSION,
        entityId: PLAYER_B,
        rank: 5,
        entityType: "player",
      },
      {
        ...identity(),
        snapshotId: "rank-snap-2",
        rankingSystemId: RANKING_SYSTEM,
        rankingSystemVersion: RANKING_VERSION,
        entityId: PLAYER_A,
        rank: 1,
        entityType: "player",
      },
      {
        ...identity(),
        snapshotId: "rank-snap-2",
        rankingSystemId: RANKING_SYSTEM,
        rankingSystemVersion: RANKING_VERSION,
        entityId: PLAYER_B,
        rank: 5,
        entityType: "player",
      },
    ],
    ratingSnapshots: [
      {
        ...identity(),
        snapshotId: "rating-snap-1",
        ratingSystemId: RATING_SYSTEM,
        ratingSystemVersion: RATING_VERSION,
        entityId: PLAYER_A,
        ratingValue: 1500,
      },
      {
        ...identity(),
        snapshotId: "rating-snap-2",
        ratingSystemId: RATING_SYSTEM,
        ratingSystemVersion: RATING_VERSION,
        entityId: PLAYER_B,
        ratingValue: 1600,
      },
    ],
    ratingChanges: [
      {
        ...identity(),
        changeId: "rchg-1",
        ratingSystemId: RATING_SYSTEM,
        ratingSystemVersion: RATING_VERSION,
        entityId: PLAYER_A,
        delta: 15,
      },
      {
        ...identity(),
        changeId: "rchg-2",
        ratingSystemId: RATING_SYSTEM,
        ratingSystemVersion: RATING_VERSION,
        entityId: PLAYER_B,
        delta: -10,
      },
      {
        ...identity(),
        changeId: "rchg-3",
        ratingSystemId: RATING_SYSTEM,
        ratingSystemVersion: RATING_VERSION,
        entityId: PLAYER_A,
        beforeValue: 1500,
        afterValue: 1500,
      },
    ],
    participations: [
      {
        ...identity(),
        participationId: "part-1",
        entityId: PLAYER_A,
        entityType: "player",
        competitionId: COMPETITION_A,
      },
      {
        ...identity(),
        participationId: "part-2",
        entityId: PLAYER_B,
        entityType: "player",
        competitionId: COMPETITION_A,
      },
    ],
    matches: [
      {
        ...identity(),
        matchId: "match-1",
        entityId: PLAYER_A,
        entityType: "player",
        lifecycleStatus: "COMPLETED",
        completed: true,
        competitionId: COMPETITION_A,
      },
      {
        ...identity(),
        matchId: "match-2",
        entityId: PLAYER_B,
        entityType: "player",
        lifecycleStatus: "SCHEDULED",
        competitionId: COMPETITION_A,
      },
    ],
    outcomes: [
      {
        ...identity(),
        outcomeId: "out-1",
        matchId: "match-1",
        entityId: PLAYER_A,
        entityType: "player",
        outcome: "win",
        validationStatus: "accepted",
      },
      {
        ...identity(),
        outcomeId: "out-2",
        matchId: "match-1",
        entityId: PLAYER_B,
        entityType: "player",
        outcome: "loss",
        validationStatus: "accepted",
      },
      {
        ...identity(),
        outcomeId: "out-3",
        matchId: "match-2",
        entityId: PLAYER_A,
        entityType: "player",
        outcome: "win",
        validationStatus: "rejected",
      },
      {
        ...identity(),
        outcomeId: "out-4",
        matchId: "match-2",
        entityId: PLAYER_B,
        entityType: "player",
        outcome: "unknown",
        validationStatus: "accepted",
      },
    ],
    ...overrides,
  };
}

function buildSource(snapshotOverrides = {}, adapterExtras = {}) {
  const source = IA.createInMemoryFinanceRankingPerformanceAnalyticsSource({
    snapshot: baseSnapshot(snapshotOverrides),
    ...adapterExtras,
  });
  assert.equal(source.ok, true, source.error?.message);
  return source.value;
}

function buildFacade(snapshotOverrides = {}, adapterExtras = {}) {
  const sourceAdapter = buildSource(snapshotOverrides, adapterExtras);
  const facade = IA.createFinanceRankingPerformanceAnalyticsFacade({
    sourceAdapter,
    nowIso: () => FIXED_NOW,
  });
  assert.equal(facade.ok, true, facade.error?.message);
  return { facade: facade.value, sourceAdapter };
}

function listJsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...listJsFiles(full));
    else if (entry.endsWith(".js")) files.push(full);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

test("public exports include I&A-09 finance/ranking/performance analytics API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_FINANCE_RANKING_PERFORMANCE_ANALYTICS.workstreamId,
    "I&A-09"
  );
  assert.equal(typeof IA.createFinanceRankingPerformanceAnalyticsFacade, "function");
  assert.equal(typeof IA.projectFinanceRankingPerformanceSummary, "function");
});

test("validate does not call source", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createFinanceRankingPerformanceAnalyticsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const validated = facade.value.validate({ context: context() });
  assert.equal(validated.ok, true);
  assert.equal(loadCalls, 0);
});

// ---------------------------------------------------------------------------
// 1-4. Context / tenant isolation
// ---------------------------------------------------------------------------

test("1. valid analytics context is created", () => {
  const result = IA.createFinanceRankingPerformanceAnalyticsContext(
    context({ currencyCode: CURRENCY, playerId: PLAYER_A })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.currencyCode, CURRENCY);
  assert.equal(result.value.playerId, PLAYER_A);
  assert.ok(Object.isFrozen(result.value));
});

test("2. missing tenant is rejected", () => {
  const result = IA.createFinanceRankingPerformanceAnalyticsContext({
    currencyCode: CURRENCY,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED);
});

test("3. source tenant mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ tenantScope: { kind: "tenant", tenantId: "other-tenant" } }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TENANT_MISMATCH
  );
});

test("4. mixed-tenant facts are rejected", () => {
  const snapshot = IA.createFinanceRankingPerformanceAnalyticsSnapshot({
    context: context(),
    transactions: [
      { ...identity(), transactionId: "txn-a", status: "POSTED", amount: money(1000) },
      {
        ...identity({ tenantId: "tenant-b" }),
        transactionId: "txn-b",
        status: "POSTED",
        amount: money(1000),
      },
    ],
  });
  assert.equal(snapshot.ok, true);
  const guard = IA.guardFinanceRankingPerformanceAnalyticsSnapshot(context(), snapshot.value);
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TENANT_MISMATCH
  );
});

// ---------------------------------------------------------------------------
// 5-9. Analytical money
// ---------------------------------------------------------------------------

test("5. AnalyticalMoney preserves currency/amount/scale", () => {
  const result = IA.createAnalyticalMoney({
    currencyCode: CURRENCY,
    amountMinor: 12345,
    scale: 2,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.currencyCode, CURRENCY);
  assert.equal(result.value.amountMinor, 12345);
  assert.equal(result.value.scale, 2);
  assert.ok(Object.isFrozen(result.value));
});

test("6. AnalyticalMoney defaults scale to 0", () => {
  const result = IA.createAnalyticalMoney({ currencyCode: CURRENCY, amountMinor: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.value.scale, 0);
});

test("7. AnalyticalMoney rejects floating-point amountMinor", () => {
  const result = IA.createAnalyticalMoney({ currencyCode: CURRENCY, amountMinor: 10.5 });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID
  );
});

test("8. AnalyticalMoney rejects NaN/Infinity amountMinor", () => {
  const nanResult = IA.createAnalyticalMoney({ currencyCode: CURRENCY, amountMinor: NaN });
  assert.equal(nanResult.ok, false);
  const infResult = IA.createAnalyticalMoney({
    currencyCode: CURRENCY,
    amountMinor: Infinity,
  });
  assert.equal(infResult.ok, false);
});

test("9. AnalyticalMoney rejects empty currencyCode", () => {
  const result = IA.createAnalyticalMoney({ currencyCode: "", amountMinor: 100 });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID
  );
});

test("10. sumCompatibleAnalyticalMoney sums same-currency amounts", () => {
  const result = IA.sumCompatibleAnalyticalMoney([money(100), money(200), money(300)]);
  assert.equal(result.ok, true);
  assert.equal(result.value.amountMinor, 600);
  assert.equal(result.value.currencyCode, CURRENCY);
});

test("11. assertSameCurrency / sumCompatibleAnalyticalMoney reject mixed currency", () => {
  const assertResult = IA.assertSameCurrency([money(100), money(200, { currencyCode: "USD" })]);
  assert.equal(assertResult.ok, false);
  assert.equal(
    assertResult.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH
  );

  const sumResult = IA.sumCompatibleAnalyticalMoney([
    money(100),
    money(200, { currencyCode: "USD" }),
  ]);
  assert.equal(sumResult.ok, false);
  assert.equal(
    sumResult.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH
  );
});

test("12. mixed-currency scalar sum in projections fails closed when required", () => {
  const result = IA.projectFinanceSummary(
    IA.createFinanceRankingPerformanceAnalyticsSnapshot(
      baseSnapshot({
        payments: [
          { ...identity(), paymentId: "pay-usd", status: "SETTLED", amount: money(100, { currencyCode: "USD" }) },
          { ...identity(), paymentId: "pay-vnd", status: "SETTLED", amount: money(100) },
        ],
      })
    ).value,
    { requireSingleCurrency: true }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH
  );
});

test("13. mixed-currency summary exposes amountsByCurrency instead of a single total", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(
    baseSnapshot({
      payments: [
        { ...identity(), paymentId: "pay-usd", status: "SETTLED", amount: money(100, { currencyCode: "USD" }) },
        { ...identity(), paymentId: "pay-vnd", status: "SETTLED", amount: money(100) },
      ],
    })
  );
  assert.equal(snapshotResult.ok, true);
  const result = IA.projectFinanceSummary(snapshotResult.value);
  assert.equal(result.ok, true);
  assert.equal(result.value.paymentsSettledAmount, null);
  assert.ok(result.value.paymentsSettledAmountsByCurrency.USD);
  assert.ok(result.value.paymentsSettledAmountsByCurrency.VND);
});

// ---------------------------------------------------------------------------
// 14-25. Finance projections
// ---------------------------------------------------------------------------

test("14. transaction count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.transactionsCount, 2);
});

test("15. transaction status distribution is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.transactionsStatusDistribution.POSTED, 1);
  assert.equal(result.value.summary.transactionsStatusDistribution.PENDING, 1);
});

test("16. invoice issued count only counts explicit ISSUED / issuedAt", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.invoicesIssuedCount, 1);
  assert.equal(result.value.summary.invoicesStatusDistribution.ISSUED, 1);
  assert.equal(result.value.summary.invoicesStatusDistribution.DRAFT, 1);
});

test("17. payment count and settled count/amount are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.paymentsCount, 2);
  assert.equal(result.value.summary.paymentsSettledCount, 1);
  assert.equal(result.value.summary.paymentsSettledAmount.amountMinor, 10000);
});

test("18. settled === true also counts as settled (not only status)", () => {
  const { facade } = buildFacade({
    payments: [
      { ...identity(), paymentId: "pay-x", status: "CUSTOM_STATUS", settled: true, amount: money(7000) },
    ],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.paymentsSettledCount, 1);
  assert.equal(result.value.summary.paymentsSettledAmount.amountMinor, 7000);
});

test("19. refund count and settled amount are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.refundsCount, 2);
  assert.equal(result.value.summary.refundsSettledAmount.amountMinor, 2000);
});

test("20. settlement count and status distribution are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.settlementsCount, 1);
  assert.equal(result.value.summary.settlementsStatusDistribution.COMPLETED, 1);
});

test("21. receivable outstanding count/amount are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.receivablesOutstandingCount, 1);
  assert.equal(result.value.summary.receivablesOutstandingAmount.amountMinor, 4000);
});

test("22. receivable overdue is explicit only (never inferred from dates)", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.receivablesOverdueCount, 1);
  assert.equal(result.value.summary.receivablesOverdueAmount.amountMinor, 1500);
  assert.equal(result.value.summary.overdueInferredFromDates, false);
});

test("22b. createFinanceReceivableFact rejects non-boolean overdue (never inferred from dates)", () => {
  const fact = IA.createFinanceReceivableFact({
    ...identity(),
    receivableId: "rec-bad",
    status: "OUTSTANDING",
    amount: money(1000),
    overdue: "yes",
  });
  assert.equal(fact.ok, false);
  assert.equal(
    fact.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID
  );
});

test("23. collections rate is computed and zero denominator returns null (never Infinity)", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.collectionsRate, 0.5);

  const { facade: emptyFacade } = buildFacade({
    payments: [],
    receivables: [],
  });
  const emptyResult = emptyFacade.analyze({ context: context() });
  assert.equal(emptyResult.ok, true);
  assert.equal(emptyResult.value.summary.collectionsRate, null);
  assert.notEqual(emptyResult.value.summary.collectionsRate, Infinity);
});

test("24. recognized revenue/expense amounts are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.revenueRecognizedAmount.amountMinor, 8000);
  assert.equal(result.value.summary.expensesRecognizedAmount.amountMinor, 3000);
});

test("25. createFinanceRecognizedAmountFact requires explicit recognition", () => {
  const fact = IA.createFinanceRecognizedAmountFact({
    ...identity(),
    recognitionId: "rec-amt-bad",
    kind: "revenue",
    amount: money(1000),
  });
  assert.equal(fact.ok, false);
  assert.equal(
    fact.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RECOGNITION_INVALID
  );
});

// ---------------------------------------------------------------------------
// 26-28. Booking/payment must never become revenue
// ---------------------------------------------------------------------------

test("26. payments are never counted as recognized revenue", () => {
  const { facade } = buildFacade({
    payments: [
      { ...identity(), paymentId: "pay-huge", status: "SETTLED", amount: money(999999) },
    ],
    recognizedAmounts: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.revenueRecognizedAmount, null);
  assert.equal(result.value.summary.paymentsSettledAmount.amountMinor, 999999);
});

test("27. transactions are never counted as recognized revenue", () => {
  const { facade } = buildFacade({
    transactions: [
      { ...identity(), transactionId: "txn-huge", status: "POSTED", amount: money(999999) },
    ],
    recognizedAmounts: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.revenueRecognizedAmount, null);
});

test("28. bookingOrPaymentTreatedAsRevenue capability flag is always false", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.bookingOrPaymentTreatedAsRevenue, false);
});

// ---------------------------------------------------------------------------
// 29-38. Ranking + movement
// ---------------------------------------------------------------------------

test("29. ranking snapshot count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.rankingSnapshotsCount, 2);
});

test("30. ranked entity count is distinct across positions", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.rankedEntityCount, 2);
});

test("31. positions distribution buckets by rank value", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.positionsDistribution["5"], 2);
  assert.equal(result.value.summary.positionsDistribution["3"], 1);
  assert.equal(result.value.summary.positionsDistribution["1"], 1);
});

test("32. ranking movement compares compatible snapshots only", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(baseSnapshot());
  assert.equal(snapshotResult.ok, true);
  const movement = IA.projectRankingMovement(snapshotResult.value, {
    baselineSnapshotId: "rank-snap-1",
    comparisonSnapshotId: "rank-snap-2",
  });
  assert.equal(movement.ok, true);
  assert.equal(movement.value.movementUpCount, 1);
  assert.equal(movement.value.movementDownCount, 0);
  assert.equal(movement.value.movementUnchangedCount, 1);
  assert.equal(movement.value.movementAverageAbsoluteChange, 1);
});

test("33. ranking movement reports direction interpretation only when explicit", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(baseSnapshot());
  const movement = IA.projectRankingMovement(snapshotResult.value, {
    baselineSnapshotId: "rank-snap-1",
    comparisonSnapshotId: "rank-snap-2",
  });
  assert.equal(movement.ok, true);
  assert.equal(movement.value.rankDirectionInterpretedAsBetter, true);
  assert.equal(movement.value.rankDirection, IA.RANK_DIRECTION.ASCENDING_BETTER);
});

test("34. ranking movement is UNKNOWN direction when not explicit and still numeric-only", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(
    baseSnapshot({
      rankingSnapshots: [
        {
          ...identity(),
          snapshotId: "rank-snap-1",
          rankingSystemId: RANKING_SYSTEM,
          rankingSystemVersion: RANKING_VERSION,
        },
        {
          ...identity(),
          snapshotId: "rank-snap-2",
          rankingSystemId: RANKING_SYSTEM,
          rankingSystemVersion: RANKING_VERSION,
        },
      ],
    })
  );
  assert.equal(snapshotResult.ok, true);
  const movement = IA.projectRankingMovement(snapshotResult.value, {
    baselineSnapshotId: "rank-snap-1",
    comparisonSnapshotId: "rank-snap-2",
  });
  assert.equal(movement.ok, true);
  assert.equal(movement.value.rankDirection, IA.RANK_DIRECTION.UNKNOWN);
  assert.equal(movement.value.rankDirectionInterpretedAsBetter, false);
});

test("35. ranking movement rejects mismatched ranking system", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(
    baseSnapshot({
      rankingSnapshots: [
        {
          ...identity(),
          snapshotId: "rank-snap-1",
          rankingSystemId: "sys-a",
          rankingSystemVersion: RANKING_VERSION,
        },
        {
          ...identity(),
          snapshotId: "rank-snap-2",
          rankingSystemId: "sys-b",
          rankingSystemVersion: RANKING_VERSION,
        },
      ],
    })
  );
  assert.equal(snapshotResult.ok, true);
  const movement = IA.projectRankingMovement(snapshotResult.value, {
    baselineSnapshotId: "rank-snap-1",
    comparisonSnapshotId: "rank-snap-2",
  });
  assert.equal(movement.ok, false);
  assert.equal(
    movement.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_SYSTEM_MISMATCH
  );
});

test("36. ranking movement rejects mismatched version", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(
    baseSnapshot({
      rankingSnapshots: [
        {
          ...identity(),
          snapshotId: "rank-snap-1",
          rankingSystemId: RANKING_SYSTEM,
          rankingSystemVersion: "v1",
        },
        {
          ...identity(),
          snapshotId: "rank-snap-2",
          rankingSystemId: RANKING_SYSTEM,
          rankingSystemVersion: "v2",
        },
      ],
    })
  );
  assert.equal(snapshotResult.ok, true);
  const movement = IA.projectRankingMovement(snapshotResult.value, {
    baselineSnapshotId: "rank-snap-1",
    comparisonSnapshotId: "rank-snap-2",
  });
  assert.equal(movement.ok, false);
  assert.equal(
    movement.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_VERSION_MISMATCH
  );
});

test("37. ranking is never (re)calculated by analytics", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.rankingCalculated, false);
  assert.equal(result.value.summary.standingsCalculated, false);
});

test("38. ranking movement via facade query.movementCompare", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    movementCompare: { baselineSnapshotId: "rank-snap-1", comparisonSnapshotId: "rank-snap-2" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.movement.movementUpCount, 1);
});

// ---------------------------------------------------------------------------
// 39-45. Rating (never recalculated)
// ---------------------------------------------------------------------------

test("39. rating snapshot count and rated entity count are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.ratingSnapshotsCount, 2);
  assert.equal(result.value.summary.ratedEntityCount, 2);
});

test("40. rating changes count/average/pos/neg/unchanged are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.ratingChangesCount, 3);
  assert.ok(Math.abs(result.value.summary.ratingChangesAverage - 5 / 3) < 1e-9);
  assert.equal(result.value.summary.ratingChangesPositiveCount, 1);
  assert.equal(result.value.summary.ratingChangesNegativeCount, 1);
  assert.equal(result.value.summary.ratingChangesUnchangedCount, 1);
});

test("41. rating change delta is derived from before/after without recalculation", () => {
  const fact = IA.createRatingChangeFact({
    ...identity(),
    changeId: "rchg-derived",
    ratingSystemId: RATING_SYSTEM,
    ratingSystemVersion: RATING_VERSION,
    entityId: PLAYER_A,
    beforeValue: 1000,
    afterValue: 1025,
  });
  assert.equal(fact.ok, true);
  assert.equal(fact.value.delta, 25);
  assert.equal(fact.value.deltaDerived, true);
});

test("42. rating change explicit delta is preserved as-is", () => {
  const fact = IA.createRatingChangeFact({
    ...identity(),
    changeId: "rchg-explicit",
    ratingSystemId: RATING_SYSTEM,
    ratingSystemVersion: RATING_VERSION,
    entityId: PLAYER_A,
    delta: 42,
  });
  assert.equal(fact.ok, true);
  assert.equal(fact.value.delta, 42);
  assert.equal(fact.value.deltaDerived, false);
});

test("43. rating change requires delta or before/after", () => {
  const fact = IA.createRatingChangeFact({
    ...identity(),
    changeId: "rchg-bad",
    ratingSystemId: RATING_SYSTEM,
    ratingSystemVersion: RATING_VERSION,
    entityId: PLAYER_A,
  });
  assert.equal(fact.ok, false);
});

test("44. rating is never recalculated by analytics", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.ratingCalculated, false);
  assert.equal(result.value.summary.ratingRecalculated, false);
});

test("45. rating system mismatch is rejected by guard", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(baseSnapshot());
  assert.equal(snapshotResult.ok, true);
  const guard = IA.guardFinanceRankingPerformanceAnalyticsSnapshot(
    context({ ratingSystemId: "other-rating-system" }),
    snapshotResult.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RATING_SYSTEM_MISMATCH
  );
});

// ---------------------------------------------------------------------------
// 46-58. Performance
// ---------------------------------------------------------------------------

test("46. participation count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.participationCount, 2);
});

test("47. matches played/completed counts are correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.matchesPlayedCount, 1);
  assert.equal(result.value.summary.matchesCompletedCount, 1);
});

test("48. outcomes are only counted from validationStatus accepted", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.outcomesWinCount, 1);
  assert.equal(result.value.summary.outcomesLossCount, 1);
  assert.equal(result.value.summary.outcomesDrawCount, 0);
  assert.equal(result.value.summary.outcomesOtherCount, 1);
  assert.equal(result.value.summary.validatedResultsCount, 3);
});

test("49. rejected outcomes are never counted as validated (rejected != validated)", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  // out-3 has outcome "win" but validationStatus "rejected" and must not
  // contribute to outcomesWinCount / validatedResultsCount.
  assert.equal(result.value.summary.outcomesWinCount, 1);
  assert.equal(result.value.summary.validatedResultsCount, 3);
});

test("50. unknown outcome is never coerced to loss (unknown != loss)", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  // out-4 is accepted with outcome "unknown" and must land in "other", not loss.
  assert.equal(result.value.summary.outcomesLossCount, 1);
  assert.equal(result.value.summary.outcomesOtherCount, 1);
});

test("51. win rate uses accepted outcomes only and is null on zero denominator", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.winRate, 0.5);

  const { facade: emptyFacade } = buildFacade({ outcomes: [] });
  const emptyResult = emptyFacade.analyze({ context: context() });
  assert.equal(emptyResult.ok, true);
  assert.equal(emptyResult.value.summary.winRate, null);
  assert.notEqual(emptyResult.value.summary.winRate, Infinity);
});

test("52. completion rate is completed/played and null on zero denominator", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.completionRate, 1);

  const { facade: emptyFacade } = buildFacade({ matches: [] });
  const emptyResult = emptyFacade.analyze({ context: context() });
  assert.equal(emptyResult.ok, true);
  assert.equal(emptyResult.value.summary.completionRate, null);
});

test("53. winner is never inferred from score", () => {
  const fact = IA.createPerformanceOutcomeFact({
    ...identity(),
    outcomeId: "out-score",
    entityId: PLAYER_A,
    entityType: "player",
    outcome: "unknown",
    validationStatus: "accepted",
    scorePresent: true,
  });
  assert.equal(fact.ok, true);
  assert.equal(fact.value.outcome, "unknown");
  assert.equal(fact.value.scorePresent, true);
});

test("54. performance outcome requires explicit outcome and validationStatus", () => {
  const missingOutcome = IA.createPerformanceOutcomeFact({
    ...identity(),
    outcomeId: "out-bad",
    entityId: PLAYER_A,
    entityType: "player",
    validationStatus: "accepted",
  });
  assert.equal(missingOutcome.ok, false);

  const missingValidation = IA.createPerformanceOutcomeFact({
    ...identity(),
    outcomeId: "out-bad-2",
    entityId: PLAYER_A,
    entityType: "player",
    outcome: "win",
  });
  assert.equal(missingValidation.ok, false);
});

test("55. winnerInferredFromScore / performanceScoreInvented capability flags are false", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.winnerInferredFromScore, false);
  assert.equal(result.value.summary.performanceScoreInvented, false);
});

test("56. player scope mismatch is rejected by guard", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(baseSnapshot());
  assert.equal(snapshotResult.ok, true);
  const guard = IA.guardFinanceRankingPerformanceAnalyticsSnapshot(
    context({ playerId: "player-other" }),
    snapshotResult.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_PLAYER_MISMATCH
  );
});

test("57. team scope mismatch is rejected by guard", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(
    baseSnapshot({
      participations: [
        {
          ...identity(),
          participationId: "part-team",
          entityId: TEAM_A,
          entityType: "team",
          competitionId: COMPETITION_A,
        },
      ],
    })
  );
  assert.equal(snapshotResult.ok, true);
  const guard = IA.guardFinanceRankingPerformanceAnalyticsSnapshot(
    context({ teamId: "team-other" }),
    snapshotResult.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TEAM_MISMATCH
  );
});

test("58. competition scope mismatch is rejected by guard", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(baseSnapshot());
  assert.equal(snapshotResult.ok, true);
  const guard = IA.guardFinanceRankingPerformanceAnalyticsSnapshot(
    context({ competitionId: "comp-other" }),
    snapshotResult.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_COMPETITION_MISMATCH
  );
});

// ---------------------------------------------------------------------------
// 59-60. Currency guard
// ---------------------------------------------------------------------------

test("59. currency mismatch between context and facts is rejected by guard", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(baseSnapshot());
  assert.equal(snapshotResult.ok, true);
  const guard = IA.guardFinanceRankingPerformanceAnalyticsSnapshot(
    context({ currencyCode: "USD" }),
    snapshotResult.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH
  );
});

test("60. matching currency context passes guard", () => {
  const snapshotResult = IA.createFinanceRankingPerformanceAnalyticsSnapshot(baseSnapshot());
  assert.equal(snapshotResult.ok, true);
  const guard = IA.guardFinanceRankingPerformanceAnalyticsSnapshot(
    context({ currencyCode: CURRENCY }),
    snapshotResult.value
  );
  assert.equal(guard.ok, true);
});

// ---------------------------------------------------------------------------
// 61-63. Metrics
// ---------------------------------------------------------------------------

test("61. metric definitions have stable ID/version", () => {
  const defs = IA.createFinanceRankingPerformanceAnalyticsMetricDefinitions();
  assert.equal(defs.ok, true);
  assert.ok(defs.value.length >= 30);
  for (const def of defs.value) {
    assert.ok(def.metricId);
    assert.equal(def.version, "1.0.0");
  }
  assert.equal(
    IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_TRANSACTIONS_COUNT,
    "finance.transactions.count"
  );
  assert.equal(
    IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.PERFORMANCE_WIN_RATE,
    "performance.win_rate"
  );
});

test("62. monetary metric definitions document currency-safe aggregation", () => {
  const defs = IA.createFinanceRankingPerformanceAnalyticsMetricDefinitions();
  assert.equal(defs.ok, true);
  const settled = defs.value.find(
    (d) =>
      d.metricId ===
      IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_PAYMENTS_SETTLED_AMOUNT
  );
  assert.ok(settled);
  assert.ok(/currency-safe/i.test(settled.definition));
});

test("63. metric catalog registers validly via createMetricRegistry", () => {
  const entries = IA.createFinanceRankingPerformanceAnalyticsMetricCatalogEntries();
  assert.equal(entries.ok, true);
  const registry = IA.createMetricRegistry({ entries: entries.value });
  assert.equal(registry.ok, true);
  const found = registry.value.registry.getMetric(
    IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.PERFORMANCE_WIN_RATE,
    "1.0.0"
  );
  assert.equal(found.ok, true);
});

// ---------------------------------------------------------------------------
// 64-67. Historical observations (I&A-05 compatible)
// ---------------------------------------------------------------------------

test("64. historical observations compose via I&A-05", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ currencyCode: CURRENCY }),
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const hist = result.value.historicalObservations;
  assert.ok(hist.observations.length > 0);
  assert.equal(
    hist.analyticalMethodVersion,
    IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.HISTORICAL
  );
});

test("65. historical observations preserve currencyCode dimension", () => {
  const scopedContext = context({ currencyCode: CURRENCY });
  const { facade } = buildFacade({ context: scopedContext });
  const result = facade.analyze({
    context: scopedContext,
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const hist = result.value.historicalObservations;
  const txnObs = hist.observations.find(
    (o) => o.metricId === IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_TRANSACTIONS_COUNT
  );
  assert.ok(txnObs);
  assert.equal(txnObs.dimensions.currencyCode, CURRENCY);
  assert.equal(txnObs.value, 2);
});

test("66. historical observations preserve rankingSystemId/ratingSystemId dimensions", () => {
  const scopedContext = context({
    rankingSystemId: RANKING_SYSTEM,
    rankingSystemVersion: RANKING_VERSION,
    ratingSystemId: RATING_SYSTEM,
    ratingSystemVersion: RATING_VERSION,
  });
  const { facade } = buildFacade({ context: scopedContext });
  const result = facade.analyze({
    context: scopedContext,
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const hist = result.value.historicalObservations;
  const rankingObs = hist.observations.find(
    (o) => o.metricId === IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.RANKING_SNAPSHOTS_COUNT
  );
  assert.ok(rankingObs);
  assert.equal(rankingObs.dimensions.rankingSystemId, RANKING_SYSTEM);
  assert.equal(rankingObs.dimensions.rankingSystemVersion, RANKING_VERSION);
  assert.equal(rankingObs.dimensions.ratingSystemId, RATING_SYSTEM);
  assert.equal(rankingObs.dimensions.ratingSystemVersion, RATING_VERSION);
});

test("67. historical observations preserve playerId/teamId/competitionId dimensions", () => {
  const scopedContext = context({ playerId: PLAYER_A, competitionId: COMPETITION_A });
  const { facade } = buildFacade({
    context: scopedContext,
    participations: [
      {
        ...identity(),
        participationId: "part-1",
        entityId: PLAYER_A,
        entityType: "player",
        competitionId: COMPETITION_A,
      },
    ],
    rankingPositions: [],
    ratingSnapshots: [],
    ratingChanges: [],
    matches: [],
    outcomes: [],
  });
  const result = facade.analyze({
    context: scopedContext,
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const hist = result.value.historicalObservations;
  const participationObs = hist.observations.find(
    (o) => o.metricId === IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.PERFORMANCE_PARTICIPATIONS_COUNT
  );
  assert.ok(participationObs);
  assert.equal(participationObs.dimensions.playerId, PLAYER_A);
  assert.equal(participationObs.dimensions.competitionId, COMPETITION_A);
});

// ---------------------------------------------------------------------------
// 68-70. Dashboard payloads (I&A-04 compatible)
// ---------------------------------------------------------------------------

test("68. dashboard KPI payload is I&A-04 compatible", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeDashboardPayloads: true,
  });
  assert.equal(result.ok, true);
  const dash = result.value.dashboardPayloads;
  assert.equal(dash.kpis.finance_transactions.value, 2);
  assert.equal(dash.kpis.performance_win_rate.value, 0.5);
  assert.ok(dash.dataState);
});

test("69. breakdown payloads are deterministic", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context(), includeDashboardPayloads: true });
  const b = facade.analyze({ context: context(), includeDashboardPayloads: true });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(
    a.value.dashboardPayloads.transactionStatusBreakdown,
    b.value.dashboardPayloads.transactionStatusBreakdown
  );
  assert.deepEqual(
    a.value.dashboardPayloads.outcomesBreakdown,
    b.value.dashboardPayloads.outcomesBreakdown
  );
});

test("70. ranking movement breakdown reflects movement compare results", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    movementCompare: { baselineSnapshotId: "rank-snap-1", comparisonSnapshotId: "rank-snap-2" },
    includeDashboardPayloads: true,
  });
  assert.equal(result.ok, true);
  const movementBreakdown = result.value.dashboardPayloads.rankingMovementBreakdown;
  const upIndex = movementBreakdown.categories.indexOf("up");
  assert.ok(upIndex >= 0);
  assert.equal(movementBreakdown.values[upIndex], 1);
});

// ---------------------------------------------------------------------------
// 71-74. Facade behavior
// ---------------------------------------------------------------------------

test("71. input is not mutated", () => {
  const query = { context: context(), includeDashboardPayloads: false };
  const before = JSON.stringify(query);
  const { facade } = buildFacade();
  const result = facade.analyze(query);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(query), before);
});

test("72. output does not leak mutable state", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.summary));
  assert.throws(() => {
    result.value.summary.transactionsCount = 999;
  });
});

test("73. read-only facade rejects write", () => {
  const { facade } = buildFacade();
  const rejected = facade.write();
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED);
  for (const op of ["command", "mutate", "insert", "update", "upsert", "delete", "save", "persist", "register"]) {
    const res = facade[op]();
    assert.equal(res.ok, false);
    assert.equal(res.error.code, IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED);
  }
});

test("74. source failure is wrapped", () => {
  const { facade } = buildFacade({}, { failMode: "throw" });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SOURCE_FAILURE
  );
});

test("75. invalid query does not call source", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createFinanceRankingPerformanceAnalyticsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const result = facade.value.analyze({ notAContext: true });
  assert.equal(result.ok, false);
  assert.equal(loadCalls, 0);
});

test("76. no global singleton", () => {
  const a = buildFacade().facade;
  const b = buildFacade().facade;
  assert.notEqual(a, b);
});

test("77. same input creates same result (deterministic)", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context() });
  const b = facade.analyze({ context: context() });
  assert.equal(a.ok, true);
  assert.deepEqual(a.value.summary, b.value.summary);
});

// ---------------------------------------------------------------------------
// 78-80. Provenance / freshness / completeness
// ---------------------------------------------------------------------------

test("78. provenance is preserved", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.provenance.source.sourceId, SOURCE.sourceId);
});

test("79. stale source creates a warning", () => {
  const { facade } = buildFacade({ freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.stale, true);
  assert.ok(
    result.value.summary.warnings.some(
      (w) => w.code === "ANALYTICS_FINANCE_RANKING_PERFORMANCE_STALE_SOURCE"
    )
  );
});

test("80. incomplete snapshot is not pretended complete", () => {
  const { facade } = buildFacade({
    completeness: IA.FINANCE_RANKING_PERFORMANCE_ANALYTICS_COMPLETENESS.PARTIAL,
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.incompleteSnapshot, true);
  assert.notEqual(result.value.summary.completeness, "complete");
});

// ---------------------------------------------------------------------------
// 81-83. Privacy / payment-credential rejection
// ---------------------------------------------------------------------------

test("81. PII fields are rejected", () => {
  const emailFact = IA.createFinanceTransactionFact({
    ...identity(),
    transactionId: "txn-pii",
    status: "POSTED",
    amount: money(1000),
    email: "x@y.com",
  });
  assert.equal(emailFact.ok, false);
  assert.equal(
    emailFact.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_PRIVACY_VIOLATION
  );
});

test("82. payment-credential fields are rejected", () => {
  const cardFact = IA.createFinancePaymentFact({
    ...identity(),
    paymentId: "pay-pii",
    status: "SETTLED",
    amount: money(1000),
    cardNumber: "4111111111111111",
  });
  assert.equal(cardFact.ok, false);
  assert.equal(
    cardFact.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_PRIVACY_VIOLATION
  );

  const ibanFact = IA.createFinanceSettlementFact({
    ...identity(),
    settlementId: "settle-pii",
    status: "COMPLETED",
    iban: "GB33BUKB20201555555555",
  });
  assert.equal(ibanFact.ok, false);
  assert.equal(
    ibanFact.error.code,
    IA.ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_PRIVACY_VIOLATION
  );
});

test("83. error does not leak PII/payment values", () => {
  const emailFact = IA.createFinanceTransactionFact({
    ...identity(),
    transactionId: "txn-pii-2",
    status: "POSTED",
    amount: money(1000),
    email: "x@y.com",
  });
  assert.equal(emailFact.ok, false);
  assert.equal(emailFact.error.message.includes("x@y.com"), false);

  const cardFact = IA.createFinancePaymentFact({
    ...identity(),
    paymentId: "pay-pii-2",
    status: "SETTLED",
    amount: money(1000),
    cardNumber: "4111111111111111",
  });
  assert.equal(cardFact.ok, false);
  assert.equal(cardFact.error.message.includes("4111111111111111"), false);
});

test("83b. no PII/payment-credential keys present in test fixtures", () => {
  const snapshot = baseSnapshot();
  const forbidden = new Set(IA.FORBIDDEN_PII_AND_PAYMENT_FACT_KEYS);
  const factLists = [
    "transactions",
    "invoices",
    "payments",
    "refunds",
    "settlements",
    "receivables",
    "recognizedAmounts",
    "rankingSystems",
    "rankingSnapshots",
    "rankingPositions",
    "ratingSnapshots",
    "ratingChanges",
    "participations",
    "matches",
    "outcomes",
  ];
  for (const key of factLists) {
    for (const fact of snapshot[key] || []) {
      for (const factKey of Object.keys(fact)) {
        assert.equal(forbidden.has(factKey), false, `${key}.${factKey}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 84-87. Capability flags / canonical-state flags
// ---------------------------------------------------------------------------

test("84. capability flags are always false", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  const summary = result.value.summary;
  assert.equal(summary.ledgerPosted, false);
  assert.equal(summary.revenueRecognizedByAnalytics, false);
  assert.equal(summary.currencyConverted, false);
  assert.equal(summary.rankingCalculated, false);
  assert.equal(summary.ratingCalculated, false);
  assert.equal(summary.standingsCalculated, false);
  assert.equal(summary.scoreRecalculated, false);
  assert.equal(summary.winnerInferredFromScore, false);
  assert.equal(summary.performanceScoreInvented, false);
});

test("85. privacySafe and financialDataSafe flags are true", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.privacySafe, true);
  assert.equal(result.value.summary.financialDataSafe, true);
});

test("86. analytics result does not claim canonical state", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.isCanonicalFinanceState, false);
  assert.equal(result.value.isCanonicalRankingState, false);
  assert.equal(result.value.isCanonicalRatingState, false);
  assert.equal(result.value.isCanonicalPerformanceState, false);
  assert.equal(result.value.isCanonicalModuleState, false);
  assert.equal(result.value.summary.isCanonicalFinanceState, false);
  assert.equal(result.value.summary.isCanonicalRankingState, false);
  assert.equal(result.value.summary.isCanonicalRatingState, false);
  assert.equal(result.value.summary.isCanonicalPerformanceState, false);
  assert.equal(result.value.summary.isCanonicalModuleState, false);
});

test("87. currency is never converted", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.currencyConverted, false);
});

// ---------------------------------------------------------------------------
// 88-90. Import boundaries + backward compatibility
// ---------------------------------------------------------------------------

test("88. no React / Supabase / Platform Core / private business-module imports", () => {
  const files = listJsFiles(FRPA_ROOT);
  assert.ok(files.length > 0);
  const importPattern =
    /(?:from|import)\s+['"][^'"]*(?:react|@mui\/|@supabase|supabase|core\/platform|features\/finance\/|features\/vpr-ranking\/|features\/player-rating\/|features\/competition-|features\/player\/)[^'"]*['"]/i;
  const storagePattern = /localStorage\.(?:getItem|setItem|removeItem)/;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.equal(importPattern.test(content), false, file);
    assert.equal(storagePattern.test(content), false, file);
  }
});

test("89. I&A-01 through I&A-08 markers still present", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId, "I&A-02");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId, "I&A-04");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId, "I&A-05");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId, "I&A-06");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS.workstreamId, "I&A-07");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS.workstreamId, "I&A-08");
  assert.equal(typeof IA.createCustomerPlayerAnalyticsFacade, "function");
  assert.equal(typeof IA.createCompetitionAnalyticsFacade, "function");
  assert.equal(typeof IA.createVenueCourtClubAnalyticsFacade, "function");
  assert.equal(typeof IA.createMetricRegistry, "function");
  assert.equal(typeof IA.createAnalyticsHistoricalObservation, "function");
  assert.equal(typeof IA.createAnalyticsKpiPayload, "function");
});

test("90. empty facts produce deterministic result with null rates (no Infinity)", () => {
  const { facade } = buildFacade({
    transactions: [],
    invoices: [],
    payments: [],
    refunds: [],
    settlements: [],
    receivables: [],
    recognizedAmounts: [],
    rankingSystems: [],
    rankingSnapshots: [],
    rankingPositions: [],
    ratingSnapshots: [],
    ratingChanges: [],
    participations: [],
    matches: [],
    outcomes: [],
  });
  const a = facade.analyze({ context: context() });
  const b = facade.analyze({ context: context() });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.summary.transactionsCount, 0);
  assert.equal(a.value.summary.collectionsRate, null);
  assert.equal(a.value.summary.winRate, null);
  assert.equal(a.value.summary.completionRate, null);
  assert.deepEqual(a.value.summary, b.value.summary);
});
