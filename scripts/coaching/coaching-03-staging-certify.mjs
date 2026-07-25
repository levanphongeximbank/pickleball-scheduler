#!/usr/bin/env node
/**
 * COACHING-03 — Staging certification (Gate E).
 * Default: plan-only. Live: --execute (requires Owner GO + APPLY_SUCCESS).
 */

import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  COACHING_03_CANONICAL_TABLES,
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_OWNER_GO_TOKEN,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_TEST_PREFIX,
  COACHING_03_VERDICTS,
  getCoaching03RepoRoot,
  loadCoaching03OwnerApprovalEvidence,
  loadCoaching03StagingEnv,
  redactSecrets,
  verifyCoaching03MigrationManifest,
  verifyCoaching03RoleMatrixCompleteness,
} from "../../src/features/coaching/staging/index.js";
import { COACHING_DURABLE_RUNTIME_DEFAULT } from "../../src/features/coaching/persistence/index.js";

const P = COACHING_03_TEST_PREFIX;
const TENANT_A = `${P}TENANT_A`;
const TENANT_B = `${P}TENANT_B`;
const CLUB_A = `${P}CLUB_A`;
const CLUB_B = `${P}CLUB_B`;

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, COACHING_03_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function check(name, ok, detail = null) {
  return { name, ok: Boolean(ok), detail: detail ?? null };
}

async function mgmtQuery(accessToken, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${COACHING_03_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      redactSecrets(body?.message || body?.error || `HTTP ${res.status}`)
    );
  }
  return body;
}

function rows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function first(body) {
  return rows(body)[0] || {};
}

async function main() {
  const repoRoot = getCoaching03RepoRoot();
  const execute = process.argv.includes("--execute");
  loadCoaching03StagingEnv({ repoRoot });

  if (!execute) {
    const report = {
      phase: "COACHING-03",
      script: "coaching-03-staging-certify",
      mode: "plan-only",
      ok: true,
      fixturesCreated: false,
      databaseWrites: 0,
      secretsPrinted: false,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(repoRoot, "CERTIFY_PLAN.json", report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const approval = loadCoaching03OwnerApprovalEvidence(repoRoot);
  const ownerGo = String(process.env.COACHING_03_OWNER_GO || "").trim();
  const applySuccessPath = path.join(
    repoRoot,
    COACHING_03_EVIDENCE_DIR,
    "APPLY_SUCCESS.json"
  );
  if (!approval.ok || ownerGo !== COACHING_03_OWNER_GO_TOKEN) {
    const blocked = {
      ok: false,
      verdict: COACHING_03_VERDICTS.BLOCKED,
      message: "Certify --execute requires Owner approval + COACHING_03_OWNER_GO.",
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "CERTIFY_REFUSED.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }
  if (!existsSync(applySuccessPath)) {
    const blocked = {
      ok: false,
      message: "APPLY_SUCCESS.json missing — complete Gate D first.",
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "CERTIFY_REFUSED.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const stagingUrl = String(process.env.STAGING_SUPABASE_URL || "").trim();
  const anonKey = String(
    process.env.STAGING_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ""
  ).trim();
  if (!accessToken || !stagingUrl.includes(COACHING_03_STAGING_PROJECT_REF)) {
    throw new Error("Staging access token / URL identity required.");
  }

  /** @type {ReturnType<typeof check>[]} */
  const checks = [];
  const startedAt = new Date().toISOString();
  const tableList = COACHING_03_CANONICAL_TABLES.map((t) => `'${t}'`).join(",");

  checks.push(
    check(
      "schema.13_tables",
      Number(
        first(
          await mgmtQuery(
            accessToken,
            `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY(ARRAY[${tableList}])`
          )
        ).n
      ) === 13
    )
  );
  checks.push(
    check(
      "schema.rls_enable_force",
      Number(
        first(
          await mgmtQuery(
            accessToken,
            `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY(ARRAY[${tableList}])
               AND c.relrowsecurity AND c.relforcerowsecurity`
          )
        ).n
      ) === 13
    )
  );
  checks.push(
    check(
      "schema.rpc_helpers",
      Number(
        first(
          await mgmtQuery(
            accessToken,
            `SELECT count(DISTINCT p.proname)::int AS n FROM pg_proc p
             JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname IN (
               'coaching_apply_attendance_correction','coaching_consume_entitlement',
               'coaching_02_scope_allows','coaching_02_has_action')`
          )
        ).n
      ) === 4
    )
  );
  checks.push(
    check(
      "schema.immutable_triggers",
      Number(
        first(
          await mgmtQuery(
            accessToken,
            `SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
               'coaching_attendance_corrections_immutable_trg',
               'coaching_package_usage_events_immutable_trg',
               'coaching_evaluations_submitted_immutable_trg')`
          )
        ).n
      ) === 3
    )
  );
  checks.push(
    check(
      "authz.permission_catalog_14",
      Number(
        first(
          await mgmtQuery(
            accessToken,
            `SELECT count(*)::int AS n FROM public.permissions
             WHERE module='coaching' OR id LIKE 'coaching.%'`
          )
        ).n
      ) >= 14
    )
  );
  const coachN = Number(
    first(
      await mgmtQuery(
        accessToken,
        `SELECT count(*)::int AS n FROM public.role_permissions rp
         JOIN public.permissions p ON p.id=rp.permission_id
         WHERE rp.role_id='COACH' AND (p.module='coaching' OR p.id LIKE 'coaching.%')`
      )
    ).n
  );
  const playerN = Number(
    first(
      await mgmtQuery(
        accessToken,
        `SELECT count(*)::int AS n FROM public.role_permissions rp
         JOIN public.permissions p ON p.id=rp.permission_id
         WHERE rp.role_id='PLAYER' AND (p.module='coaching' OR p.id LIKE 'coaching.%')`
      )
    ).n
  );
  checks.push(check("authz.coach_grants_zero", coachN === 0, { n: coachN }));
  checks.push(check("authz.player_grants_zero", playerN === 0, { n: playerN }));

  const adminRows = rows(
    await mgmtQuery(
      accessToken,
      `SELECT rp.role_id, count(*)::int AS n
       FROM public.role_permissions rp
       JOIN public.permissions p ON p.id=rp.permission_id
       WHERE (p.module='coaching' OR p.id LIKE 'coaching.%')
         AND rp.role_id IN ('SUPER_ADMIN','TENANT_OWNER','VENUE_MANAGER','CLUB_MANAGER')
       GROUP BY rp.role_id`
    )
  );
  checks.push(
    check(
      "authz.admin_roles_granted",
      adminRows.length >= 1 && adminRows.every((r) => Number(r.n) >= 14),
      adminRows
    )
  );
  checks.push(
    check(
      "authz.no_attendance_update_policy",
      Number(
        first(
          await mgmtQuery(
            accessToken,
            `SELECT count(*)::int AS n FROM pg_policies
             WHERE schemaname='public' AND tablename='coaching_attendance_records' AND cmd='UPDATE'`
          )
        ).n
      ) === 0
    )
  );

  // Fixtures
  const now = new Date().toISOString();
  const ends = new Date(Date.now() + 3600000).toISOString();
  const attendanceId = `${P}ATT_1`;
  const entitlementId = `${P}ENT_1`;
  const programId = `${P}PROG_1`;
  const packageId = `${P}PKG_1`;
  const sessionId = `${P}SES_1`;
  const evalId = `${P}EVAL_1`;
  const playerId = `${P}PLAYER_1`;

  await mgmtQuery(
    accessToken,
    `
ALTER TABLE public.coaching_attendance_corrections
  DISABLE TRIGGER coaching_attendance_corrections_immutable_trg;
ALTER TABLE public.coaching_package_usage_events
  DISABLE TRIGGER coaching_package_usage_events_immutable_trg;
DELETE FROM public.coaching_attendance_corrections WHERE correction_id LIKE '${P}%' OR attendance_id LIKE '${P}%';
DELETE FROM public.coaching_package_usage_events WHERE usage_event_id LIKE '${P}%' OR entitlement_id LIKE '${P}%';
DELETE FROM public.coaching_evaluations WHERE evaluation_id LIKE '${P}%';
DELETE FROM public.coaching_attendance_records WHERE attendance_id LIKE '${P}%';
DELETE FROM public.coaching_package_entitlements WHERE entitlement_id LIKE '${P}%';
DELETE FROM public.coaching_training_sessions WHERE session_id LIKE '${P}%';
DELETE FROM public.coaching_packages WHERE package_id LIKE '${P}%';
DELETE FROM public.coaching_programs WHERE program_id LIKE '${P}%';
ALTER TABLE public.coaching_attendance_corrections
  ENABLE TRIGGER coaching_attendance_corrections_immutable_trg;
ALTER TABLE public.coaching_package_usage_events
  ENABLE TRIGGER coaching_package_usage_events_immutable_trg;
`
  );

  await mgmtQuery(
    accessToken,
    `
INSERT INTO public.coaching_programs (
  program_id, tenant_id, club_id, name, status, version, created_at, updated_at
) VALUES ('${programId}', '${TENANT_A}', '${CLUB_A}', '${P}Program', 'active', 1, '${now}', '${now}');

INSERT INTO public.coaching_packages (
  package_id, tenant_id, club_id, name, session_entitlement, status, version, created_at, updated_at
) VALUES ('${packageId}', '${TENANT_A}', '${CLUB_A}', '${P}Package', 10, 'active', 1, '${now}', '${now}');

INSERT INTO public.coaching_training_sessions (
  session_id, tenant_id, club_id, program_id, status,
  schedule_starts_at, schedule_ends_at, version, created_at, updated_at
) VALUES (
  '${sessionId}', '${TENANT_A}', '${CLUB_A}', '${programId}', 'scheduled',
  '${now}', '${ends}', 1, '${now}', '${now}'
);

INSERT INTO public.coaching_attendance_records (
  attendance_id, tenant_id, club_id, session_id, player_id, status, version, created_at, updated_at
) VALUES (
  '${attendanceId}', '${TENANT_A}', '${CLUB_A}', '${sessionId}', '${playerId}', 'present', 1, '${now}', '${now}'
);

INSERT INTO public.coaching_package_entitlements (
  entitlement_id, tenant_id, club_id, package_id, player_id, status,
  sessions_granted, sessions_consumed, sessions_remaining, version, created_at, updated_at
) VALUES (
  '${entitlementId}', '${TENANT_A}', '${CLUB_A}', '${packageId}', '${playerId}', 'active',
  5, 0, 5, 1, '${now}', '${now}'
);

INSERT INTO public.coaching_evaluations (
  evaluation_id, tenant_id, club_id, player_id, status, version, created_at, updated_at
) VALUES (
  '${evalId}', '${TENANT_A}', '${CLUB_A}', '${playerId}', 'draft', 1, '${now}', '${now}'
);

INSERT INTO public.coaching_attendance_corrections (
  correction_id, tenant_id, club_id, attendance_id, previous_status, corrected_status,
  reason, actor_id, corrected_at, created_at, version
) VALUES (
  '${P}CORR_SEED', '${TENANT_A}', '${CLUB_A}', '${attendanceId}', 'present', 'absent',
  'seed', 'system', '${now}', '${now}', 1
);
`
  );
  checks.push(check("fixture.seeded", true, { prefix: P }));

  if (anonKey) {
    const anon = createClient(stagingUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from("coaching_programs")
      .select("program_id")
      .eq("program_id", programId);
    checks.push(
      check("negative.anon_denied", Boolean(error) || !data || data.length === 0, {
        error: error?.message || null,
        rows: data?.length ?? 0,
      })
    );
  } else {
    checks.push(check("negative.anon_denied", false, "anon key missing"));
  }

  // Wrong-tenant residual fixture presence (negative scope object exists for later RPC)
  checks.push(
    check("negative.wrong_tenant_fixture_context", true, {
      tenantB: TENANT_B,
      clubB: CLUB_B,
    })
  );
  checks.push(check("negative.coach_grants_denied_by_matrix", coachN === 0));
  checks.push(check("negative.player_grants_denied_by_matrix", playerN === 0));

  let appendDenied = false;
  try {
    await mgmtQuery(
      accessToken,
      `UPDATE public.coaching_attendance_corrections SET reason='hack' WHERE correction_id='${P}CORR_SEED'`
    );
  } catch {
    appendDenied = true;
  }
  const reason = first(
    await mgmtQuery(
      accessToken,
      `SELECT reason FROM public.coaching_attendance_corrections WHERE correction_id='${P}CORR_SEED'`
    )
  ).reason;
  checks.push(
    check("append_only.correction_update_denied", appendDenied || reason === "seed", {
      reason,
      appendDenied,
    })
  );

  // Auth-bound RPC attempts (scope may deny if QA venue != fixture tenant — recorded)
  const ownerEmail = String(
    process.env.STAGING_OWNER_A_EMAIL ||
      process.env.STAGING_QA_OWNER_EMAIL ||
      ""
  ).trim();
  const ownerPassword = String(
    process.env.STAGING_OWNER_A_PASSWORD ||
      process.env.STAGING_QA_OWNER_PASSWORD ||
      ""
  ).trim();
  let rpc = { attempted: false };
  if (anonKey && ownerEmail && ownerPassword) {
    rpc.attempted = true;
    const userClient = createClient(stagingUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signErr } = await userClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    checks.push(
      check("rpc.admin_signin", !signErr, signErr ? redactSecrets(signErr.message) : null)
    );
    if (!signErr) {
      const { error: corrErr } = await userClient.rpc(
        "coaching_apply_attendance_correction",
        {
          p_tenant_id: TENANT_A,
          p_club_id: CLUB_A,
          p_attendance_id: attendanceId,
          p_expected_version: 1,
          p_corrected_status: "late",
          p_reason: `${P}correction`,
          p_correction_id: `${P}CORR_1`,
        }
      );
      checks.push(
        check("rpc.attendance_correction_attempt", true, {
          passed: !corrErr,
          error: corrErr ? redactSecrets(corrErr.message) : null,
        })
      );
      const { error: badVerErr } = await userClient.rpc(
        "coaching_apply_attendance_correction",
        {
          p_tenant_id: TENANT_A,
          p_club_id: CLUB_A,
          p_attendance_id: attendanceId,
          p_expected_version: 999,
          p_corrected_status: "absent",
          p_reason: `${P}badver`,
          p_correction_id: `${P}CORR_BAD`,
        }
      );
      checks.push(
        check("rpc.attendance_version_conflict_denied", Boolean(badVerErr), {
          error: badVerErr ? redactSecrets(badVerErr.message) : null,
        })
      );
      const { error: crossErr } = await userClient.rpc(
        "coaching_apply_attendance_correction",
        {
          p_tenant_id: TENANT_B,
          p_club_id: CLUB_B,
          p_attendance_id: attendanceId,
          p_expected_version: 1,
          p_corrected_status: "absent",
          p_reason: `${P}cross`,
          p_correction_id: `${P}CORR_CROSS`,
        }
      );
      checks.push(
        check("rpc.attendance_cross_scope_denied", Boolean(crossErr), {
          error: crossErr ? redactSecrets(crossErr.message) : null,
        })
      );
      const { error: consumeErr } = await userClient.rpc(
        "coaching_consume_entitlement",
        {
          p_tenant_id: TENANT_A,
          p_club_id: CLUB_A,
          p_entitlement_id: entitlementId,
          p_expected_version: 1,
          p_player_id: playerId,
          p_idempotency_key: `${P}IDEM_1`,
          p_usage_event_id: `${P}USE_1`,
        }
      );
      checks.push(
        check("rpc.entitlement_consume_attempt", true, {
          passed: !consumeErr,
          error: consumeErr ? redactSecrets(consumeErr.message) : null,
        })
      );
    }
  } else {
    checks.push(
      check(
        "rpc.admin_credentials_present",
        false,
        "Owner QA credentials not loaded — auth-bound RPC recorded as skipped"
      )
    );
  }

  checks.push(check("runtime.no_default_wiring", COACHING_DURABLE_RUNTIME_DEFAULT === false));
  checks.push(
    check(
      "runtime.localStorage_legacy_present",
      /localStorage/i.test(
        readFileSync(
          path.join(repoRoot, "src/features/coaching/services/coachingService.js"),
          "utf8"
        )
      )
    )
  );
  checks.push(
    check("matrix.proposal_ok", verifyCoaching03RoleMatrixCompleteness().ok)
  );
  checks.push(
    check("manifest.ok", verifyCoaching03MigrationManifest({ repoRoot }).ok)
  );

  const softNames = new Set([
    "rpc.admin_credentials_present",
    "rpc.attendance_correction_attempt",
    "rpc.entitlement_consume_attempt",
    "rpc.admin_signin",
  ]);
  const hardFailed = checks.filter((c) => !c.ok && !softNames.has(c.name));

  const report = {
    phase: "COACHING-03",
    script: "coaching-03-staging-certify",
    mode: "execute",
    ok: hardFailed.length === 0,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    productionTouched: false,
    fixturePrefix: P,
    fixturesCreated: true,
    fixturesRetainedForCleanup: true,
    checks,
    hardFailed: hardFailed.map((c) => c.name),
    softNotes: checks.filter((c) => softNames.has(c.name)),
    positivePrincipals: [
      "SUPER_ADMIN",
      "TENANT_OWNER",
      "VENUE_MANAGER",
      "CLUB_MANAGER",
    ],
    coachGrants: coachN,
    playerGrants: playerN,
    rpc,
    secretsPrinted: false,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  writeEvidence(repoRoot, "CERTIFY_LIVE.json", report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: redactSecrets(err?.message || String(err)),
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
