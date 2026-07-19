#!/usr/bin/env node
/**
 * Controlled Staging fixture for cancel audit (Staging only).
 * Creates a pending request, cancels as owner, asserts one audit row.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase2c-cancel-audit-staging");

async function q(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${label}: ${body?.message || JSON.stringify(body)}`);
  }
  return body;
}

function first(body, key) {
  if (Array.isArray(body)) return body[0]?.[key] ?? body[0];
  return body?.[key] ?? body;
}

async function main() {
  loadProjectEnv();
  const url = String(process.env.VITE_SUPABASE_URL || process.env.STAGING_SUPABASE_URL || "");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSED Production URL");

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("BLOCKED_NO_TOKEN");
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const report = { phase: "2C-cancel-fixture", stagingRef: STAGING_REF, productionTouched: false };

  const setupBody = await q(
    token,
    `select json_build_object(
      'club', (select jsonb_build_object('id', id, 'tenant_id', tenant_id)
               from public.clubs where deleted_at is null and status = 'active' limit 1),
      'user', (select id::text from auth.users order by created_at asc limit 1)
    ) as s;`,
    "setup"
  );
  const setup = first(setupBody, "s");
  const clubId = setup?.club?.id;
  const tenantId = setup?.club?.tenant_id;
  const userId = setup?.user;
  if (!clubId || !userId) throw new Error("No staging club/user for fixture");

  const reqRowId = randomUUID();
  const idempotencyKey = randomUUID();
  const marker = `phase2c-cancel-audit-fixture-${idempotencyKey.slice(0, 8)}`;

  // Insert pending request owned by user (service role path).
  await q(
    token,
    `insert into public.club_membership_requests_v42
      (id, tenant_id, club_id, user_id, message, status, version)
     values
      ('${reqRowId}'::uuid, '${tenantId}', '${clubId}', '${userId}'::uuid,
       '${marker}', 'pending', 1);`,
    "insert-pending"
  );

  // Cancel as that user via JWT claim simulation.
  const cancelBody = await q(
    token,
    `select
       set_config('request.jwt.claim.sub', '${userId}', true),
       set_config('request.jwt.claim.role', 'authenticated', true),
       set_config('role', 'authenticated', true);

     select public.club_cancel_membership_request(
       '${idempotencyKey}'::uuid,
       '${reqRowId}'::uuid,
       1
     ) as result;`,
    "cancel"
  );

  // Re-read row + audit count
  const verifyBody = await q(
    token,
    `select json_build_object(
      'request', (
        select jsonb_build_object('id', id, 'status', status, 'version', version, 'user_id', user_id, 'club_id', club_id, 'tenant_id', tenant_id)
        from public.club_membership_requests_v42 where id = '${reqRowId}'::uuid
      ),
      'audits', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'action', action, 'actor_id', actor_id, 'club_id', club_id, 'venue_id', venue_id,
          'resource_id', resource_id, 'metadata', metadata, 'created_at', created_at
        ) order by created_at), '[]'::jsonb)
        from public.audit_logs
        where action = 'club.membership_request.cancel'
          and resource_id = '${reqRowId}'
      ),
      'audit_count', (
        select count(*)::int from public.audit_logs
        where action = 'club.membership_request.cancel'
          and resource_id = '${reqRowId}'
      )
    ) as v;`,
    "verify-rows"
  );

  // Idempotent replay
  const replayBody = await q(
    token,
    `select
       set_config('request.jwt.claim.sub', '${userId}', true),
       set_config('request.jwt.claim.role', 'authenticated', true),
       set_config('role', 'authenticated', true);
     select public.club_cancel_membership_request(
       '${idempotencyKey}'::uuid,
       '${reqRowId}'::uuid,
       1
     ) as result;
     select count(*)::int as audit_count_after_replay
     from public.audit_logs
     where action = 'club.membership_request.cancel'
       and resource_id = '${reqRowId}';`,
    "replay"
  );

  // Negative: other user
  const otherUserBody = await q(
    token,
    `select id::text as id from auth.users where id <> '${userId}'::uuid limit 1;`,
    "other-user"
  );
  const otherUser = first(otherUserBody, "id") || (Array.isArray(otherUserBody) ? otherUserBody[0]?.id : null);

  let forbiddenResult = null;
  if (otherUser) {
    // Insert another pending for negative unauthorized (different owner)
    const otherReq = randomUUID();
    await q(
      token,
      `insert into public.club_membership_requests_v42
        (id, tenant_id, club_id, user_id, message, status, version)
       values
        ('${otherReq}'::uuid, '${tenantId}', '${clubId}', '${userId}'::uuid,
         '${marker}-other', 'pending', 1);`,
      "insert-other"
    );
    const forb = await q(
      token,
      `select
         set_config('request.jwt.claim.sub', '${otherUser}', true),
         set_config('request.jwt.claim.role', 'authenticated', true),
         set_config('role', 'authenticated', true);
       select public.club_cancel_membership_request(
         '${randomUUID()}'::uuid,
         '${otherReq}'::uuid,
         1
       ) as result;`,
      "forbidden-cancel"
    );
    forbiddenResult = first(forb, "result") ?? forb;
    await q(
      token,
      `delete from public.club_membership_requests_v42 where id = '${otherReq}'::uuid;`,
      "cleanup-other"
    );
  }

  // Stale version on a fresh pending
  const staleReq = randomUUID();
  await q(
    token,
    `insert into public.club_membership_requests_v42
      (id, tenant_id, club_id, user_id, message, status, version)
     values
      ('${staleReq}'::uuid, '${tenantId}', '${clubId}', '${userId}'::uuid,
       '${marker}-stale', 'pending', 1);`,
    "insert-stale"
  );
  const staleBody = await q(
    token,
    `select
       set_config('request.jwt.claim.sub', '${userId}', true),
       set_config('request.jwt.claim.role', 'authenticated', true),
       set_config('role', 'authenticated', true);
     select public.club_cancel_membership_request(
       '${randomUUID()}'::uuid,
       '${staleReq}'::uuid,
       99
     ) as result;`,
    "stale-version"
  );
  await q(
    token,
    `delete from public.club_membership_requests_v42 where id = '${staleReq}'::uuid;`,
    "cleanup-stale"
  );

  const v = first(verifyBody, "v");
  const cancelResult = first(cancelBody, "result") ?? cancelBody;
  const auditCountAfterReplay =
    first(replayBody, "audit_count_after_replay") ??
    (Array.isArray(replayBody)
      ? replayBody.find((r) => r.audit_count_after_replay != null)?.audit_count_after_replay
      : null);

  report.fixture = {
    clubId,
    tenantId,
    userId,
    requestId: reqRowId,
    idempotencyKey,
    cancelResult,
    requestAfter: v?.request,
    auditCount: v?.audit_count,
    audits: v?.audits,
    auditCountAfterReplay,
    forbiddenResult,
    staleResult: first(staleBody, "result") ?? staleBody,
  };

  const okCancel =
    v?.request?.status === "cancelled" &&
    Number(v?.request?.version) === 2 &&
    Number(v?.audit_count) === 1 &&
    Number(auditCountAfterReplay) === 1;

  const audit = Array.isArray(v?.audits) ? v.audits[0] : null;
  const okAuditMeta =
    audit?.action === "club.membership_request.cancel" &&
    String(audit?.actor_id) === String(userId) &&
    String(audit?.club_id) === String(clubId) &&
    String(audit?.venue_id) === String(tenantId) &&
    String(audit?.resource_id) === String(reqRowId);

  const forbOk =
    !forbiddenResult ||
    forbiddenResult?.ok === false ||
    String(forbiddenResult?.code || forbiddenResult?.error || "").includes("FORBIDDEN") ||
    JSON.stringify(forbiddenResult).includes("FORBIDDEN");

  const staleOk =
    String(JSON.stringify(report.fixture.staleResult)).includes("VERSION_CONFLICT") ||
    report.fixture.staleResult?.ok === false;

  report.checks = { okCancel, okAuditMeta, forbOk, staleOk, replayNoDupAudit: Number(auditCountAfterReplay) === 1 };
  report.status = Object.values(report.checks).every(Boolean) ? "PASS" : "FAILED";
  report.finishedAt = new Date().toISOString();

  fs.writeFileSync(path.join(outDir, "FIXTURE_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
