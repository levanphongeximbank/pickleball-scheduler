import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assessAuditPreflight,
  LEGACY_FIXED_45A3C_AUDIT_ACTIONS,
  parseActionLiteralsFromConstraintDef,
  PHASE_1B_KNOWN_AUDIT_ACTIONS,
} from "../scripts/apply-phase1b-staging-sql.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, rel), "utf8");
}

describe("Phase 1B — additive audit whitelist + apply preflight", () => {
  it("additive SQL unions historical DISTINCT actions with known Phase 1B set", () => {
    const sql = read("../docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql");
    assert.match(sql, /select distinct action/i);
    assert.match(sql, /from public\.audit_logs/i);
    assert.match(sql, /union/i);
    assert.match(sql, /drop constraint if exists audit_logs_action_check/i);
    assert.match(sql, /add constraint audit_logs_action_check/i);
    assert.doesNotMatch(sql, /^\s*TRUNCATE\b/im);
    assert.doesNotMatch(sql, /^\s*DELETE\s+FROM\s+public\.audit_logs/im);
    for (const action of [
      "club.update",
      "club.member.add",
      "club.member.remove",
      "club.member.restore",
      "club.assign_vice_president",
      "club.clear_vice_president",
      "pairing_override",
      "group_override",
    ]) {
      assert.ok(sql.includes(`'${action}'`), `missing known action ${action}`);
    }
  });

  it("apply order doc lists audit additive before RPC files", () => {
    const md = read("../docs/v5/phase1b/PHASE_1B_STAGING_APPLY_ORDER.md");
    const section = md.slice(md.indexOf("## Staging apply order"));
    const additiveIdx = section.indexOf("PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql");
    const updateIdx = section.indexOf("PHASE_45A3C_CLUB_UPDATE_RPC.sql");
    const memberIdx = section.indexOf("PHASE_45A4C1_MEMBER_RPC.sql");
    const restoreIdx = section.indexOf("PHASE_45A4D1_MEMBER_RESTORE_RPC.sql");
    const vpIdx = section.indexOf("PHASE_1B_V2_COMMAND_COMPLETION.sql");
    assert.ok(additiveIdx >= 0 && updateIdx > additiveIdx);
    assert.ok(memberIdx > updateIdx && restoreIdx > memberIdx && vpIdx > restoreIdx);
    assert.match(md, /must run first/i);
  });

  it("apply script SQL_FILES starts with additive audit and forbids fixed lists in RPC files", () => {
    const script = read("../scripts/apply-phase1b-staging-sql.mjs");
    const filesBlock = script.slice(script.indexOf("const SQL_FILES"), script.indexOf("];") + 2);
    assert.match(filesBlock, /PHASE_1B_AUDIT_WHITELIST_ADDITIVE\.sql/);
    const additivePos = filesBlock.indexOf("PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql");
    const updatePos = filesBlock.indexOf("PHASE_45A3C_CLUB_UPDATE_RPC.sql");
    assert.ok(additivePos >= 0 && updatePos > additivePos);
    assert.match(script, /PREFLIGHT_SQL/);
    assert.match(script, /process\.exitCode/);
    assert.doesNotMatch(
      script.slice(script.indexOf("async function main")),
      /process\.exit\(\s*1\s*\)/
    );
  });

  it("parseActionLiteralsFromConstraintDef extracts IN-list literals", () => {
    const def =
      "CHECK ((action = ANY (ARRAY['login'::text, 'pairing_override'::text, 'club.update'::text])))";
    // pg often formats as CHECK (action IN ('a', 'b')) — support both quote styles
    const classic = "CHECK (action IN ('login', 'pairing_override', 'club.update'))";
    assert.deepEqual(parseActionLiteralsFromConstraintDef(classic), [
      "login",
      "pairing_override",
      "club.update",
    ]);
    assert.ok(parseActionLiteralsFromConstraintDef(def).includes("pairing_override"));
  });

  it("assessAuditPreflight reports fixed-list incompatibles but additive is safe", () => {
    const assessment = assessAuditPreflight({
      constraintDef: "CHECK (action IN ('login', 'pairing_override', 'club.create'))",
      distinctActions: [
        { action: "login", row_count: 10 },
        { action: "pairing_override", row_count: 2 },
        { action: "club.create", row_count: 1 },
      ],
      knownActions: PHASE_1B_KNOWN_AUDIT_ACTIONS,
      fixedLegacyActions: LEGACY_FIXED_45A3C_AUDIT_ACTIONS,
    });
    assert.equal(assessment.safeToApplyAdditive, true);
    assert.equal(assessment.block, false);
    assert.deepEqual(assessment.incompatibleHistoricalValues, []);
    assert.ok(assessment.incompatibleWithFixedLegacyList.includes("pairing_override"));
    assert.ok(assessment.proposedMissingValues.includes("club.update"));
    assert.ok(assessment.proposedMissingValues.includes("club.assign_vice_president"));
  });

  it("RPC SQL files no longer contain fixed audit_logs_action_check swaps", () => {
    for (const rel of [
      "../docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql",
      "../docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql",
      "../docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql",
      "../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql",
    ]) {
      const sql = read(rel);
      assert.doesNotMatch(sql, /add constraint\s+audit_logs_action_check/i, rel);
      assert.match(sql, /PHASE_1B_AUDIT_WHITELIST_ADDITIVE\.sql/, rel);
    }
  });
});
