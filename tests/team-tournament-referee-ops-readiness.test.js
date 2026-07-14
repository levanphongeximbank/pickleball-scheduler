import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  TT5_REQUIRED_RPCS,
  TT5_REQUIRED_TABLES,
  buildProductionUntouchedInventory,
  buildStagingInventoryFromTt5Final,
  evaluateTt5OpsReadiness,
  getS2FSoftGapDisposition,
  summarizeMatchupRefereeOps,
} from "../src/features/team-tournament/engines/teamRefereeOpsReadinessEngine.js";

test("T-S2-F01 staging derived inventory is READY", () => {
  const report = evaluateTt5OpsReadiness(buildStagingInventoryFromTt5Final());
  assert.equal(report.verdict, "READY");
  assert.equal(report.allowProvisionOps, true);
  assert.equal(report.missing.length, 0);
  assert.equal(report.productionSqlApplyAllowed, false);
});

test("T-S2-F02 production untouched is PRODUCTION_NOT_APPLIED", () => {
  const report = evaluateTt5OpsReadiness(buildProductionUntouchedInventory());
  assert.equal(report.verdict, "PRODUCTION_NOT_APPLIED");
  assert.equal(report.sqlApplied, false);
  assert.ok(report.missing.length > 0);
  assert.ok(report.notes.some((n) => n.includes("Production")));
});

test("T-S2-F03 missing RPC marks MISSING_OBJECTS", () => {
  const inventory = buildStagingInventoryFromTt5Final();
  inventory.rpcs = TT5_REQUIRED_RPCS.filter(
    (name) => name !== "team_tournament_provision_referee_match"
  );
  const report = evaluateTt5OpsReadiness(inventory);
  assert.equal(report.verdict, "MISSING_OBJECTS");
  assert.ok(report.missing.includes("rpc:team_tournament_provision_referee_match"));
});

test("T-S2-F04 checklist covers required tables + rpcs", () => {
  assert.ok(TT5_REQUIRED_TABLES.includes("team_sub_match_referee_links"));
  assert.ok(TT5_REQUIRED_RPCS.includes("team_tournament_consume_referee_v5_outbox"));
  assert.equal(TT5_REQUIRED_TABLES.length >= 8, true);
  assert.equal(TT5_REQUIRED_RPCS.length >= 5, true);
});

test("T-S2-F05 soft gaps disposition and live ops summary", () => {
  const gaps = getS2FSoftGapDisposition();
  assert.ok(gaps.some((g) => g.id === "S2-GAP-050"));
  assert.ok(gaps.some((g) => g.id === "S2-GAP-051"));
  assert.ok(gaps.some((g) => g.id === "S2-GAP-052"));

  const ops = summarizeMatchupRefereeOps({
    matchups: [
      {
        subMatches: [
          { refereeLinkOps: { hasLink: true, status: "finalized" } },
          { refereeLinkOps: { canProvision: true } },
          { refereeLinkOps: { hasLink: true, status: "sync_error" } },
        ],
      },
    ],
  });
  assert.equal(ops.linked, 2);
  assert.equal(ops.provisionable, 1);
  assert.equal(ops.syncError, 1);
  assert.equal(ops.finalized, 1);
});

test("T-S2-F06 readiness panel + evidence path exist", () => {
  const panel = path.join(
    process.cwd(),
    "src/components/tournament/team/TeamRefereeOpsReadinessPanel.jsx"
  );
  assert.equal(fs.existsSync(panel), true);
  const evidenceDir = path.join(process.cwd(), "docs/v5/qa-evidence/phase-tt5");
  assert.equal(fs.existsSync(evidenceDir), true);
});
