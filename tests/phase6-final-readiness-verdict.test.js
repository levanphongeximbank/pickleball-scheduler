import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const matrix = JSON.parse(fs.readFileSync("docs/v6/PHASE6_READINESS_MATRIX.json", "utf8"));
const report = fs.readFileSync("docs/v6/PHASE6_READINESS_REPORT.md", "utf8");

test("final verdict has no undispositioned HIGH/CRITICAL blocker", () => {
  assert.equal(matrix.verdict, "PHASE6_READINESS_PASS_WITH_OBSERVATIONS");
  assert.equal(matrix.rows.length, matrix.controlCount);
  assert.equal(matrix.controlsDispositioned, matrix.controlCount);
  assert.equal(matrix.rows.some((row) => row.blockingReadiness), false);
  assert.equal(matrix.rows.some((row) => ["OPEN_BLOCKER", "UNKNOWN_REQUIRES_EVIDENCE"].includes(row.status)), false);
});

test("readiness verdict never implies Production GO", () => {
  assert.equal(matrix.productionGo, false);
  assert.equal(matrix.productionMutationAuthorized, false);
  assert.equal(matrix.productionMutations, 0);
  assert.match(report, /PRODUCTION_GO=NO/);
  assert.match(report, /PRODUCTION_MUTATIONS=0/);
});

