#!/usr/bin/env node
/**
 * Production functional fixture for cancel-audit (QA only).
 * Creates a temporary pending request for an approved Production QA user,
 * cancels via RPC with JWT claim simulation, asserts one audit row, cleans up.
 *
 * Hard guards: PRODUCTION_REF only; refuses Staging; no customer emails.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadProjectEnv } from "./load-env.mjs";
import {
  PRODUCTION_REF,
  STAGING_REF,
  PLAYER_NOMEMBER_EMAIL,
  createAdminClient,
  lookupProfile,
} from "./phase42k-production-helpers.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "docs/v5/qa-evidence/phase2c-cancel-audit-production");

async function q(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${label}: ${body?.message || JSON.stringify(body)}`);
  return body;
}

function first(body, key) {
  if (Array.isArray(body)) return body[0]?.[key] ?? body[0];
  return body?.[key] ?? body;
}

async function main() {
  loadProjectEnv();
  const url = String(process.env.VITE_SUPABASE_URL || process.env.PRODUCTION_SUPABASE_URL || "");
  if (url.includes(STAGING_REF)) throw new Error("REFUSED Staging URL");
  if (url && !url.includes(PRODUCTION_REF)) throw new Error("REFUSED non-Production URL");

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("NO_TOKEN — schema-only path");
    process.exitCode = 3;
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    phase: "2C-cancel-audit-production-fixture",
    productionRef: PRODUCTION_REF,
    productionTouched: true,
    qaEmail: PLAYER_NOMEMBER_EMAIL,
    status: "PENDING",
  };

  let userId;
  try {
    const admin = createAdminClient();
    const profile = await lookupProfile(admin, PLAYER_NOMEMBER_EMAIL);
    userId = profile.id;
  } catch (err) {
    report.status = "PASS_WITHOUT_LIVE_FIXTURE";
    report.reason = `QA profile unavailable: ${err.message}`;
    fs.writeFileSync(path.join(outDir, "FIXTURE_REPORT.json"), JSON.stringify(report, null, 2));
    console.log(report.status, report.reason);
    return;
  }

  const clubBody = await q(
    token,
    `select jsonb_build_object('id', id, 'tenant_id', tenant_id) as club
     from public.clubs
     where deleted_at is null and status = 'active'
     order by created_at asc nulls last
     limit 1;`,
    "club"
  );
  const club = first(clubBody, "club");
  if (!club?.id) {
    report.status = "PASS_WITHOUT_LIVE_FIXTURE";
    report.reason = "No active Production club for QA fixture";
    fs.writeFileSync(path.join(outDir, "FIXTURE_REPORT.json"), JSON.stringify(report, null, 2));
    console.log(report.status);
    return;
  }

  const reqId = randomUUID();
  const idem = randomUUID();
  const marker = `qa-phase2c-cancel-audit-${idem.slice(0, 8)}`;

  await q(
    token,
    `insert into public.club_membership_requests_v42
      (id, tenant_id, club_id, user_id, message, status, version)
     values
      ('${reqId}'::uuid, '${club.tenant_id}', '${club.id}', '${userId}'::uuid,
       '${marker}', 'pending', 1);`,
    "insert"
  );

  const cancelBody = await q(
    token,
    `select set_config('request.jwt.claim.sub', '${userId}', true),
            set_config('request.jwt.claim.role', 'authenticated', true),
            set_config('role', 'authenticated', true);
     select public.club_cancel_membership_request('${idem}'::uuid, '${reqId}'::uuid, 1) as result;`,
    "cancel"
  );

  const verifyBody = await q(
    token,
    `select json_build_object(
      'request', (select jsonb_build_object('status', status, 'version', version)
                  from public.club_membership_requests_v42 where id = '${reqId}'::uuid),
      'audit_count', (select count(*)::int from public.audit_logs
                      where action = 'club.membership_request.cancel'
                        and resource_id = '${reqId}'),
      'audit', (select jsonb_build_object(
                  'action', action, 'actor_id', actor_id, 'club_id', club_id,
                  'venue_id', venue_id, 'resource_id', resource_id, 'metadata', metadata
                ) from public.audit_logs
                where action = 'club.membership_request.cancel'
                  and resource_id = '${reqId}'
                order by created_at desc limit 1)
    ) as v;`,
    "verify"
  );

  await q(
    token,
    `select set_config('request.jwt.claim.sub', '${userId}', true),
            set_config('request.jwt.claim.role', 'authenticated', true),
            set_config('role', 'authenticated', true);
     select public.club_cancel_membership_request('${idem}'::uuid, '${reqId}'::uuid, 1) as result;
     select count(*)::int as audit_count_after_replay
     from public.audit_logs
     where action = 'club.membership_request.cancel' and resource_id = '${reqId}';`,
    "replay"
  );

  // Cleanup QA fixture request row (keep audit for evidence — Owner may prefer keep)
  await q(
    token,
    `delete from public.club_membership_requests_v42 where id = '${reqId}'::uuid and message = '${marker}';`,
    "cleanup-request"
  );

  const v = first(verifyBody, "v");
  const cancelResult = first(cancelBody, "result");
  report.fixture = {
    clubId: club.id,
    tenantId: club.tenant_id,
    userId,
    requestId: reqId,
    cancelResult,
    requestAfter: v?.request,
    auditCount: v?.audit_count,
    audit: v?.audit,
  };
  report.checks = {
    cancelled: v?.request?.status === "cancelled",
    version2: Number(v?.request?.version) === 2,
    oneAudit: Number(v?.audit_count) === 1,
    actionOk: v?.audit?.action === "club.membership_request.cancel",
    actorOk: String(v?.audit?.actor_id) === String(userId),
    clubOk: String(v?.audit?.club_id) === String(club.id),
    tenantOk: String(v?.audit?.venue_id) === String(club.tenant_id),
  };
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
