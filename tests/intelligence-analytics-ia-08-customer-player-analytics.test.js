/**
 * I&A-08 — Customer and Player Analytics certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(__dirname, "../src/features/intelligence-analytics");
const CPA_ROOT = join(MODULE_ROOT, "customer-player-analytics");

const SOURCE = Object.freeze({
  sourceId: "customer-player-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-08-certification",
});

const PROVENANCE = Object.freeze({
  source: SOURCE,
  observedAt: "2026-07-20T12:00:00.000Z",
  ingestedAt: "2026-07-20T12:05:00.000Z",
  transformer: "in-memory-customer-player-analytics",
});

const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const TENANT = "tenant-a";
const CUSTOMER_A = "customer-1";
const CUSTOMER_B = "customer-2";
const PLAYER_A = "player-1";
const PLAYER_B = "player-2";

const WINDOW = Object.freeze({
  startAt: "2024-01-01T00:00:00.000Z",
  endAt: "2024-12-31T23:59:59.999Z",
  inclusive: true,
  timezone: "UTC",
});

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

function baseSnapshot(overrides = {}) {
  return {
    context: context(),
    provenance: PROVENANCE,
    freshness: IA.ANALYTICS_FRESHNESS_STATE.FRESH,
    completeness: IA.CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS.COMPLETE,
    sourceTimestamp: "2026-07-20T12:00:00.000Z",
    customers: [
      {
        ...identity(),
        customerId: CUSTOMER_A,
        status: "ACTIVE",
        createdAt: "2024-06-01T00:00:00.000Z",
      },
      {
        ...identity(),
        customerId: CUSTOMER_B,
        status: "INACTIVE",
        createdAt: "2024-06-02T00:00:00.000Z",
      },
    ],
    customerProfileCompleteness: [
      { ...identity(), customerId: CUSTOMER_A, profileComplete: true },
      { ...identity(), customerId: CUSTOMER_B, profileComplete: false },
    ],
    customerActivities: [
      {
        ...identity(),
        customerId: CUSTOMER_A,
        activityId: "cact-1",
        activityKind: "LOGIN",
        occurredAt: "2024-06-15T00:00:00.000Z",
      },
      {
        ...identity(),
        customerId: CUSTOMER_B,
        activityId: "cact-2",
        activityKind: "LOGIN",
        occurredAt: "2025-06-15T00:00:00.000Z",
      },
    ],
    players: [
      {
        ...identity(),
        playerId: PLAYER_A,
        status: "ACTIVE",
        createdAt: "2024-06-01T00:00:00.000Z",
      },
      {
        ...identity(),
        playerId: PLAYER_B,
        status: "INACTIVE",
        createdAt: "2024-06-02T00:00:00.000Z",
      },
    ],
    playerProfileCompleteness: [
      { ...identity(), playerId: PLAYER_A, profileComplete: true },
      { ...identity(), playerId: PLAYER_B, profileComplete: false },
    ],
    playerActivities: [
      {
        ...identity(),
        playerId: PLAYER_A,
        activityId: "pact-1",
        activityKind: "MATCH",
        occurredAt: "2024-06-15T00:00:00.000Z",
      },
      {
        ...identity(),
        playerId: PLAYER_B,
        activityId: "pact-2",
        activityKind: "MATCH",
        occurredAt: "2025-06-15T00:00:00.000Z",
      },
    ],
    customerPlayerLinks: [
      {
        ...identity(),
        customerId: CUSTOMER_A,
        playerId: PLAYER_A,
        linkId: "link-1",
        linkStatus: "ACTIVE",
      },
    ],
    playerCompetitionParticipations: [
      {
        ...identity(),
        playerId: PLAYER_A,
        participationId: "part-1",
        competitionId: "comp-1",
        status: "COMPLETED",
      },
    ],
    playerClubMemberships: [
      {
        ...identity(),
        playerId: PLAYER_A,
        membershipId: "mem-1",
        clubId: "club-1",
        status: "ACTIVE",
      },
    ],
    ...overrides,
  };
}

function buildSource(snapshotOverrides = {}, adapterExtras = {}) {
  const source = IA.createInMemoryCustomerPlayerAnalyticsSource({
    snapshot: baseSnapshot(snapshotOverrides),
    ...adapterExtras,
  });
  assert.equal(source.ok, true, source.error?.message);
  return source.value;
}

function buildFacade(snapshotOverrides = {}, adapterExtras = {}) {
  const sourceAdapter = buildSource(snapshotOverrides, adapterExtras);
  const facade = IA.createCustomerPlayerAnalyticsFacade({
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

test("public exports include I&A-08 customer player analytics API", () => {
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.ok(name in IA, `missing export: ${name}`);
  }
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS.workstreamId,
    "I&A-08"
  );
  assert.equal(typeof IA.createCustomerPlayerAnalyticsFacade, "function");
  assert.equal(typeof IA.projectCustomerPlayerSummary, "function");
});

test("validate does not call source", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createCustomerPlayerAnalyticsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const validated = facade.value.validate({ context: context() });
  assert.equal(validated.ok, true);
  assert.equal(loadCalls, 0);
});

test("1. valid analytics context is created", () => {
  const result = IA.createCustomerPlayerAnalyticsContext(
    context({ customerId: CUSTOMER_A, playerId: PLAYER_A })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.customerId, CUSTOMER_A);
  assert.equal(result.value.playerId, PLAYER_A);
  assert.ok(Object.isFrozen(result.value));
});

test("2. missing tenant is rejected", () => {
  const result = IA.createCustomerPlayerAnalyticsContext({
    customerId: CUSTOMER_A,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED
  );
});

test("3. source tenant mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({
      tenantScope: { kind: "tenant", tenantId: "other-tenant" },
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TENANT_MISMATCH
  );
});

test("4. mixed-tenant facts are rejected", () => {
  const snapshot = IA.createCustomerPlayerAnalyticsSnapshot({
    context: context(),
    customers: [
      { ...identity(), customerId: CUSTOMER_A, status: "ACTIVE" },
      {
        ...identity({ tenantId: "tenant-b" }),
        customerId: "customer-x",
        status: "ACTIVE",
      },
    ],
  });
  assert.equal(snapshot.ok, true);
  const guard = IA.guardCustomerPlayerAnalyticsSnapshot(
    context(),
    snapshot.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TENANT_MISMATCH
  );
});

test("5. customer scope mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ customerId: "customer-other" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CUSTOMER_MISMATCH
  );
});

test("6. player scope mismatch is rejected", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context({ playerId: "player-other" }),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PLAYER_MISMATCH
  );
});

test("7. customer-player link tenant mismatch is rejected", () => {
  const snapshot = IA.createCustomerPlayerAnalyticsSnapshot({
    context: context(),
    customerPlayerLinks: [
      {
        ...identity({ tenantId: "tenant-b" }),
        customerId: CUSTOMER_A,
        playerId: PLAYER_A,
        linkId: "link-x",
      },
    ],
  });
  assert.equal(snapshot.ok, true);
  const guard = IA.guardCustomerPlayerAnalyticsSnapshot(
    context(),
    snapshot.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_LINK_TENANT_MISMATCH
  );
});

test("8. participation player mismatch is rejected", () => {
  const snapshot = IA.createCustomerPlayerAnalyticsSnapshot({
    context: context(),
    players: [{ ...identity(), playerId: PLAYER_A, status: "ACTIVE" }],
    playerCompetitionParticipations: [
      { ...identity(), playerId: "player-mismatch", participationId: "part-x" },
    ],
  });
  assert.equal(snapshot.ok, true);
  const guard = IA.guardCustomerPlayerAnalyticsSnapshot(
    context({ playerId: PLAYER_A }),
    snapshot.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PLAYER_MISMATCH
  );
  assert.ok(guard.error.field.includes("playerCompetitionParticipations"));
});

test("9. membership player mismatch is rejected", () => {
  const snapshot = IA.createCustomerPlayerAnalyticsSnapshot({
    context: context(),
    players: [{ ...identity(), playerId: PLAYER_A, status: "ACTIVE" }],
    playerClubMemberships: [
      {
        ...identity(),
        playerId: "player-mismatch",
        membershipId: "mem-x",
        clubId: "club-x",
      },
    ],
  });
  assert.equal(snapshot.ok, true);
  const guard = IA.guardCustomerPlayerAnalyticsSnapshot(
    context({ playerId: PLAYER_A }),
    snapshot.value
  );
  assert.equal(guard.ok, false);
  assert.equal(
    guard.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PLAYER_MISMATCH
  );
  assert.ok(guard.error.field.includes("playerClubMemberships"));
});

test("10. input is not mutated", () => {
  const query = {
    context: context(),
    includeDashboardPayloads: false,
  };
  const before = JSON.stringify(query);
  const { facade } = buildFacade();
  const result = facade.analyze(query);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(query), before);
});

test("11. output does not leak mutable state", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.ok(Object.isFrozen(result.value.summary));
  assert.throws(() => {
    result.value.summary.customerCount = 999;
  });
});

test("12. metric definitions have stable ID/version", () => {
  const defs = IA.createCustomerPlayerAnalyticsMetricDefinitions();
  assert.equal(defs.ok, true);
  assert.ok(defs.value.length >= 20);
  for (const def of defs.value) {
    assert.ok(def.metricId);
    assert.equal(def.version, "1.0.0");
  }
  assert.equal(
    IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_COUNT,
    "customer.count"
  );
  assert.equal(
    IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_COUNT,
    "player.count"
  );
});

test("13. metric catalog registers validly via createMetricRegistry", () => {
  const entries = IA.createCustomerPlayerAnalyticsMetricCatalogEntries();
  assert.equal(entries.ok, true);
  const registry = IA.createMetricRegistry({ entries: entries.value });
  assert.equal(registry.ok, true);
  const found = registry.value.registry.getMetric(
    IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_COUNT,
    "1.0.0"
  );
  assert.equal(found.ok, true);
});

test("14. duplicate metric conflict is deterministic", () => {
  const entries = IA.createCustomerPlayerAnalyticsMetricCatalogEntries();
  assert.equal(entries.ok, true);
  const conflicting = IA.createMetricRegistry({
    entries: [
      entries.value[0],
      {
        ...entries.value[0],
        definition: {
          ...entries.value[0].definition,
          definition:
            "Different conflicting definition text for same ID/version.",
        },
      },
    ],
  });
  assert.equal(conflicting.ok, true);
  const conflictRegistration = conflicting.value.registrations.find(
    (item) => item.ok === false
  );
  assert.ok(conflictRegistration);
  assert.equal(
    conflictRegistration.error.code,
    IA.ANALYTICS_ERROR_CODE.REGISTRY_CONFLICT
  );
});

test("15. customer count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerCount, 2);
});

test("16. customer lifecycle distribution is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerLifecycleDistribution.active, 1);
  assert.equal(
    result.value.summary.customerLifecycleDistribution.inactive,
    1
  );
});

test("17. customer active count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerActiveCount, 1);
});

test("18. customer inactive count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerInactiveCount, 1);
});

test("19. customer created count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerCreatedCount, 2);
});

test("20. customer active-in-window count is correct (with timeWindow)", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context(), timeWindow: WINDOW });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerActiveInWindowCount, 1);
});

test("21. customer profile-complete count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerProfileCompleteCount, 1);
});

test("22. customer profile-completeness rate is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerProfileCompletenessRate, 0.5);
});

test("23. missing completeness does not become false (indeterminate)", () => {
  const { facade } = buildFacade({ customerProfileCompleteness: [] });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerProfileCompleteCount, null);
  assert.equal(result.value.summary.customerProfileCompletenessRate, null);
});

test("24. player count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerCount, 2);
});

test("25. player lifecycle distribution is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerLifecycleDistribution.active, 1);
  assert.equal(result.value.summary.playerLifecycleDistribution.inactive, 1);
});

test("26. player active count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerActiveCount, 1);
});

test("27. player inactive count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerInactiveCount, 1);
});

test("28. player created count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerCreatedCount, 2);
});

test("29. player active-in-window count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context(), timeWindow: WINDOW });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerActiveInWindowCount, 1);
});

test("30. player profile-complete count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerProfileCompleteCount, 1);
});

test("31. player profile-completeness rate is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.playerProfileCompletenessRate, 0.5);
});

test("32. explicit customer-player linked count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.linkedCustomerCount, 1);
  assert.equal(result.value.summary.linkedPlayerCount, 1);
});

test("33. customer-player linkage rate is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerLinkageRate, 0.5);
  assert.equal(result.value.summary.playerLinkageRate, 0.5);
});

test("34. zero denominator does not return Infinity", () => {
  const { facade } = buildFacade({
    customers: [],
    customerProfileCompleteness: [],
    customerActivities: [],
    players: [],
    playerProfileCompleteness: [],
    playerActivities: [],
    customerPlayerLinks: [],
    playerCompetitionParticipations: [],
    playerClubMemberships: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerLinkageRate, null);
  assert.equal(result.value.summary.playerLinkageRate, null);
  assert.notEqual(result.value.summary.customerLinkageRate, Infinity);
  assert.notEqual(result.value.summary.playerLinkageRate, Infinity);
});

test("35. missing link data does not auto become unlinked", () => {
  const { facade } = buildFacade({ customerPlayerLinks: undefined });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.linkageAvailable, false);
  assert.equal(result.value.summary.linkedCustomerCount, null);
  assert.equal(result.value.summary.linkedPlayerCount, null);
  assert.equal(result.value.summary.customerLinkageRate, null);
  assert.equal(result.value.summary.playerLinkageRate, null);
});

test("35b. empty customerPlayerLinks marks linkage available with zero-based rates", () => {
  const { facade } = buildFacade({ customerPlayerLinks: [] });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.linkageAvailable, true);
  assert.equal(result.value.summary.linkedCustomerCount, 0);
  assert.equal(result.value.summary.linkedPlayerCount, 0);
  assert.equal(result.value.summary.customerLinkageRate, 0);
  assert.equal(result.value.summary.playerLinkageRate, 0);
});

test("36. competition participation count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.participationCount, 1);
});

test("37. club membership count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.membershipCount, 1);
});

test("38. activity count is correct", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerActivityCount, 2);
  assert.equal(result.value.summary.playerActivityCount, 2);
});

test("39. activity time window is deterministic", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context(), timeWindow: WINDOW });
  const b = facade.analyze({ context: context(), timeWindow: WINDOW });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.summary.customerActivityCount, 1);
  assert.equal(a.value.summary.playerActivityCount, 1);
  assert.equal(a.value.summary.customerActivityCount, b.value.summary.customerActivityCount);
  assert.equal(a.value.summary.playerActivityCount, b.value.summary.playerActivityCount);
});

test("40. invalid timestamp typed error", () => {
  const fact = IA.createCustomerActivityFact({
    ...identity(),
    customerId: CUSTOMER_A,
    activityId: "cact-bad",
    occurredAt: "not-a-timestamp",
  });
  assert.equal(fact.ok, false);
  assert.equal(
    fact.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TIMESTAMP_INVALID
  );
});

test("41. future timestamps are accepted if valid ISO (explicit policy)", () => {
  const fact = IA.createCustomerActivityFact({
    ...identity(),
    customerId: CUSTOMER_A,
    activityId: "cact-future",
    occurredAt: "2999-01-01T00:00:00.000Z",
  });
  assert.equal(fact.ok, true);
  assert.equal(fact.value.occurredAt, "2999-01-01T00:00:00.000Z");
});

test("42. historical customer observation compatible with I&A-05", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const hist = result.value.historicalObservations;
  assert.ok(hist.observations.length > 0);
  assert.equal(
    hist.analyticalMethodVersion,
    IA.CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.HISTORICAL
  );
  const customerCountObs = hist.observations.find(
    (o) => o.metricId === IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_COUNT
  );
  assert.ok(customerCountObs);
  assert.equal(customerCountObs.value, 2);
  assert.equal(customerCountObs.missing, false);
});

test("43. historical player observation compatible with I&A-05", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeHistoricalObservations: true,
  });
  assert.equal(result.ok, true);
  const hist = result.value.historicalObservations;
  const playerCountObs = hist.observations.find(
    (o) => o.metricId === IA.CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_COUNT
  );
  assert.ok(playerCountObs);
  assert.equal(playerCountObs.value, 2);
  assert.equal(playerCountObs.missing, false);
});

test("44. customer activity series is deterministic (same input, same counts)", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context(), timeWindow: WINDOW });
  const b = facade.analyze({ context: context(), timeWindow: WINDOW });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(
    a.value.summary.customerActivityCount,
    b.value.summary.customerActivityCount
  );
});

test("45. player activity series is deterministic", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context(), timeWindow: WINDOW });
  const b = facade.analyze({ context: context(), timeWindow: WINDOW });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(
    a.value.summary.playerActivityCount,
    b.value.summary.playerActivityCount
  );
});

test("46. dashboard KPI payload compatible with I&A-04", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({
    context: context(),
    includeDashboardPayloads: true,
  });
  assert.equal(result.ok, true);
  const dash = result.value.dashboardPayloads;
  assert.equal(dash.kpis.customers.value, 2);
  assert.equal(dash.kpis.players.value, 2);
});

test("47. breakdown payload is deterministic", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({
    context: context(),
    includeDashboardPayloads: true,
  });
  const b = facade.analyze({
    context: context(),
    includeDashboardPayloads: true,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const categories = a.value.dashboardPayloads.customerLifecycleBreakdown.categories;
  assert.deepEqual(categories, [...categories].sort());
  assert.deepEqual(
    a.value.dashboardPayloads.customerLifecycleBreakdown,
    b.value.dashboardPayloads.customerLifecycleBreakdown
  );
});

test("48. provenance is preserved", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.provenance.source.sourceId, SOURCE.sourceId);
});

test("49. freshness is preserved", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.freshness, IA.ANALYTICS_FRESHNESS_STATE.FRESH);
});

test("50. stale source creates a warning", () => {
  const { facade } = buildFacade({
    freshness: IA.ANALYTICS_FRESHNESS_STATE.STALE,
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.stale, true);
  assert.ok(
    result.value.summary.warnings.some(
      (w) => w.code === "ANALYTICS_CUSTOMER_PLAYER_STALE_SOURCE"
    )
  );
});

test("51. incomplete snapshot is not pretended complete", () => {
  const { facade } = buildFacade({
    completeness: IA.CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS.PARTIAL,
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.incompleteSnapshot, true);
  assert.notEqual(result.value.summary.completeness, "complete");
});

test("52. missing data is not auto-filled with zero", () => {
  const { facade } = buildFacade({
    customerProfileCompleteness: [],
    playerProfileCompleteness: [],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerActiveInWindowCount, null);
  assert.equal(result.value.summary.playerActiveInWindowCount, null);
  assert.equal(result.value.summary.customerProfileCompleteCount, null);
  assert.equal(result.value.summary.playerProfileCompleteCount, null);
});

test("53. PII fields are rejected", () => {
  const emailFact = IA.createCustomerAnalyticalFact({
    tenantId: TENANT,
    customerId: CUSTOMER_A,
    email: "x@y.com",
  });
  assert.equal(emailFact.ok, false);
  assert.equal(
    emailFact.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PRIVACY_VIOLATION
  );

  const phoneFact = IA.createPlayerAnalyticalFact({
    tenantId: TENANT,
    playerId: PLAYER_A,
    phone: "+1-555-000-1111",
  });
  assert.equal(phoneFact.ok, false);
  assert.equal(
    phoneFact.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PRIVACY_VIOLATION
  );

  const nameFact = IA.createCustomerAnalyticalFact({
    tenantId: TENANT,
    customerId: CUSTOMER_A,
    name: "Jane Doe",
  });
  assert.equal(nameFact.ok, false);
  assert.equal(
    nameFact.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PRIVACY_VIOLATION
  );

  const displayNameFact = IA.createPlayerAnalyticalFact({
    tenantId: TENANT,
    playerId: PLAYER_A,
    displayName: "Jane D.",
  });
  assert.equal(displayNameFact.ok, false);
  assert.equal(
    displayNameFact.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PRIVACY_VIOLATION
  );
});

test("54. error does not leak email/phone/name values", () => {
  const emailFact = IA.createCustomerAnalyticalFact({
    tenantId: TENANT,
    customerId: CUSTOMER_A,
    email: "x@y.com",
  });
  assert.equal(emailFact.ok, false);
  assert.equal(emailFact.error.message.includes("x@y.com"), false);

  const phoneFact = IA.createPlayerAnalyticalFact({
    tenantId: TENANT,
    playerId: PLAYER_A,
    phone: "+1-555-000-1111",
  });
  assert.equal(phoneFact.ok, false);
  assert.equal(phoneFact.error.message.includes("+1-555-000-1111"), false);

  const nameFact = IA.createCustomerAnalyticalFact({
    tenantId: TENANT,
    customerId: CUSTOMER_A,
    name: "Jane Doe",
  });
  assert.equal(nameFact.ok, false);
  assert.equal(nameFact.error.message.includes("Jane Doe"), false);
});

test("55. customer identity is not deduplicated", () => {
  const { facade } = buildFacade({
    customers: [
      { ...identity(), customerId: CUSTOMER_A, status: "ACTIVE" },
      { ...identity(), customerId: CUSTOMER_A, status: "ACTIVE" },
    ],
  });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.customerCount, 2);
  assert.equal(result.value.summary.customerIdentityDeduplicated, false);
});

test("56. customer-player relation is not inferred", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  // Only the explicit CUSTOMER_A <-> PLAYER_A link counts; CUSTOMER_B/PLAYER_B
  // are present in the same snapshot but never linked, and must not be
  // inferred as linked merely by co-existing.
  assert.equal(result.value.summary.linkedCustomerCount, 1);
  assert.equal(result.value.summary.linkedPlayerCount, 1);
  assert.equal(result.value.summary.customerPlayerLinkInferred, false);
});

test("57. CRM conversion is not calculated", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.crmConversionCalculated, false);
});

test("58. revenue/value is not calculated", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.revenueCalculated, false);
});

test("59. rating is not calculated", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.ratingCalculated, false);
});

test("60. ranking is not calculated", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.rankingCalculated, false);
});

test("61. player performance is not calculated", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.performanceCalculated, false);
});

test("62. eligibility is not calculated", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.summary.eligibilityCalculated, false);
});

test("63. source failure is wrapped", () => {
  const { facade } = buildFacade({}, { failMode: "throw" });
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SOURCE_FAILURE
  );
});

test("64. invalid query does not call source", () => {
  let loadCalls = 0;
  const sourceAdapter = {
    load() {
      loadCalls += 1;
      return { ok: true, value: { snapshot: {} } };
    },
  };
  const facade = IA.createCustomerPlayerAnalyticsFacade({ sourceAdapter });
  assert.equal(facade.ok, true);
  const result = facade.value.analyze({ notAContext: true });
  assert.equal(result.ok, false);
  assert.equal(loadCalls, 0);
});

test("65. read-only facade rejects write", () => {
  const { facade } = buildFacade();
  const rejected = facade.write();
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.error.code,
    IA.ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED
  );
});

test("66-69. no React / Supabase / Platform Core / private module imports", () => {
  const files = listJsFiles(CPA_ROOT);
  assert.ok(files.length > 0);
  const importPattern =
    /(?:from|import)\s+['"][^'"]*(?:react|@mui\/|@supabase|supabase|core\/platform|features\/customer\/|features\/player\/|features\/crm\/|features\/club\/|features\/competition-engine\/|features\/player-rating\/)[^'"]*['"]/i;
  const storagePattern = /localStorage\.(?:getItem|setItem|removeItem)/;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.equal(importPattern.test(content), false, file);
    assert.equal(storagePattern.test(content), false, file);
  }
});

test("70. no global singleton", () => {
  const a = buildFacade().facade;
  const b = buildFacade().facade;
  assert.notEqual(a, b);
});

test("71. empty facts produce deterministic result", () => {
  const { facade } = buildFacade({
    customers: [],
    customerProfileCompleteness: [],
    customerActivities: [],
    players: [],
    playerProfileCompleteness: [],
    playerActivities: [],
    customerPlayerLinks: [],
    playerCompetitionParticipations: [],
    playerClubMemberships: [],
  });
  const a = facade.analyze({ context: context() });
  const b = facade.analyze({ context: context() });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.summary.customerCount, 0);
  assert.equal(a.value.summary.playerCount, 0);
  assert.deepEqual(a.value.summary, b.value.summary);
});

test("72. same input creates same result", () => {
  const { facade } = buildFacade();
  const a = facade.analyze({ context: context() });
  const b = facade.analyze({ context: context() });
  assert.equal(a.ok, true);
  assert.deepEqual(a.value.summary, b.value.summary);
});

test("73. mixed customer/player facts stay scoped (no silent cross-contamination)", () => {
  const { facade } = buildFacade();
  // Snapshot contains both CUSTOMER_A and CUSTOMER_B — scoping to CUSTOMER_A
  // only must fail closed rather than silently filtering to just CUSTOMER_A.
  const scoped = facade.analyze({
    context: context({ customerId: CUSTOMER_A }),
  });
  assert.equal(scoped.ok, false);
  assert.equal(
    scoped.error.code,
    IA.ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CUSTOMER_MISMATCH
  );
});

test("74. analytics result does not claim canonical state", () => {
  const { facade } = buildFacade();
  const result = facade.analyze({ context: context() });
  assert.equal(result.ok, true);
  assert.equal(result.value.isCanonicalCustomerPlayerState, false);
  assert.equal(result.value.isCanonicalModuleState, false);
  assert.equal(result.value.summary.isCanonicalCustomerPlayerState, false);
  assert.equal(result.value.summary.isCanonicalModuleState, false);
});

test("75. I&A-01 through I&A-07 markers still present", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId,
    "I&A-02"
  );
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId,
    "I&A-04"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId,
    "I&A-05"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId,
    "I&A-06"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS.workstreamId,
    "I&A-07"
  );
  assert.equal(typeof IA.createCompetitionAnalyticsFacade, "function");
  assert.equal(typeof IA.createVenueCourtClubAnalyticsFacade, "function");
  assert.equal(typeof IA.createMetricRegistry, "function");
  assert.equal(typeof IA.createAnalyticsHistoricalObservation, "function");
  assert.equal(typeof IA.createAnalyticsKpiPayload, "function");
});
