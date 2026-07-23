#!/usr/bin/env node
/** Supplemental Phase 1H integrity probes (Staging only). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadToken() {
  for (const rel of [
    "../club-management/.env.staging-qa.local",
    "../crm/.env.staging-qa.local",
    ".env.staging-qa.local",
  ]) {
    const abs = path.resolve(rootDir, rel);
    if (!fs.existsSync(abs)) continue;
    const values = parseEnvFile(fs.readFileSync(abs, "utf8"));
    const url = String(values.STAGING_SUPABASE_URL || values.VITE_SUPABASE_URL || "");
    if (url.includes(PRODUCTION_REF)) throw new Error("Production URL refused");
    if (values.SUPABASE_ACCESS_TOKEN) return String(values.SUPABASE_ACCESS_TOKEN).trim();
  }
  throw new Error("token missing");
}

async function sql(token, query, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${label}: ${body?.message || body?.error || res.statusText}`);
  }
  return body;
}

const QA = `
do $$
declare
  t text := 'FINANCE_QA_TENANT_A';
  t2 text := 'FINANCE_QA_TENANT_B';
  inv text := 'FINANCE_QA_INV_001';
  pay text := 'FINANCE_QA_PAY_001';
  att text := 'FINANCE_QA_ATT_001';
  rcp text := 'FINANCE_QA_RCP_001';
  ev text := 'FINANCE_QA_EVID_001';
begin
  insert into public.finance_audit_evidence (
    id, tenant_id, evidence_type, provider_code, external_reference, captured_at, metadata
  ) values (
    ev, t, 'PROVIDER_CONFIRMATION', 'mock', 'FINANCE_QA_EXT_1', now(), '{"qa":true}'::jsonb
  );

  begin
    insert into public.finance_audit_evidence (
      id, tenant_id, evidence_type, provider_code, external_reference, captured_at, metadata
    ) values (
      'FINANCE_QA_EVID_BAD', t, 'PROVIDER_CONFIRMATION', 'mock', 'x', now(), '{"secret":"nope"}'::jsonb
    );
    raise exception 'EXPECTED_FAIL secret metadata accepted';
  exception when check_violation then
    null;
  end;

  insert into public.finance_invoices (
    id, tenant_id, status, amount_minor, currency, version, issued_at
  ) values (
    inv, t, 'ISSUED', 10000, 'VND', 1, now()
  );

  insert into public.finance_payments (
    id, tenant_id, payment_reference, invoice_id, status, amount_minor, currency, version,
    provider_code, provider_transaction_reference, evidence_ref, audit_evidence_ref
  ) values (
    pay, t, 'FINANCE_QA_PAYREF_1', inv, 'CONFIRMED', 10000, 'VND', 1,
    'mock', 'FINANCE_QA_TXN_1', ev, ev
  );

  begin
    insert into public.finance_payments (
      id, tenant_id, payment_reference, invoice_id, status, amount_minor, currency, version,
      provider_code, provider_transaction_reference
    ) values (
      'FINANCE_QA_PAY_002', t, 'FINANCE_QA_PAYREF_2', inv, 'PENDING', 10000, 'VND', 1,
      'mock', 'FINANCE_QA_TXN_1'
    );
    raise exception 'EXPECTED_FAIL duplicate provider txn accepted';
  exception when unique_violation then
    null;
  end;

  insert into public.finance_invoices (
    id, tenant_id, status, amount_minor, currency, version, issued_at
  ) values (
    'FINANCE_QA_INV_B', t2, 'ISSUED', 5000, 'VND', 1, now()
  );
  insert into public.finance_payments (
    id, tenant_id, payment_reference, invoice_id, status, amount_minor, currency, version,
    provider_code, provider_transaction_reference
  ) values (
    'FINANCE_QA_PAY_B', t2, 'FINANCE_QA_PAYREF_B', 'FINANCE_QA_INV_B', 'PENDING', 5000, 'VND', 1,
    'mock', 'FINANCE_QA_TXN_1'
  );

  insert into public.finance_payment_attempts (
    id, tenant_id, payment_id, attempt_number, status, amount_minor, currency,
    provider_code, provider_transaction_reference, evidence_ref
  ) values (
    att, t, pay, 1, 'CONFIRMED', 10000, 'VND', 'mock', 'FINANCE_QA_TXN_1', ev
  );

  begin
    insert into public.finance_payment_attempts (
      id, tenant_id, payment_id, attempt_number, status, amount_minor, currency, evidence_ref
    ) values (
      'FINANCE_QA_ATT_DUP', t, pay, 1, 'CONFIRMED', 10000, 'VND', ev
    );
    raise exception 'EXPECTED_FAIL duplicate attempt accepted';
  exception when unique_violation then
    null;
  end;

  insert into public.finance_receipts (
    id, tenant_id, payment_id, payment_reference, amount_minor, currency,
    issued_at, evidence_ref, audit_evidence_ref
  ) values (
    rcp, t, pay, 'FINANCE_QA_PAYREF_1', 10000, 'VND', now(), ev, ev
  );

  begin
    insert into public.finance_receipts (
      id, tenant_id, payment_id, payment_reference, amount_minor, currency, issued_at, evidence_ref
    ) values (
      'FINANCE_QA_RCP_DUP', t, pay, 'FINANCE_QA_PAYREF_1', 10000, 'VND', now(), ev
    );
    raise exception 'EXPECTED_FAIL duplicate receipt for payment accepted';
  exception when unique_violation then
    null;
  end;

  if exists (
    select 1 from pg_policy
    where polrelid = 'public.finance_receipts'::regclass
      and polcmd = 'w'
  ) then
    raise exception 'UNEXPECTED update policy on finance_receipts';
  end if;

  if exists (
    select 1 from pg_policy
    where polrelid = 'public.finance_events'::regclass
      and polcmd in ('w', 'd')
  ) then
    raise exception 'UNEXPECTED update/delete policy on finance_events';
  end if;
end $$;

select json_build_object(
  'payments', (select count(*)::int from public.finance_payments where id like 'FINANCE_QA_%'),
  'attempts', (select count(*)::int from public.finance_payment_attempts where id like 'FINANCE_QA_%'),
  'receipts', (select count(*)::int from public.finance_receipts where id like 'FINANCE_QA_%'),
  'receipt_update_policies', (
    select count(*)::int from pg_policy
    where polrelid = 'public.finance_receipts'::regclass and polcmd = 'w'
  ),
  'event_mut_policies', (
    select count(*)::int from pg_policy
    where polrelid = 'public.finance_events'::regclass and polcmd in ('w','d')
  )
) as qa;
`;

const CLEANUP = `
delete from public.finance_receipts where id like 'FINANCE_QA_%';
delete from public.finance_payment_attempts where id like 'FINANCE_QA_%';
delete from public.finance_payments where id like 'FINANCE_QA_%';
delete from public.finance_invoices where id like 'FINANCE_QA_%';
delete from public.finance_audit_evidence where id like 'FINANCE_QA_%';
select json_build_object(
  'remaining_payments', (select count(*)::int from public.finance_payments where id like 'FINANCE_QA_%'),
  'remaining_receipts', (select count(*)::int from public.finance_receipts where id like 'FINANCE_QA_%'),
  'remaining_evidence', (select count(*)::int from public.finance_audit_evidence where id like 'FINANCE_QA_%'),
  'retained_events', (
    select coalesce(json_agg(id order by id), '[]'::json)
    from public.finance_events where id like 'FINANCE_QA_%'
  )
) as cleanup;
`;

const token = loadToken();
const qaBody = await sql(token, QA, "supplemental-qa");
const qa = Array.isArray(qaBody) ? qaBody[0]?.qa : qaBody?.qa;
const cleanupBody = await sql(token, CLEANUP, "supplemental-cleanup");
const cleanup = Array.isArray(cleanupBody) ? cleanupBody[0]?.cleanup : cleanupBody?.cleanup;
const out = {
  phase: "1H",
  stagingRef: STAGING_REF,
  productionTouched: false,
  finishedAt: new Date().toISOString(),
  qa,
  cleanup,
  status: "PASS",
  forwardSha256: createHash("sha256")
    .update(fs.readFileSync(path.join(rootDir, "docs/supabase-finance-phase1f.sql")))
    .digest("hex"),
};
fs.mkdirSync(path.join(rootDir, "src/features/finance/persistence/staging"), { recursive: true });
fs.writeFileSync(
  path.join(rootDir, "src/features/finance/persistence/staging/SUPPLEMENTAL_INTEGRITY_QA.json"),
  `${JSON.stringify(out, null, 2)}\n`
);
console.log(JSON.stringify(out, null, 2));
