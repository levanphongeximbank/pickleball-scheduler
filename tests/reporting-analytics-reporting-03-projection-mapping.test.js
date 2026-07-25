/**
 * REPORTING-03 — intelligence projection mapping adapter tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REPORT_AVAILABILITY,
  REPORT_PROVENANCE,
  REPORT_SOURCE_KIND,
  REPORTING_ERROR_CODE,
  createIntelligenceProjectionDataSourcePort,
  createIntelligenceProjectionReference,
  createReportDefinition,
  createReportScope,
  IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT,
  isReportingError,
  matchesReportDataSourcePort,
} from "../src/features/reporting-analytics/index.js";
import * as intelligence from "../src/features/intelligence-analytics/index.js";
import { baseDefinitionInput } from "./support/reporting-analytics-test-doubles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ROOT = path.join(ROOT, "src", "features", "reporting-analytics");

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function baseDefinition(overrides = {}) {
  const scope = createReportScope({
    kind: "TENANT",
    tenantId: "venue-1",
  });
  const source = createIntelligenceProjectionReference({
    sourceId: "ia-proj-src",
    projectionId: "proj-occupancy-v1",
    label: "Occupancy",
    configured: true,
  });
  return createReportDefinition(
    baseDefinitionInput({
      reportDefinitionId: "rd-ia-1",
      name: "ia_projection_probe",
      title: "IA Projection Probe",
      scope,
      source,
      ...overrides,
    })
  );
}

test("REPORTING-03 projection adapter imports only public I&A entry", () => {
  const adapterFile = path.join(
    MODULE_ROOT,
    "adapters",
    "intelligenceProjectionSourceAdapter.js"
  );
  const text = fs.readFileSync(adapterFile, "utf8");
  assert.match(
    text,
    /from\s+["']\.\.\/\.\.\/intelligence-analytics\/index\.js["']/
  );
  assert.doesNotMatch(
    text,
    /intelligence-analytics\/(contracts|runtime|registry|dashboard-reporting|facade|projections|aggregation)\//
  );
  for (const file of listJsFiles(MODULE_ROOT)) {
    const body = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      body,
      /from\s+["'].*features\/intelligence-analytics\/(contracts|runtime|registry|dashboard-reporting|facade|projections|aggregation)\//
    );
  }
});

test("REPORTING-03 public I&A contract probe documents missing execute-by-projectionId", () => {
  assert.equal(typeof intelligence.createAnalyticsQueryRuntime, "function");
  assert.equal(typeof intelligence.executeAnalyticsProjection, "function");
  assert.equal(IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT.executeByProjectionId, false);
  assert.equal(
    IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT.deployedRemoteProjectionObject,
    false
  );
  assert.equal(
    IA_PUBLIC_PROJECTION_EXECUTION_CONTRACT.mappingStatus,
    "PROJECTION_SOURCE_NOT_DEPLOYED"
  );
});

test("REPORTING-03 projection adapter is a ReportDataSourcePort and returns not-deployed", async () => {
  const port = createIntelligenceProjectionDataSourcePort();
  assert.equal(matchesReportDataSourcePort(port), true);
  const definition = baseDefinition();
  const raw = await port.execute({
    definition,
    request: {
      actor: { userId: "u1" },
      scope: definition.scope,
      reportDefinitionId: definition.reportDefinitionId,
    },
  });
  assert.equal(raw.availability, REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED);
  assert.equal(
    raw.errorCode,
    REPORTING_ERROR_CODE.PROJECTION_SOURCE_NOT_DEPLOYED
  );
  assert.equal(raw.provenance.state, REPORT_PROVENANCE.UNAVAILABLE);
  assert.equal(raw.provenance.sourceKind, REPORT_SOURCE_KIND.INTELLIGENCE_PROJECTION);
  assert.equal(raw.payload.projectionId, "proj-occupancy-v1");
  assert.equal(raw.payload.tenantId, "venue-1");
  assert.equal(raw.payload.mappingStatus, "PROJECTION_SOURCE_NOT_DEPLOYED");
  assert.deepEqual(raw.rows, []);
  assert.ok(!raw.provenance.state || raw.provenance.state !== REPORT_PROVENANCE.LIVE);
  assert.ok(!raw.provenance.state || raw.provenance.state !== REPORT_PROVENANCE.MOCK);
});

test("REPORTING-03 projection adapter validates projection identity and scope", async () => {
  const port = createIntelligenceProjectionDataSourcePort();
  const definition = baseDefinition();
  await assert.rejects(
    () =>
      port.execute({
        definition: {
          ...definition,
          source: { ...definition.source, projectionId: null },
        },
        request: { actor: { userId: "u1" }, scope: definition.scope },
      }),
    (err) =>
      isReportingError(err) &&
      err.code === REPORTING_ERROR_CODE.INVALID_SOURCE_REFERENCE
  );

  await assert.rejects(
    () =>
      port.execute({
        definition,
        request: {
          actor: { userId: "u1" },
          scope: createReportScope({ kind: "TENANT", tenantId: "other-venue" }),
        },
      }),
    (err) =>
      isReportingError(err) && err.code === REPORTING_ERROR_CODE.FORBIDDEN_SCOPE
  );
});

test("REPORTING-03 projection adapter rejects silent live-to-mock and unproved LIVE", async () => {
  const badMock = createIntelligenceProjectionDataSourcePort({
    iaProjectionExecutor: {
      async executeByProjectionId() {
        return {
          liveFailed: true,
          provenance: { state: REPORT_PROVENANCE.MOCK },
          rows: [{ fake: true }],
        };
      },
    },
  });
  const definition = baseDefinition();
  await assert.rejects(
    () =>
      badMock.execute({
        definition,
        request: { actor: { userId: "u1" }, scope: definition.scope },
      }),
    (err) =>
      isReportingError(err) &&
      err.code === REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED
  );

  const badLive = createIntelligenceProjectionDataSourcePort({
    iaProjectionExecutor: {
      async executeByProjectionId() {
        return {
          availability: REPORT_AVAILABILITY.AVAILABLE,
          provenance: { state: REPORT_PROVENANCE.LIVE },
          rows: [{ v: 1 }],
        };
      },
    },
  });
  await assert.rejects(
    () =>
      badLive.execute({
        definition,
        request: { actor: { userId: "u1" }, scope: definition.scope },
      }),
    (err) =>
      isReportingError(err) &&
      err.code === REPORTING_ERROR_CODE.PROVENANCE_MISMATCH
  );
});

test("REPORTING-03 projection adapter normalizes injected executor failure", async () => {
  const port = createIntelligenceProjectionDataSourcePort({
    iaProjectionExecutor: {
      async executeByProjectionId() {
        throw new Error("ia boom");
      },
    },
  });
  const definition = baseDefinition();
  const raw = await port.execute({
    definition,
    request: { actor: { userId: "u1" }, scope: definition.scope },
  });
  assert.equal(raw.availability, REPORT_AVAILABILITY.SOURCE_FAILED);
  assert.equal(raw.liveFailed, true);
  assert.equal(raw.errorCode, REPORTING_ERROR_CODE.SOURCE_FAILED);
  assert.match(raw.errorMessage, /ia boom/);
  assert.equal(raw.provenance.state, REPORT_PROVENANCE.UNAVAILABLE);
});

test("REPORTING-03 does not claim analytical runtime ownership exports", async () => {
  const reporting = await import("../src/features/reporting-analytics/index.js");
  assert.equal("createAnalyticsQueryRuntime" in reporting, false);
  assert.equal(typeof intelligence.createAnalyticsQueryRuntime, "function");
});
