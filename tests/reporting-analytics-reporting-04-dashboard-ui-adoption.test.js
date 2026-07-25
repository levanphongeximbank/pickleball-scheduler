/**
 * REPORTING-04 — presentation source-state, mock honesty, workspace, lifecycle, a11y contracts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as reporting from "../src/features/reporting-analytics/index.js";
import {
  getDashboardAnalytics,
} from "../src/features/dashboard-analytics/services/dashboardService.js";
import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import { REPORTS_MENU_ROOT } from "../src/config/v5Menu/reportsMenu.js";
import {
  baseActor,
  baseDefinitionInput,
  createReportingTestFacade,
} from "./support/reporting-analytics-test-doubles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function installEmptyMemoryStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
}

test("04A source-state mapping covers all presentation states", () => {
  const states = reporting.REPORTING_PRESENTATION_SOURCE_STATE_VALUES;
  assert.ok(states.includes("LIVE"));
  assert.ok(states.includes("MOCK"));
  assert.ok(states.includes("PREVIEW"));
  assert.ok(states.includes("STALE"));
  assert.ok(states.includes("UNAVAILABLE"));
  assert.ok(states.includes("LOADING"));
  assert.ok(states.includes("EMPTY"));
  assert.ok(states.includes("ERROR"));
  assert.ok(states.includes("MIXED"));
  assert.ok(states.includes("PARTIAL"));

  assert.equal(
    reporting.mapProvenanceToPresentationSourceState(null).state,
    "UNAVAILABLE"
  );
  assert.equal(
    reporting.mapProvenanceToPresentationSourceState(
      { state: "LIVE" },
      { empty: true }
    ).state,
    "EMPTY"
  );
  assert.equal(
    reporting.mapProvenanceToPresentationSourceState(
      { state: "LIVE" },
      { liveFailed: true }
    ).state,
    "ERROR"
  );
  assert.equal(
    reporting
      .mapAvailabilityToPresentationSourceState("SOURCE_NOT_CONFIGURED")
      .state,
    "UNAVAILABLE"
  );
  assert.notEqual(
    reporting
      .mapAvailabilityToPresentationSourceState("SOURCE_NOT_CONFIGURED")
      .state,
    "EMPTY"
  );

  assert.throws(() =>
    reporting.createReportingPresentationSourceState({ state: "MOCK" })
  );
  const mock = reporting.createReportingPresentationSourceState({
    state: "MOCK",
    explicitDemoOrPreview: true,
  });
  assert.equal(mock.label.length > 0, true);
  assert.match(mock.label, /demo/i);

  const stale = reporting.createReportingPresentationSourceState({
    state: "STALE",
    reason: "cache_old",
  });
  assert.equal(stale.state, "STALE");
});

test("04A live failure never maps to MOCK", () => {
  assert.throws(() =>
    reporting.createReportingPresentationSourceState({
      state: "MOCK",
      explicitDemoOrPreview: true,
      liveFailed: true,
    })
  );
  const mapped = reporting.mapProvenanceToPresentationSourceState(
    { state: "MOCK", fallbackReason: "x" },
    { liveFailed: true }
  );
  assert.equal(mapped.state, "ERROR");
});

test("04B live empty does not fabricate KPI demo", () => {
  installEmptyMemoryStorage();
  const payload = getDashboardAnalytics({
    clubId: "__reporting04_empty_club__",
    from: "2026-06-01",
    to: "2026-06-28",
    sections: { revenue: true },
    mode: "live",
  });
  assert.equal(payload.meta.isEmpty, true);
  assert.equal(payload.isMock, false);
  assert.equal(payload.summary, null);
  assert.equal(payload.sourceState.state, "EMPTY");
  assert.equal(payload.topPlayers.length, 0);
  assert.equal(payload.revenueSeries.length, 0);
});

test("04B live error does not fallback to mock", () => {
  delete globalThis.localStorage;
  assert.throws(
    () =>
      getDashboardAnalytics({
        clubId: "__reporting04_error_club__",
        from: "2026-06-01",
        to: "2026-06-07",
        mode: "live",
      }),
    (err) =>
      err?.liveFailed === true &&
      err?.code === "DASHBOARD_SOURCE_FAILED" &&
      err?.sourceState === "ERROR"
  );
});

test("04B explicit demo/preview is labeled", () => {
  const demo = getDashboardAnalytics({
    clubId: "any",
    from: "2026-06-01",
    to: "2026-06-28",
    mode: "demo",
  });
  assert.equal(demo.isMock, true);
  assert.equal(demo.sourceState.state, "MOCK");
  assert.equal(demo.sourceState.explicitDemoOrPreview, true);
  assert.match(demo.sourceState.label, /demo/i);

  const preview = getDashboardAnalytics({
    clubId: "any",
    from: "2026-06-01",
    to: "2026-06-28",
    mode: "preview",
  });
  assert.equal(preview.sourceState.state, "PREVIEW");
});

test("04B fabricated win-rate / elo fallback not present under LIVE empty path", () => {
  installEmptyMemoryStorage();
  const payload = getDashboardAnalytics({
    clubId: "__reporting04_empty_club_3__",
    from: "2026-06-01",
    to: "2026-06-28",
    mode: "live",
  });
  assert.equal(payload.isMock, false);
  assert.equal(payload.topPlayers.every((p) => p == null || p.wins == null), true);
});

test("04C reports menu does not overclaim LIVE for Reporting workspace", () => {
  const leaf = REPORTS_MENU_ROOT.children[0];
  assert.notEqual(leaf.featureStatus, FEATURE_STATUS.LIVE);
  assert.equal(leaf.featureStatus, FEATURE_STATUS.PARTIAL);
  assert.equal(leaf.path, "/reports");
});

test("04C/04D workspace controller UNAVAILABLE without injected runtime", async () => {
  reporting.clearReportingAnalyticsRuntime();
  const controller = reporting.createReportsWorkspaceController({
    actor: {
      userId: "u1",
      permissions: [
        reporting.REPORTING_PERMISSIONS.DASHBOARD_VIEW,
        reporting.REPORTING_PERMISSIONS.REPORT_EXECUTE,
        reporting.REPORTING_PERMISSIONS.REPORT_SAVE,
        reporting.REPORTING_PERMISSIONS.REPORT_EXPORT,
        reporting.REPORTING_PERMISSIONS.FILTER_SAVE,
      ],
    },
    ownerId: "u1",
    tenantId: "t1",
  });
  assert.equal(controller.runtime.available, false);
  const defs = await controller.listReportDefinitions();
  assert.equal(defs.sourceState.state, "UNAVAILABLE");
  const exec = await controller.executeReport({ reportDefinitionId: "r1" });
  assert.equal(exec.lifecycle.status, "UNAVAILABLE");
  const exp = await controller.exportReport({ reportDefinitionId: "r1", format: "csv" });
  assert.equal(exp.lifecycle.status, "UNAVAILABLE");
  assert.equal(exp.lifecycle.showSuccess, false);
  assert.equal(exp.lifecycle.outputHref, null);
});

test("04C saved reports/filters with injected in-memory facade", async () => {
  const harness = createReportingTestFacade();
  const facade = harness.facade;
  const actor = baseActor();
  const scope = reporting.createReportScope({
    kind: reporting.REPORT_SCOPE_KIND.CLUB,
    tenantId: "tenant-1",
    clubId: "club-1",
  });

  const def = await facade.saveReportDefinition(baseDefinitionInput());
  assert.equal(def.ok, true);

  const controller = reporting.createReportsWorkspaceController({
    facade,
    actor,
    ownerId: actor.userId,
    tenantId: "tenant-1",
    scope,
  });

  const listed = await controller.listReportDefinitions();
  assert.equal(listed.ok, true);
  assert.equal(listed.sourceState.state, "LIVE");
  assert.ok(listed.items.length >= 1);

  const savedEmpty = await controller.listSavedReports();
  assert.equal(savedEmpty.sourceState.state, "EMPTY");

  const saved = await controller.saveSavedReport({
    savedReportId: "saved-1",
    reportDefinitionId: "rdef_demo",
    name: "My report",
    scope,
    ownerId: actor.userId,
    tenantId: "tenant-1",
    version: 1,
  });
  assert.equal(saved.ok, true);

  const filtersEmpty = await controller.listSavedFilters();
  assert.equal(filtersEmpty.sourceState.state, "EMPTY");

  const filter = await controller.saveSavedFilter({
    savedFilterId: "filter-1",
    reportDefinitionId: "rdef_demo",
    name: "My filter",
    scope,
    ownerId: actor.userId,
    tenantId: "tenant-1",
    version: 1,
  });
  assert.equal(filter.ok, true);
});

test("04D export success requires real output reference; fake URL rejected", () => {
  assert.equal(reporting.isValidExportOutputReference("fake://x"), false);
  assert.equal(reporting.isValidExportOutputReference("mock://x"), false);
  assert.equal(
    reporting.isValidExportOutputReference({ uri: "https://example.com/a.csv" }),
    true
  );

  const bad = reporting.createExportLifecycleViewModel({
    status: "SUCCEEDED",
    outputReference: "fake://artifact",
  });
  assert.equal(bad.showSuccess, false);
  assert.equal(bad.outputHref, null);

  const good = reporting.createExportLifecycleViewModel({
    status: "SUCCEEDED",
    outputReference: { uri: "https://cdn.example/report.csv", artifactId: "a1" },
  });
  assert.equal(good.showSuccess, true);
  assert.equal(good.outputHref, "https://cdn.example/report.csv");

  const pending = reporting.createExportLifecycleViewModel({ status: "PENDING" });
  assert.equal(pending.showSuccess, false);
});

test("04D invalid lifecycle transition surfaces typed failure", () => {
  const vm = reporting.createExecutionLifecycleViewModel({
    previousStatus: "SUCCEEDED",
    status: "RUNNING",
  });
  assert.equal(vm.status, "FAILED");
  assert.ok(vm.transitionError);
});

test("04E permission visibility uses canonical IDs and is visibility-only", () => {
  const vis = reporting.resolveReportingPermissionVisibility({
    permissions: [
      reporting.REPORTING_PERMISSIONS.DASHBOARD_VIEW,
      reporting.REPORTING_PERMISSIONS.REPORT_EXPORT,
    ],
  });
  assert.equal(vis.canViewDashboard, true);
  assert.equal(vis.canExportReport, true);
  assert.equal(vis.canExecuteReport, false);
  assert.equal(vis.isVisibilityOnly, true);
  assert.equal(
    reporting.REPORTING_PERMISSIONS.DASHBOARD_VIEW,
    "reporting.dashboard.view"
  );
});

test("04E service authorization still invoked by facade save paths", async () => {
  const harness = createReportingTestFacade();
  const scope = reporting.createReportScope({
    kind: reporting.REPORT_SCOPE_KIND.CLUB,
    tenantId: "tenant-1",
    clubId: "club-1",
  });
  const denied = await harness.facade.saveSavedReport(
    {
      savedReportId: "s1",
      reportDefinitionId: "rdef_demo",
      name: "x",
      scope,
      ownerId: "u1",
      version: 1,
    },
    { userId: "u1", permissions: [] }
  );
  assert.equal(denied.ok, false);
});

test("04 ownership: no I&A deep import from reporting presentation/ui; no localStorage durability", () => {
  const dirs = [
    path.join(ROOT, "src/features/reporting-analytics/presentation"),
    path.join(ROOT, "src/features/reporting-analytics/ui"),
  ];
  const deepIa = /intelligence-analytics\/(?!index\.js)/;
  const localStorageRe = /localStorage\./;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (!fs.statSync(full).isFile()) continue;
      const text = fs.readFileSync(full, "utf8");
      assert.equal(deepIa.test(text), false, full);
      assert.equal(localStorageRe.test(text), false, `${full} must not use browser durable storage API`);
    }
  }

  const bridge = fs.readFileSync(
    path.join(
      ROOT,
      "src/features/dashboard-analytics/adapters/dashboardProvenanceBridge.js"
    ),
    "utf8"
  );
  assert.match(bridge, /reporting-analytics\/index\.js/);
  assert.doesNotMatch(bridge, /reporting-analytics\/adapters\//);
});

test("04 public exports include presentation contracts", () => {
  assert.ok(
    reporting.REPORTING_ANALYTICS_PUBLIC_EXPORTS.includes(
      "REPORTING_PRESENTATION_SOURCE_STATE"
    )
  );
  assert.ok(
    reporting.REPORTING_ANALYTICS_PUBLIC_EXPORTS.includes(
      "createReportsWorkspaceController"
    )
  );
  assert.equal(
    typeof reporting.resolveDashboardPresentationSourceState,
    "function"
  );
});
