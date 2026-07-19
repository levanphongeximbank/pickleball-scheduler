/**
 * Phase 2C — Production schema rollout gate tests (offline).
 * Proves stop conditions when Owner checklist / backup / preflight are incomplete.
 * Does not connect to Production.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase2bProductionApplyDryRun } from "../scripts/apply-notification-phase2b-production-sql.mjs";
import { verifyPhase2bProductionFixture } from "../scripts/verify-notification-phase2b-production.mjs";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  PRODUCTION_RUNTIME_DEFAULTS,
} from "../src/features/notifications/config/productionSafetyConfig.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readChecklist() {
  return fs.readFileSync(
    path.join(rootDir, "docs/NOTIFICATION-PHASE-2B-REQUIRE-SUPABASE-CHECKLIST.md"),
    "utf8"
  );
}

function evaluateOwnerChecklist(content) {
  const checked = (content.match(/- \[x\]/gi) || []).length;
  const unchecked = (content.match(/- \[ \]/g) || []).length;
  const hasOwnerNameFilled =
    /Owner name:\s*[^\s_][\s\S]*?/i.test(content) &&
    !/Owner name:\s*_{3,}/i.test(content.split("## F. Owner approval")[1] || "");
  const signatureBlank = /\|\s*Owner\s*\|\s*\|\s*\|\s*\|/.test(content);
  return {
    checked,
    unchecked,
    complete: checked > 0 && unchecked === 0 && hasOwnerNameFilled && !signatureBlank,
    blockedReason:
      unchecked > 0 || !hasOwnerNameFilled || signatureBlank
        ? "owner_checklist_incomplete"
        : null,
  };
}

describe("Notification Phase 2C — rollout stop gates", () => {
  it("Owner checklist is incomplete → BLOCKED before Production write", () => {
    const gate = evaluateOwnerChecklist(readChecklist());
    assert.equal(gate.complete, false);
    assert.equal(gate.blockedReason, "owner_checklist_incomplete");
    assert.ok(gate.unchecked > 0);
  });

  it("No Production local env file in workspace (fail closed)", () => {
    assert.equal(fs.existsSync(path.join(rootDir, ".env.production.local")), false);
  });

  it("Dry-run PASS without applying SQL", () => {
    const result = runPhase2bProductionApplyDryRun();
    assert.equal(result.verdict, "PASS");
    assert.equal(result.sqlApplied, false);
  });

  it("Fixture verify PASS for Production pack defaults", () => {
    const result = verifyPhase2bProductionFixture({
      runtimeConfig: { ...PRODUCTION_RUNTIME_DEFAULTS },
    });
    assert.equal(result.verdict, "PASS");
  });

  it("Phase 2C evidence doc records BLOCKED and non-actions", () => {
    const doc = fs.readFileSync(
      path.join(rootDir, "docs/NOTIFICATION-PHASE-2C-PRODUCTION-SCHEMA-ROLLOUT.md"),
      "utf8"
    );
    assert.ok(doc.includes("**BLOCKED**"));
    assert.ok(doc.includes("SQL applied: **false**"));
    assert.ok(doc.includes("Worker enabled: **false**"));
    assert.ok(!doc.includes(STAGING_PROJECT_REF + "'true'"));
    assert.ok(doc.includes(PRODUCTION_PROJECT_REF));
    assert.ok(doc.includes("Rollback performed"));
    assert.ok(/Rollback performed\s*\|\s*\*\*false\*\*/i.test(doc));
  });

  it("Live apply remains gated without ALLOW_LIVE_APPLY", () => {
    assert.equal(
      String(process.env.NOTIFICATION_PHASE2B_ALLOW_LIVE_APPLY || "").trim() === "1",
      false
    );
    assert.equal(
      String(process.env.NOTIFICATION_PHASE2B_PRODUCTION_GO || "").trim() === "1",
      false
    );
  });
});
