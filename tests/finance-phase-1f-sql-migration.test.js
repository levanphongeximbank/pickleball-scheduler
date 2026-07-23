/**
 * Phase 1F — Finance SQL migration package (static verification only).
 * Does not connect to a database. Does not invoke Supabase CLI. Does not apply SQL.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forwardPath = path.join(root, "docs/supabase-finance-phase1f.sql");
const rollbackPath = path.join(root, "docs/supabase-finance-phase1f-rollback.sql");
const architecturePath = path.join(root, "src/features/finance/ARCHITECTURE.md");
const persistenceDesignPath = path.join(
  root,
  "src/features/finance/persistence/PERSISTENCE_DESIGN.md"
);

const REQUIRED_TABLES = [
  "finance_fee_definitions",
  "finance_obligations",
  "finance_invoices",
  "finance_invoice_items",
  "finance_payments",
  "finance_payment_attempts",
  "finance_receipts",
  "finance_refunds",
  "finance_events",
  "finance_idempotency",
  "finance_audit_evidence",
];

const BILLING_TABLES = [
  "public.invoices",
  "public.invoice_items",
  "public.payments",
  "public.plans",
  "public.plan_limits",
  "public.tenant_subscriptions",
  "public.billing_events",
  "public.billing_audit_logs",
];

const MUTABLE_WITH_VERSION = [
  "finance_fee_definitions",
  "finance_obligations",
  "finance_invoices",
  "finance_payments",
  "finance_payment_attempts",
  "finance_refunds",
  "finance_idempotency",
  "finance_audit_evidence",
];

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

test("1F migration files exist at canonical docs/supabase location", () => {
  assert.ok(fs.existsSync(forwardPath), "forward migration must exist");
  assert.ok(fs.existsSync(rollbackPath), "rollback migration must exist");
  assert.equal(
    path.relative(root, forwardPath).replace(/\\/g, "/"),
    "docs/supabase-finance-phase1f.sql"
  );
  assert.equal(
    path.relative(root, rollbackPath).replace(/\\/g, "/"),
    "docs/supabase-finance-phase1f-rollback.sql"
  );
});

test("1F forward defines all required Finance tables and no Billing alterations", () => {
  const sql = read(forwardPath);
  const body = stripSqlComments(sql);

  for (const table of REQUIRED_TABLES) {
    assert.match(
      body,
      new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "i"),
      `missing table ${table}`
    );
    assert.match(
      body,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
      `RLS not enabled on ${table}`
    );
    assert.match(body, new RegExp(`\\btenant_id\\b[\\s\\S]*?${table}|${table}[\\s\\S]*?\\btenant_id\\b`, "i"));
  }

  for (const billing of BILLING_TABLES) {
    const bare = billing.replace(/^public\./, "");
    assert.doesNotMatch(
      body,
      new RegExp(`(alter|drop)\\s+table\\s+(if\\s+exists\\s+)?${billing.replace(".", "\\.")}\\b`, "i"),
      `must not alter Billing table ${billing}`
    );
    assert.doesNotMatch(
      body,
      new RegExp(`(alter|drop)\\s+table\\s+(if\\s+exists\\s+)?public\\.${bare}\\b`, "i")
    );
  }

  // Must not create unprefixed Billing collisions as Finance SoT
  assert.doesNotMatch(body, /create\s+table\s+if\s+not\s+exists\s+public\.invoices\b/i);
  assert.doesNotMatch(body, /create\s+table\s+if\s+not\s+exists\s+public\.payments\b/i);
});

test("1F money uses bigint minor units and VND currency constraint", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.match(body, /amount_minor\s+bigint/i);
  assert.match(body, /line_total_minor\s+bigint/i);
  assert.match(body, /unit_amount_minor\s+bigint/i);
  assert.doesNotMatch(body, /amount_minor\s+(numeric|double\s+precision|real|float)/i);
  assert.match(body, /currency_vnd_v1_check/i);
  assert.match(body, /currency\s*=\s*'VND'/i);
});

test("1F uniqueness: idempotency, provider txn, event id, receipt, attempt", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.match(
    body,
    /finance_idempotency_tenant_op_key_uidx\s+unique\s*\(\s*tenant_id\s*,\s*operation_type\s*,\s*idempotency_key\s*\)/i
  );
  assert.match(body, /finance_payments_tenant_provider_txn_uidx/i);
  assert.match(body, /where\s+provider_transaction_reference\s+is\s+not\s+null/i);
  assert.match(body, /finance_events_tenant_id_id_key\s+unique\s*\(\s*tenant_id\s*,\s*id\s*\)/i);
  assert.match(body, /finance_events_pkey\s+primary\s+key\s*\(\s*id\s*\)/i);
  assert.match(body, /finance_receipts_tenant_payment_uidx/i);
  assert.match(body, /finance_payment_attempts_tenant_payment_number_uidx/i);
});

test("1F optimistic concurrency version columns on mutable aggregates", () => {
  const sql = read(forwardPath);
  for (const table of MUTABLE_WITH_VERSION) {
    const createMatch = sql.match(
      new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\);`, "i")
    );
    assert.ok(createMatch, `create block for ${table}`);
    const block = createMatch[1];
    assert.match(block, /\bversion\s+integer\s+not\s+null\s+default\s+1/i);
    assert.match(block, new RegExp(`${table}_version_check\\s+check\\s*\\(\\s*version\\s*>=\\s*1\\s*\\)`, "i"));
  }
});

test("1F event append-only represented via grants and missing update/delete policies", () => {
  const sql = read(forwardPath);
  const body = stripSqlComments(sql);
  assert.match(sql, /Append-only Finance events/i);
  assert.match(body, /grant\s+select\s+on\s+table\s+public\.finance_events\s+to\s+authenticated/i);
  assert.match(body, /grant\s+insert\s+on\s+table\s+public\.finance_events\s+to\s+authenticated/i);
  assert.doesNotMatch(
    body,
    /grant\s+(update|delete|all)\b[\s\S]{0,80}public\.finance_events/i
  );
  assert.doesNotMatch(body, /create\s+policy\s+finance_events_update\b/i);
  assert.doesNotMatch(body, /create\s+policy\s+finance_events_delete\b/i);
  assert.match(body, /create\s+policy\s+finance_events_insert\b/i);
  assert.match(body, /create\s+policy\s+finance_events_select\b/i);
});

test("1F RLS uses authoritative tenant mapping and denies public/anon grants", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.match(body, /user_venue_id\s*\(\s*\)/i);
  assert.match(body, /user_has_permission\s*\(\s*'finance\.view'\s*\)/i);
  assert.match(body, /user_has_permission\s*\(\s*'finance\.edit'\s*\)/i);
  assert.match(body, /with\s+check/i);
  assert.doesNotMatch(body, /grant\s+all\s+on\s+table\s+public\.finance_/i);
  assert.doesNotMatch(body, /grant\s+.+\s+on\s+table\s+public\.finance_\w+\s+to\s+anon/i);
  assert.doesNotMatch(body, /grant\s+.+\s+on\s+table\s+public\.finance_\w+\s+to\s+public\b/i);
  assert.match(body, /revoke\s+all\s+on\s+table\s+public\.finance_events\s+from\s+anon/i);
  assert.match(body, /to\s+authenticated/i);
});

test("1F evidence restrictions and no obvious secret / raw_payload columns", () => {
  const sql = read(forwardPath);
  const body = stripSqlComments(sql);
  assert.match(sql, /No blobs, secrets, CVV/i);
  assert.match(body, /finance_audit_evidence_no_secret_metadata_check/i);
  assert.match(body, /finance_events_no_secret_payload_check/i);

  // Forbidden names may appear as rejected JSON keys in CHECK arrays; they must
  // not exist as table columns.
  const createBlocks = [...body.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.finance_\w+\s*\(([\s\S]*?)\);/gi)];
  assert.ok(createBlocks.length >= REQUIRED_TABLES.length);
  for (const match of createBlocks) {
    const cols = match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[a-z_][a-z0-9_]*\s+/i.test(line) && !/^constraint\b/i.test(line));
    const colNames = cols.map((line) => line.split(/\s+/)[0].toLowerCase());
    for (const forbidden of [
      "raw_payload",
      "authorization_header",
      "access_token",
      "refresh_token",
      "webhook_secret",
      "cvv",
      "card_number",
      "api_key",
      "secret",
    ]) {
      assert.ok(!colNames.includes(forbidden), `column ${forbidden} must not exist`);
    }
  }
});

test("1F tenant indexes present for bounded access patterns", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.match(body, /finance_payments_tenant_status_idx/i);
  assert.match(body, /finance_events_tenant_recorded_idx/i);
  assert.match(body, /finance_events_tenant_correlation_idx/i);
  assert.match(body, /finance_invoice_items_tenant_invoice_idx/i);
  assert.match(body, /finance_payment_attempts_tenant_payment_idx/i);
  assert.match(body, /finance_refunds_tenant_payment_idx/i);
  assert.match(body, /finance_audit_evidence_tenant_external_ref_idx/i);
});

test("1F rollback differs from forward and targets only Finance objects", () => {
  const forward = read(forwardPath);
  const rollback = read(rollbackPath);
  assert.notEqual(forward, rollback);
  assert.match(rollback, /DESTROYS all operational Finance data/i);
  assert.match(rollback, /drop table if exists public\.finance_events/i);
  assert.match(rollback, /drop table if exists public\.finance_payments/i);
  assert.match(rollback, /drop policy if exists finance_events_insert/i);

  const body = stripSqlComments(rollback);
  for (const billing of BILLING_TABLES) {
    assert.doesNotMatch(
      body,
      new RegExp(`drop\\s+table\\s+.*${billing.replace(".", "\\.")}`, "i")
    );
  }
  assert.doesNotMatch(body, /drop\s+table\s+if\s+exists\s+public\.invoices\b/i);
  assert.doesNotMatch(body, /drop\s+table\s+if\s+exists\s+public\.payments\b/i);
  assert.doesNotMatch(body, /drop\s+table\s+if\s+exists\s+public\.plans\b/i);
  assert.doesNotMatch(body, /cascade\b/i);
  assert.doesNotMatch(body, /truncate\b/i);

  // Child before parent ordering signals
  const eventsPos = body.toLowerCase().indexOf("drop table if exists public.finance_events");
  const paymentsPos = body.toLowerCase().indexOf("drop table if exists public.finance_payments");
  const feePos = body.toLowerCase().indexOf("drop table if exists public.finance_fee_definitions");
  assert.ok(eventsPos >= 0 && paymentsPos >= 0 && feePos >= 0);
  assert.ok(eventsPos < feePos);
  assert.ok(paymentsPos < feePos);
});

test("1F has no legacy data migration / backfill executable SQL", () => {
  const body = stripSqlComments(read(forwardPath) + "\n" + read(rollbackPath));
  assert.doesNotMatch(body, /insert\s+into\s+public\.finance_/i);
  assert.doesNotMatch(body, /from\s+finance.?ledger/i);
  assert.doesNotMatch(body, /backfill/i);
  assert.doesNotMatch(body, /copy\s+/i);
});

test("1F does not invent SECURITY DEFINER helpers in this phase", () => {
  const body = stripSqlComments(read(forwardPath));
  assert.doesNotMatch(body, /security\s+definer/i);
  assert.doesNotMatch(body, /create\s+(or\s+replace\s+)?function\s+public\.finance_/i);
});

test("1F documentation records authored / not applied distinctions", () => {
  const arch = read(architecturePath);
  const design = read(persistenceDesignPath);
  assert.match(arch, /supabase-finance-phase1f\.sql/);
  assert.match(arch, /SQL authored/i);
  assert.match(arch, /not applied/i);
  assert.match(design, /supabase-finance-phase1f\.sql/);
  assert.match(design, /finance_\*/);
  assert.match(design, /not applied/i);
  assert.match(design, /SaaS Billing/i);
});

test("1F does not modify historical migration files (package is additive)", () => {
  // Static package check: only the two Finance phase1f files are the migration artifacts.
  const docs = fs.readdirSync(path.join(root, "docs"));
  const financeSql = docs.filter((f) => /^supabase-finance/i.test(f));
  assert.deepEqual(
    financeSql.sort(),
    ["supabase-finance-phase1f-rollback.sql", "supabase-finance-phase1f.sql"].sort()
  );
  assert.ok(fs.existsSync(path.join(root, "docs/supabase-billing-phase9.sql")));
});
