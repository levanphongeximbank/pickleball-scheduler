import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const evidence = JSON.parse(fs.readFileSync("docs/v6/PHASE6_OWNER_DISPOSITION_CHECKPOINT.json", "utf8"));

test("Owner checkpoint cannot authorize Production mutation", () => {
  assert.equal(evidence.productionGo, false);
  assert.equal(evidence.productionMutationAuthorized, false);
  assert.equal(evidence.status, "PENDING_OWNER_ACCEPTANCE");
  assert.match(evidence.requiredAcceptance, /PRODUCTION GO REMAINS NO$/);
});

test("all current readiness observations are explicit", () => {
  assert.equal(evidence.observations.length, 7);
  for (const required of ["EXPECTED_M9_PRODUCTION_TABLE_DELTA", "DIRECT_PRODUCTION_PG_CATALOG_DEFERRED_TO_STOP_BEFORE_MUTATION_GATE", "LEAKED_PASSWORD_PROTECTION_DASHBOARD_WARN"]) {
    assert.ok(evidence.observations.includes(required));
  }
});

