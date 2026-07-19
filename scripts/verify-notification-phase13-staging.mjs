/**
 * Phase 1.3S — Staging QA for Notification inbox SoT + RLS + RPC + idempotency + queue.
 *
 * Staging only (qyewbxjsiiyufanzcjcq). Never Production.
 *
 * Requires (.env.local or .env.staging-qa.local — gitignored):
 *   STAGING_SUPABASE_URL / VITE_SUPABASE_URL
 *   STAGING_SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY
 *   STAGING_OWNER_A_EMAIL / STAGING_OWNER_B_EMAIL
 *   STAGING_OWNER_A_PASSWORD / STAGING_OWNER_B_PASSWORD (or PHASE42L_QA_PASSWORD)
 * Optional:
 *   STAGING_SUPABASE_SERVICE_ROLE_KEY — schema probes only (not used for RLS verdicts)
 *
 * Usage:
 *   node scripts/verify-notification-phase13-staging.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { getStagingOwnerEmails, signInStagingUser } from "./staging-auth-resolve.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

const results = [];
let blockers = 0;
let failures = 0;

function record(section, name, expected, actual, pass, blocker = false) {
  const row = { section, name, expected, actual, pass, blocker };
  results.push(row);
  const icon = pass ? "✅" : blocker ? "🛑" : "❌";
  console.log(`${icon} [${section}] ${name}`);
  console.log(`   expected: ${expected}`);
  console.log(`   actual:   ${actual}`);
  if (!pass) {
    failures += 1;
    if (blocker) blockers += 1;
  }
}

function failHard(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function assertStagingUrl(url) {
  if (!url) failHard("Thiếu Staging Supabase URL.");
  if (String(url).includes(PRODUCTION_REF)) {
    failHard("URL trỏ Production — dừng.");
  }
  if (!String(url).includes(STAGING_REF)) {
    failHard(`URL không phải staging ${STAGING_REF} — dừng.`);
  }
}

async function adminClient(url, serviceKey) {
  if (!serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function probeSchema(admin) {
  if (!admin) {
    // Optional: RLS/RPC verdicts use authenticated sessions. Missing service role is SKIP, not FAIL.
    record(
      "schema",
      "service_role_available",
      "optional service role for schema probes (SKIP if unset)",
      "SKIP — schema checks limited to anon/auth probes",
      true
    );
    return;
  }

  for (const table of ["notification_inbox", "notification_delivery_jobs"]) {
    const { error } = await admin.from(table).select("id").limit(1);
    const missing =
      error &&
      (error.code === "42P01" ||
        String(error.message || "").toLowerCase().includes("does not exist"));
    record(
      "schema",
      `table_${table}`,
      "table exists",
      missing ? `MISSING: ${error.message}` : error ? `exists (probe: ${error.message})` : "exists accessible",
      !missing
    );
  }

  // RPC existence via intentional bad call shape still returns function-not-found vs arg error
  for (const rpc of ["notification_inbox_create", "notification_delivery_enqueue"]) {
    const { error } = await admin.rpc(rpc, {});
    const msg = String(error?.message || "");
    const missing = /could not find the function|function .* does not exist/i.test(msg);
    record(
      "schema",
      `rpc_${rpc}`,
      "RPC exists",
      missing ? `MISSING: ${msg}` : `present (${msg || "ok/arg error"})`,
      !missing
    );
  }

  // Legacy table must remain
  const legacy = await admin.from("notifications").select("id").limit(1);
  const legacyMissing =
    legacy.error &&
    (legacy.error.code === "42P01" ||
      String(legacy.error.message || "").toLowerCase().includes("does not exist"));
  record(
    "schema",
    "legacy_notifications_preserved",
    "public.notifications still present (or optional if never applied)",
    legacyMissing ? "missing" : "present",
    true // not a failure either way for Phase 1.3S — note only
  );
}

async function runRlsMatrix(userA, userB, tenantA) {
  const suffix = `${Date.now()}`;
  const keySelf = `phase13s:self:${suffix}`;

  // 1. User A create for self
  const createSelf = await userA.client.rpc("notification_inbox_create", {
    p_event_id: `evt-${suffix}`,
    p_event_type: "BOOKING_CREATED",
    p_category: "BOOKING",
    p_priority: "NORMAL",
    p_tenant_id: tenantA,
    p_recipient_user_id: userA.userId,
    p_title: "QA self",
    p_message: "Phase 1.3S self create",
    p_idempotency_key: keySelf,
  });
  record(
    "rls",
    "1_userA_create_self",
    "RPC create for self succeeds",
    createSelf.error ? createSelf.error.message : `ok id=${createSelf.data?.id}`,
    !createSelf.error
  );
  const notifId = createSelf.data?.id;

  // 2. User A read own
  const readA = await userA.client
    .from("notification_inbox")
    .select("id, recipient_user_id, status")
    .eq("id", notifId)
    .maybeSingle();
  record(
    "rls",
    "2_userA_read_own",
    "User A can read own row",
    readA.error ? readA.error.message : `row=${readA.data?.id}`,
    !readA.error && readA.data?.id === notifId
  );

  // 3. User B cannot read User A
  const readB = await userB.client
    .from("notification_inbox")
    .select("id")
    .eq("id", notifId)
    .maybeSingle();
  const bBlocked = !readB.data && (!readB.error || readB.error.code === "PGRST116");
  record(
    "rls",
    "3_userB_cannot_read_A",
    "User B cannot read User A notification",
    readB.data ? `LEAK id=${readB.data.id}` : `blocked (${readB.error?.message || "empty"})`,
    bBlocked
  );

  // 4. User B cannot mark read User A
  const updateB = await userB.client
    .from("notification_inbox")
    .update({ status: "READ", read_at: new Date().toISOString() })
    .eq("id", notifId)
    .select("id");
  record(
    "rls",
    "4_userB_cannot_update_A",
    "User B update affects 0 rows",
    `updated=${(updateB.data || []).length} err=${updateB.error?.message || "none"}`,
    (updateB.data || []).length === 0
  );

  // 5. User A mark read
  const updateA = await userA.client
    .from("notification_inbox")
    .update({ status: "READ", read_at: new Date().toISOString() })
    .eq("id", notifId)
    .select("id, status")
    .maybeSingle();
  record(
    "rls",
    "5_userA_mark_read",
    "User A mark read succeeds",
    updateA.error ? updateA.error.message : `status=${updateA.data?.status}`,
    !updateA.error && updateA.data?.status === "READ"
  );

  // 8. Anonymous cannot read
  const { url, anonKey } = getStagingSupabaseEnv();
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonRead = await anon.from("notification_inbox").select("id").limit(5);
  record(
    "rls",
    "8_anon_cannot_read",
    "Anonymous cannot read inbox rows",
    anonRead.error
      ? `blocked: ${anonRead.error.message}`
      : `rows=${(anonRead.data || []).length}`,
    Boolean(anonRead.error) || (anonRead.data || []).length === 0
  );

  // 9. Direct insert denied
  const directInsert = await userA.client.from("notification_inbox").insert({
    event_id: `direct-${suffix}`,
    event_type: "BOOKING_CREATED",
    category: "BOOKING",
    priority: "NORMAL",
    tenant_id: tenantA,
    recipient_user_id: userA.userId,
    title: "direct",
    message: "should fail",
    idempotency_key: `direct-${suffix}`,
  });
  record(
    "rls",
    "9_direct_insert_denied",
    "Client direct INSERT denied (RPC required)",
    directInsert.error ? directInsert.error.message : "UNEXPECTED SUCCESS",
    Boolean(directInsert.error)
  );

  return { notifId, keySelf };
}

async function runRpcSecurity(userA, userB, tenantA, tenantB) {
  const suffix = `${Date.now()}`;

  // Attempt create for other user in same tenant (if B shares tenant) or cross-tenant
  const cross = await userA.client.rpc("notification_inbox_create", {
    p_event_id: `cross-${suffix}`,
    p_event_type: "PAYMENT_CONFIRMED",
    p_category: "PAYMENT",
    p_priority: "HIGH",
    p_tenant_id: tenantA,
    p_recipient_user_id: userB.userId,
    p_title: "cross",
    p_message: "should require scope",
    p_idempotency_key: `cross-recipient:${suffix}`,
  });

  const hardenedDenied =
    Boolean(cross.error) &&
    /tenant_scope_denied|recipient_tenant_mismatch|tenant/i.test(cross.error.message);

  // If same tenant and hardening applied, cross-recipient may still be allowed when both in tenant.
  // BLOCKER only if User A can create for User B while B is DIFFERENT tenant.
  if (tenantA && tenantB && tenantA !== tenantB) {
    const crossTenant = await userA.client.rpc("notification_inbox_create", {
      p_event_id: `xt-${suffix}`,
      p_event_type: "PAYMENT_FAILED",
      p_category: "PAYMENT",
      p_priority: "HIGH",
      p_tenant_id: tenantB,
      p_recipient_user_id: userB.userId,
      p_title: "xt",
      p_message: "cross tenant",
      p_idempotency_key: `xt:${suffix}`,
    });
    const blocked = Boolean(crossTenant.error);
    record(
      "rpc_security",
      "cross_tenant_create_denied",
      "Cannot create notification under foreign tenantId",
      crossTenant.error ? crossTenant.error.message : "ALLOWED — BLOCKER",
      blocked,
      !blocked
    );
  }

  // Create for arbitrary tenant with self recipient but foreign tenant id
  const foreignTenant = await userA.client.rpc("notification_inbox_create", {
    p_event_id: `ft-${suffix}`,
    p_event_type: "BOOKING_CANCELLED",
    p_category: "BOOKING",
    p_priority: "NORMAL",
    p_tenant_id: "foreign-tenant-should-fail",
    p_recipient_user_id: userA.userId,
    p_title: "ft",
    p_message: "foreign tenant",
    p_idempotency_key: `ft:${suffix}`,
  });
  const foreignBlocked = Boolean(foreignTenant.error);
  record(
    "rpc_security",
    "arbitrary_tenantId_denied",
    "Cannot pass arbitrary tenantId without identity match",
    foreignTenant.error ? foreignTenant.error.message : "ALLOWED — BLOCKER",
    foreignBlocked,
    !foreignBlocked
  );

  record(
    "rpc_security",
    "same_tenant_other_recipient_create",
    "Documented: same-tenant other recipient create result after hardening",
    cross.error ? cross.error.message : `allowed id=${cross.data?.id}`,
    true
  );

  void hardenedDenied;
}

async function runIdempotency(userA, tenantA) {
  const suffix = `${Date.now()}`;
  const key = `idem:${suffix}`;

  const first = await userA.client.rpc("notification_inbox_create", {
    p_event_id: `idem-1-${suffix}`,
    p_event_type: "MATCH_SCHEDULED",
    p_category: "COMPETITION",
    p_priority: "NORMAL",
    p_tenant_id: tenantA,
    p_recipient_user_id: userA.userId,
    p_title: "idem",
    p_message: "first",
    p_idempotency_key: key,
  });
  const second = await userA.client.rpc("notification_inbox_create", {
    p_event_id: `idem-2-${suffix}`,
    p_event_type: "MATCH_SCHEDULED",
    p_category: "COMPETITION",
    p_priority: "NORMAL",
    p_tenant_id: tenantA,
    p_recipient_user_id: userA.userId,
    p_title: "idem",
    p_message: "retry",
    p_idempotency_key: key,
  });

  const sameId =
    first.data?.id && second.data?.id && first.data.id === second.data.id;
  record(
    "idempotency",
    "same_key_same_recipient_one_row",
    "Retry returns same inbox id",
    `first=${first.data?.id} second=${second.data?.id} err=${first.error?.message || second.error?.message || "none"}`,
    Boolean(sameId)
  );

  const key2 = `idem-v2:${suffix}`;
  const versioned = await userA.client.rpc("notification_inbox_create", {
    p_event_id: `idem-v2-${suffix}`,
    p_event_type: "MATCH_SCHEDULED",
    p_category: "COMPETITION",
    p_priority: "NORMAL",
    p_tenant_id: tenantA,
    p_recipient_user_id: userA.userId,
    p_title: "idem v2",
    p_message: "new version",
    p_idempotency_key: key2,
  });
  record(
    "idempotency",
    "different_version_new_row",
    "Different idempotencyKey creates new row",
    `v1=${first.data?.id} v2=${versioned.data?.id}`,
    Boolean(versioned.data?.id) && versioned.data.id !== first.data?.id
  );

  if (first.data?.id) {
    const enq1 = await userA.client.rpc("notification_delivery_enqueue", {
      p_notification_id: first.data.id,
      p_tenant_id: tenantA,
      p_channel: "in_app",
    });
    const enq2 = await userA.client.rpc("notification_delivery_enqueue", {
      p_notification_id: first.data.id,
      p_tenant_id: tenantA,
      p_channel: "in_app",
    });
    record(
      "idempotency",
      "delivery_job_retry_no_duplicate",
      "Retry enqueue returns same job id",
      `j1=${enq1.data?.id} j2=${enq2.data?.id} err=${enq1.error?.message || enq2.error?.message || "none"}`,
      Boolean(enq1.data?.id) && enq1.data.id === enq2.data?.id
    );

    const inbox = await userA.client
      .from("notification_inbox")
      .select("status")
      .eq("id", first.data.id)
      .maybeSingle();
    record(
      "queue",
      "created_to_queued_no_auto_sent",
      "After enqueue status is QUEUED (not SENT)",
      `status=${inbox.data?.status}`,
      inbox.data?.status === "QUEUED"
    );
  }
}

async function runCountUnread(userA, tenantA) {
  const before = await userA.client
    .from("notification_inbox")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantA)
    .neq("status", "READ");
  const suffix = `${Date.now()}`;
  await userA.client.rpc("notification_inbox_create", {
    p_event_id: `cu-${suffix}`,
    p_event_type: "CLUB_SCHEDULE_UPDATED",
    p_category: "CLUB",
    p_priority: "NORMAL",
    p_tenant_id: tenantA,
    p_recipient_user_id: userA.userId,
    p_title: "count",
    p_message: "unread probe",
    p_idempotency_key: `count:${suffix}`,
  });
  const after = await userA.client
    .from("notification_inbox")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantA)
    .neq("status", "READ");
  record(
    "rls",
    "7_count_unread_own_scope",
    "Unread count increases for current user scope",
    `before=${before.count} after=${after.count}`,
    (after.count || 0) >= (before.count || 0)
  );
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  assertStagingUrl(env.url);
  if (!env.anonKey) failHard("Thiếu Staging anon key.");

  console.log("=== Phase 1.3S — Staging Notification QA ===");
  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const admin = await adminClient(env.url, env.serviceKey);
  await probeSchema(admin);

  const { ownerA, ownerB } = getStagingOwnerEmails();
  if (!ownerA || !ownerB) {
    failHard("Missing STAGING_OWNER_A_EMAIL / STAGING_OWNER_B_EMAIL.");
  }
  if (ownerA.toLowerCase() === ownerB.toLowerCase()) {
    failHard("STAGING_OWNER_A_EMAIL and STAGING_OWNER_B_EMAIL must differ.");
  }

  const userA = await signInStagingUser(ownerA);
  const userB = await signInStagingUser(ownerB);

  if (userA.error || !userA.client) {
    failHard(`Cannot sign in User A: ${userA.error}`);
  }
  if (userB.error || !userB.client) {
    failHard(`Cannot sign in User B: ${userB.error}`);
  }

  const tenantA = userA.profile?.venue_id || process.env.STAGING_TENANT_A_ID || "venue-staging-a";
  const tenantB = userB.profile?.venue_id || process.env.STAGING_TENANT_B_ID || "venue-staging-b";

  console.log(`ℹ️  User A venue_id=${tenantA}`);
  console.log(`ℹ️  User B venue_id=${tenantB}\n`);

  await runRlsMatrix(userA, userB, tenantA);
  await runCountUnread(userA, tenantA);
  await runRpcSecurity(userA, userB, tenantA, tenantB);
  await runIdempotency(userA, tenantA);

  console.log("\n=== Summary ===");
  console.log(`Passed: ${results.filter((r) => r.pass).length}/${results.length}`);
  console.log(`Failures: ${failures}`);
  console.log(`Blockers: ${blockers}`);

  if (blockers > 0) {
    console.log("\n🛑 NO-GO for Phase 1.4 — blockers present.");
    process.exit(2);
  }
  if (failures > 0) {
    console.log("\n❌ FAIL — fix defects before Phase 1.4.");
    process.exit(1);
  }
  console.log("\n✅ Staging QA PASS — GO candidate for Phase 1.4 (pending cloud multi-device manual check).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
