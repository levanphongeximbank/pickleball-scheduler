#!/usr/bin/env node
/**
 * B-R09 — Tenant type static gate (fail-closed).
 * Scans proposed executable ledger SQL for incompatible tenant_id uuid usage
 * and uuid/text comparison hazards. No database connection.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const LEDGER = path.join(
  ROOT,
  "docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02/02_PROPOSED_EXECUTABLE_BLANK_DB_LEDGER.json"
);

function fail(msg, details) {
  const out = {
    marker: "PHASE5D_TENANT_TYPE_STATIC_GATE_V1",
    pass: false,
    error: msg,
    details,
  };
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}

if (!fs.existsSync(LEDGER)) fail("ledger missing", { LEDGER });
const ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
const findings = [];
const inspected = [];

for (const e of ledger.orderedEntries || []) {
  const abs = path.join(ROOT, e.path);
  if (!fs.existsSync(abs)) fail("ledger path missing", e.path);
  const buf = fs.readFileSync(abs);
  const text = buf.toString("utf8");
  // Strip line/block comments so remediation comments like "tenant_id uuid → text" do not false-positive.
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
  const lc = code.toLowerCase();
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const entry = {
    migrationId: e.migrationId,
    path: e.path,
    sha256,
    bytes: buf.length,
    // Column declarations only (CREATE TABLE / ALTER ADD COLUMN style)
    tenantIdUuid: (lc.match(/\btenant_id\s+uuid\b/g) || []).length,
    pTenantIdUuid: (lc.match(/\bp_tenant_id\s+uuid\b/g) || []).length,
    // Unresolved uuid/text comparisons in executable expressions (exclude ::text casts used to migrate uuid→text)
    uuidEqText: (lc.match(/\btenant_id\s*::\s*uuid\s*=\s*[^;]*::\s*text|\b[^:]*::\s*text\s*=\s*tenant_id\s*::\s*uuid/g) || [])
      .length,
  };
  inspected.push(entry);
  if (entry.tenantIdUuid || entry.pTenantIdUuid || entry.uuidEqText) findings.push(entry);
}

// Canonical helpers expected in foundation
const rbac = fs.readFileSync(path.join(ROOT, "docs/supabase-rbac.sql"), "utf8").toLowerCase();
const venuesText = /venues[\s\S]{0,400}id\s+text/.test(rbac) || /create table[\s\S]*venues[\s\S]*\bid\s+text\b/.test(rbac);
const userVenueReturnsText = /create\s+(or\s+replace\s+)?function\s+public\.user_venue_id\s*\([\s\S]*?returns\s+text/.test(
  rbac
);

const result = {
  marker: "PHASE5D_TENANT_TYPE_STATIC_GATE_V1",
  pass: findings.length === 0 && venuesText && userVenueReturnsText,
  zeroIncompatibleTenantIdUuidInLedger: findings.length === 0,
  venuesIdCompatibleWithText: venuesText,
  userVenueIdReturnsText: userVenueReturnsText,
  findingCount: findings.length,
  findings,
  inspectedFileCount: inspected.length,
  inspected,
};

const outPath =
  "docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02/11_TENANT_TYPE_STATIC_GATE_RESULTS.json";
fs.mkdirSync(path.dirname(path.join(ROOT, outPath)), { recursive: true });
fs.writeFileSync(path.join(ROOT, outPath), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ pass: result.pass, findingCount: result.findingCount, inspected: inspected.length }, null, 2));
if (!result.pass) process.exit(1);
