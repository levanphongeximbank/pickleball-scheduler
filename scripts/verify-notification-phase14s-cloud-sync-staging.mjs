/**
 * Phase 1.4S — Staging multi-session cloud inbox smoke.
 *
 * Staging only (qyewbxjsiiyufanzcjcq). Never Production.
 * Never prints secrets (passwords, JWTs, keys, emails, DB URLs).
 * Never uses service_role for RLS verdicts.
 *
 * Env (gitignored .env.staging-qa.local):
 *   STAGING_SUPABASE_URL
 *   STAGING_SUPABASE_ANON_KEY
 *   STAGING_OWNER_A_EMAIL / STAGING_OWNER_B_EMAIL
 *   STAGING_OWNER_A_PASSWORD / STAGING_OWNER_B_PASSWORD
 *
 * Usage:
 *   npm run notification:verify:phase14s
 *   node scripts/verify-notification-phase14s-cloud-sync-staging.mjs
 */
import { randomUUID } from "node:crypto";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { getStagingOwnerEmails, signInStagingUser } from "./staging-auth-resolve.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const QA_NAMESPACE = "phase14s";
const EXPECTED_TENANT_A = "venue-staging-a";
const EXPECTED_TENANT_B = "venue-staging-b";

const results = [];
let blockers = 0;
let failures = 0;

/** Rows created by this run — cleanup is limited to these ids + namespace keys. */
const createdInboxIds = [];
const createdIdempotencyKeys = [];

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

function shortId(id) {
  const value = String(id || "");
  if (!value) return "(none)";
  return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
}

function assertStagingOnly(url) {
  const value = String(url || "");
  if (!value) failHard("Missing Staging Supabase URL.");
  if (value.includes(PRODUCTION_REF)) {
    failHard("Abort: Production project ref detected in Supabase URL.");
  }
  if (/expuvcohlcjzvrrauvud|production\.supabase/i.test(value)) {
    failHard("Abort: Production-shaped Supabase URL detected.");
  }
  if (!value.includes(STAGING_REF)) {
    failHard(`Abort: Supabase URL must include Staging ref ${STAGING_REF}.`);
  }
}

function assertNoServiceRoleInPath(env) {
  // Presence of service role in env is allowed for other scripts, but this smoke must not use it.
  if (env.serviceKey) {
    console.log(
      "ℹ️  STAGING_SUPABASE_SERVICE_ROLE_KEY is set but intentionally unused (anon + user JWT only)."
    );
  }
}

function makeRunIds(runId) {
  return {
    runId,
    selfEventId: `${QA_NAMESPACE}:${runId}:evt:self`,
    selfIdempotencyKey: `${QA_NAMESPACE}:${runId}:idem:self`,
    matchEventId: `${QA_NAMESPACE}:${runId}:evt:match`,
    matchIdempotencyKey: `${QA_NAMESPACE}:${runId}:idem:match`,
    skipEventId: `${QA_NAMESPACE}:${runId}:evt:skip`,
    skipIdempotencyKey: `${QA_NAMESPACE}:${runId}:idem:skip`,
    matchEntityId: `${QA_NAMESPACE}:${runId}:match`,
  };
}

function trackCreated(row) {
  const id = row?.id || row?.notificationId;
  const key = row?.idempotency_key || row?.idempotencyKey;
  if (id) createdInboxIds.push(String(id));
  if (key) createdIdempotencyKeys.push(String(key));
}

async function countUnread(client, tenantId, userId) {
  const { count, error } = await client
    .from("notification_inbox")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("recipient_user_id", userId)
    .neq("status", "READ");
  return { count: count ?? 0, error };
}

async function listOwn(client, tenantId, userId, limit = 50) {
  return client
    .from("notification_inbox")
    .select(
      "id, status, title, message, event_id, idempotency_key, created_at, recipient_user_id, tenant_id"
    )
    .eq("tenant_id", tenantId)
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

async function createSelf(client, { tenantId, userId, ids }) {
  const result = await client.rpc("notification_inbox_create", {
    p_event_id: ids.selfEventId,
    p_event_type: "BOOKING_CREATED",
    p_category: "BOOKING",
    p_priority: "NORMAL",
    p_tenant_id: tenantId,
    p_recipient_user_id: userId,
    p_title: "Phase 1.4S cloud sync",
    p_message: "Staging multi-session smoke",
    p_idempotency_key: ids.selfIdempotencyKey,
  });
  if (result.data) {
    trackCreated({
      id: result.data.id,
      idempotency_key: ids.selfIdempotencyKey,
    });
  }
  return result;
}

async function markRead(client, { tenantId, userId, notificationId }) {
  const now = new Date().toISOString();
  return client
    .from("notification_inbox")
    .update({ status: "READ", read_at: now, updated_at: now })
    .eq("id", notificationId)
    .eq("tenant_id", tenantId)
    .eq("recipient_user_id", userId)
    .select("id, status, read_at")
    .maybeSingle();
}

async function signOut(client) {
  try {
    await client.auth.signOut();
  } catch {
    /* ignore */
  }
}

/**
 * Delete only rows created by this run for the authenticated recipient+tenant.
 * Uses staging-only SECURITY DEFINER RPC (Phase 1.5) — never broad DELETE policy.
 * Never uses service_role in browser/smoke path.
 */
async function cleanupRunRows(client, { tenantId, userId, runId }) {
  if (!client || !tenantId || !userId) {
    return { ok: false, deleted: 0, reason: "missing_scope" };
  }
  const uniqueIds = [...new Set(createdInboxIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: true, deleted: 0, reason: "nothing_tracked" };
  }

  const prefix = `${QA_NAMESPACE}:${runId}:`;

  // Prove unrelated rows are never deleted: insert a sentinel outside tracked set,
  // attempt cleanup, then assert sentinel remains.
  const sentinelKey = `${prefix}sentinel-unrelated-${Date.now()}`;
  const { data: sentinelRow, error: sentinelErr } = await client.rpc(
    "notification_inbox_create",
    {
      p_event_id: `evt-sentinel-${runId}`,
      p_event_type: "SYSTEM_TEST",
      p_category: "SYSTEM",
      p_priority: "LOW",
      p_tenant_id: tenantId,
      p_recipient_user_id: userId,
      p_title: "phase14s cleanup sentinel (must remain if not tracked)",
      p_message: "unrelated to tracked cleanup ids",
      p_idempotency_key: sentinelKey,
    }
  );
  if (sentinelErr) {
    return {
      ok: false,
      deleted: 0,
      reason: `sentinel_create_failed:${sentinelErr.message}`,
      attempted: uniqueIds.length,
    };
  }
  const sentinelId = sentinelRow?.id;
  // Intentionally do NOT add sentinelId to uniqueIds / createdInboxIds.

  const { data, error } = await client.rpc("notification_qa_cleanup_namespaced_inbox", {
    p_tenant_id: tenantId,
    p_namespace_prefix: prefix,
    p_ids: uniqueIds,
    p_expected_project_ref: STAGING_REF,
  });

  if (error) {
    // Fallback: legacy direct DELETE may still be RLS-blocked.
    const legacy = await client
      .from("notification_inbox")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("recipient_user_id", userId)
      .in("id", uniqueIds)
      .like("idempotency_key", `${prefix}%`)
      .select("id");

    if (legacy.error) {
      return {
        ok: false,
        deleted: 0,
        reason: error.message || String(error),
        attempted: uniqueIds.length,
        sentinelId,
      };
    }
    const deleted = Array.isArray(legacy.data) ? legacy.data.length : 0;
    return {
      ok: deleted > 0,
      deleted,
      attempted: uniqueIds.length,
      reason: deleted === 0 ? "rls_or_no_matching_rows" : "legacy_delete",
      sentinelId,
    };
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const deleted = rows.length;

  // Assert sentinel was not deleted
  const { data: sentinelCheck } = await client
    .from("notification_inbox")
    .select("id")
    .eq("id", sentinelId)
    .maybeSingle();

  if (!sentinelCheck?.id) {
    return {
      ok: false,
      deleted,
      attempted: uniqueIds.length,
      reason: "sentinel_incorrectly_deleted",
      sentinelId,
    };
  }

  // Clean sentinel itself via RPC (now tracked)
  await client.rpc("notification_qa_cleanup_namespaced_inbox", {
    p_tenant_id: tenantId,
    p_namespace_prefix: prefix,
    p_ids: [sentinelId],
    p_expected_project_ref: STAGING_REF,
  });

  if (deleted === 0 && uniqueIds.length > 0) {
    return {
      ok: false,
      deleted: 0,
      reason: "rpc_no_matching_rows",
      attempted: uniqueIds.length,
      sentinelPreserved: true,
    };
  }
  return {
    ok: true,
    deleted,
    attempted: uniqueIds.length,
    sentinelPreserved: true,
  };
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  assertStagingOnly(env.url);
  assertNoServiceRoleInPath(env);
  if (!env.anonKey) failHard("Missing Staging anon key.");
  if (String(env.stagingRef || STAGING_REF) !== STAGING_REF) {
    failHard(`Abort: resolved stagingRef must be ${STAGING_REF}.`);
  }

  const runId = randomUUID();
  const ids = makeRunIds(runId);

  console.log("=== Phase 1.4S — Staging multi-session cloud inbox smoke ===");
  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Run namespace: ${QA_NAMESPACE}:${runId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("Auth: anon key + user JWT only (service_role never used)\n");

  const { ownerA, ownerB } = getStagingOwnerEmails();
  if (!ownerA || !ownerB) {
    failHard("Missing STAGING_OWNER_A_EMAIL / STAGING_OWNER_B_EMAIL.");
  }
  if (ownerA.toLowerCase() === ownerB.toLowerCase()) {
    failHard("Owner A and Owner B emails must differ.");
  }

  // ─── A. User A session 1 ─────────────────────────────────────────
  const session1 = await signInStagingUser(ownerA);
  if (session1.error || !session1.client || !session1.userId) {
    failHard(`Session1 sign-in failed: ${session1.error || "unauthenticated"}`);
  }

  const tenantA = session1.profile?.venue_id;
  const userAId = session1.userId;
  if (!tenantA || tenantA !== EXPECTED_TENANT_A) {
    failHard(`Owner A venue_id expected ${EXPECTED_TENANT_A}.`);
  }

  const before = await countUnread(session1.client, tenantA, userAId);
  record(
    "A_session1",
    "initial_unread_count",
    "countUnread succeeds",
    before.error ? before.error.message : `count=${before.count}`,
    !before.error
  );

  const created = await createSelf(session1.client, {
    tenantId: tenantA,
    userId: userAId,
    ids,
  });
  const notifId = created.data?.id;
  record(
    "A_session1",
    "create_canonical_notification",
    "RPC create for self succeeds",
    created.error ? created.error.message : `id=${shortId(notifId)}`,
    !created.error && Boolean(notifId),
    true
  );
  if (!notifId) failHard("Cannot continue without created notification id.");

  const afterCreate = await countUnread(session1.client, tenantA, userAId);
  record(
    "A_session1",
    "header_badge_unread_increases",
    `unread >= ${before.count + 1}`,
    `before=${before.count} after=${afterCreate.count}`,
    !afterCreate.error && afterCreate.count >= before.count + 1,
    true
  );

  const list1 = await listOwn(session1.client, tenantA, userAId);
  const found1 = (list1.data || []).some((r) => r.id === notifId);
  record(
    "A_session1",
    "appears_in_notification_center_list",
    "Notification Center list includes new row",
    found1 ? `found id=${shortId(notifId)}` : `missing; err=${list1.error?.message || "none"}`,
    found1,
    true
  );

  // ─── B. User A session 2 ─────────────────────────────────────────
  const session2 = await signInStagingUser(ownerA);
  if (session2.error || !session2.client || !session2.userId) {
    failHard(`Session2 sign-in failed: ${session2.error || "unauthenticated"}`);
  }
  record(
    "B_session2",
    "independent_session_same_user",
    "Second JWT session for Owner A",
    session2.userId === userAId ? "same userId" : "userId mismatch",
    session2.userId === userAId,
    true
  );

  const list2 = await listOwn(session2.client, tenantA, userAId);
  const found2 = (list2.data || []).some((r) => r.id === notifId);
  record(
    "B_session2",
    "same_notification_visible",
    "Session 2 sees same cloud row",
    found2 ? "visible" : `missing; err=${list2.error?.message || "none"}`,
    found2,
    true
  );

  const mark = await markRead(session2.client, {
    tenantId: tenantA,
    userId: userAId,
    notificationId: notifId,
  });
  record(
    "B_session2",
    "mark_read",
    "status=READ",
    mark.error ? mark.error.message : `status=${mark.data?.status}`,
    !mark.error && mark.data?.status === "READ",
    true
  );

  const unread2 = await countUnread(session2.client, tenantA, userAId);
  record(
    "B_session2",
    "unread_decreases_after_mark",
    `unread <= ${afterCreate.count - 1}`,
    `afterCreate=${afterCreate.count} now=${unread2.count}`,
    !unread2.error && unread2.count <= Math.max(0, afterCreate.count - 1),
    true
  );

  // ─── C. Cross-session + logout/login ─────────────────────────────
  const list1After = await listOwn(session1.client, tenantA, userAId);
  const row1 = (list1After.data || []).find((r) => r.id === notifId);
  const unread1After = await countUnread(session1.client, tenantA, userAId);
  record(
    "C_cross_session",
    "session1_sees_read_state",
    "Session 1 refresh shows READ",
    row1 ? `status=${row1.status}` : "row missing",
    row1?.status === "READ",
    true
  );
  record(
    "C_cross_session",
    "unread_counts_match",
    "Session1 unread == Session2 unread",
    `s1=${unread1After.count} s2=${unread2.count}`,
    !unread1After.error && unread1After.count === unread2.count,
    true
  );

  await signOut(session1.client);
  const session1b = await signInStagingUser(ownerA);
  if (session1b.error || !session1b.client || !session1b.userId) {
    failHard(`Re-login failed: ${session1b.error || "unauthenticated"}`);
  }
  const listRelogin = await listOwn(session1b.client, tenantA, userAId);
  const rowRelogin = (listRelogin.data || []).find((r) => r.id === notifId);
  record(
    "C_cross_session",
    "logout_login_persistence",
    "READ state survives logout/login",
    rowRelogin ? `status=${rowRelogin.status}` : "row missing",
    rowRelogin?.status === "READ",
    true
  );

  // ─── D. User B isolation ─────────────────────────────────────────
  const sessionB = await signInStagingUser(ownerB);
  if (sessionB.error || !sessionB.client || !sessionB.userId) {
    failHard(`Owner B sign-in failed: ${sessionB.error || "unauthenticated"}`);
  }
  const tenantB = sessionB.profile?.venue_id;
  record(
    "D_isolation",
    "owner_b_tenant",
    EXPECTED_TENANT_B,
    tenantB || "null",
    tenantB === EXPECTED_TENANT_B,
    true
  );

  const { data: bSeesA, error: bSeesErr } = await sessionB.client
    .from("notification_inbox")
    .select("id")
    .eq("id", notifId)
    .maybeSingle();
  record(
    "D_isolation",
    "b_cannot_read_a_row",
    "empty / blocked",
    bSeesErr ? `err=${bSeesErr.message}` : bSeesA ? "LEAK" : "blocked (empty)",
    !bSeesA,
    true
  );

  const bMark = await sessionB.client
    .from("notification_inbox")
    .update({ status: "READ", read_at: new Date().toISOString() })
    .eq("id", notifId)
    .select("id");
  const bUpdated = Array.isArray(bMark.data) ? bMark.data.length : bMark.data ? 1 : 0;
  record(
    "D_isolation",
    "b_cannot_mark_a_row",
    "updated=0",
    `updated=${bUpdated} err=${bMark.error?.message || "none"}`,
    bUpdated === 0,
    true
  );

  // ─── E. Mobile compatibility dedupe (API-level) ──────────────────
  const canonicalList = await listOwn(session1b.client, tenantA, userAId, 100);
  const canonicalItems = (canonicalList.data || []).map((r) => ({
    id: r.id,
    eventId: r.event_id,
  }));
  const legacyFake = [
    { id: `${QA_NAMESPACE}:${runId}:legacy-dup`, payload_json: { eventId: ids.selfEventId } },
    {
      id: `${QA_NAMESPACE}:${runId}:legacy-unique`,
      payload_json: { eventId: `${QA_NAMESPACE}:${runId}:legacy-only` },
    },
  ];
  const seen = new Set(canonicalItems.map((c) => c.eventId).filter(Boolean));
  let skippedDuplicates = 0;
  const mergedLegacy = [];
  for (const row of legacyFake) {
    const key = row.payload_json?.eventId;
    if (key && seen.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    if (key) seen.add(key);
    mergedLegacy.push(row);
  }
  const hasCanonical = canonicalItems.some((c) => c.id === notifId);
  record(
    "E_mobile",
    "dedupe_same_eventId",
    "skip 1 duplicate legacy with same eventId",
    `skippedDuplicates=${skippedDuplicates} mergedLegacy=${mergedLegacy.length} hasCanonical=${hasCanonical}`,
    skippedDuplicates === 1 && mergedLegacy.length === 1 && hasCanonical,
    true
  );

  const confirmRead = await listOwn(session1b.client, tenantA, userAId);
  const stillRead = (confirmRead.data || []).find((r) => r.id === notifId);
  record(
    "E_mobile",
    "canonical_mark_read_cloud_state",
    "canonical row remains READ in cloud",
    stillRead ? `status=${stillRead.status}` : "missing",
    stillRead?.status === "READ"
  );

  // ─── F. MATCH_SCHEDULED idempotency ──────────────────────────────
  // Per-recipient key includes userId so retries stay deterministic for this run.
  const recipientKey = `${ids.matchIdempotencyKey}:recipient:${userAId}`;
  createdIdempotencyKeys.push(recipientKey);

  async function emitMatchOnce() {
    const result = await session1b.client.rpc("notification_inbox_create", {
      p_event_id: ids.matchEventId,
      p_event_type: "MATCH_SCHEDULED",
      p_category: "COMPETITION",
      p_priority: "NORMAL",
      p_tenant_id: tenantA,
      p_recipient_user_id: userAId,
      p_title: "Lịch trận đã xếp",
      p_message: "Phase 1.4S MATCH_SCHEDULED",
      p_idempotency_key: recipientKey,
      p_source_entity_type: "match",
      p_source_entity_id: ids.matchEntityId,
    });
    if (result.data?.id) {
      trackCreated({ id: result.data.id, idempotency_key: recipientKey });
    }
    return result;
  }

  const m1 = await emitMatchOnce();
  const m2 = await emitMatchOnce();
  const m1Id = m1.data?.id;
  const m2Id = m2.data?.id;
  record(
    "F_match_scheduled",
    "idempotent_retry_same_id",
    "first create + second returns same id",
    `m1=${shortId(m1Id || m1.error?.message)} m2=${shortId(m2Id || m2.error?.message)}`,
    !m1.error && !m2.error && m1Id && m1Id === m2Id,
    true
  );

  const cross = await session1b.client.rpc("notification_inbox_create", {
    p_event_id: ids.skipEventId,
    p_event_type: "MATCH_SCHEDULED",
    p_category: "COMPETITION",
    p_priority: "NORMAL",
    p_tenant_id: tenantA,
    p_recipient_user_id: sessionB.userId,
    p_title: "should fail",
    p_message: "cross recipient",
    p_idempotency_key: ids.skipIdempotencyKey,
  });
  record(
    "F_match_scheduled",
    "unresolved_or_cross_tenant_skipped",
    "recipient_tenant_mismatch or tenant_scope_denied",
    cross.error?.message || "unexpected success",
    Boolean(cross.error),
    true
  );

  record(
    "F_match_scheduled",
    "competition_engine_untouched",
    "smoke uses boundary RPC only",
    "no Competition Engine imports in this script",
    true
  );

  // ─── Cleanup (scoped to this run only) ───────────────────────────
  const cleanup = await cleanupRunRows(session1b.client, {
    tenantId: tenantA,
    userId: userAId,
    runId,
  });
  record(
    "cleanup",
    "delete_only_this_run_rows",
    "tenant+recipient+tracked ids + namespace prefix via QA RPC",
    cleanup.ok
      ? `deleted=${cleanup.deleted}/${cleanup.attempted || cleanup.deleted} sentinelPreserved=${cleanup.sentinelPreserved === true}`
      : `SKIP/FAIL: ${cleanup.reason} (attempted=${cleanup.attempted || 0})`,
    cleanup.ok === true
  );
  if (cleanup.sentinelPreserved) {
    record(
      "cleanup",
      "unrelated_sentinel_preserved",
      "untracked namespaced row not deleted",
      "sentinel preserved then cleaned separately",
      true
    );
  }

  await signOut(session1b.client);
  await signOut(session2.client);
  await signOut(sessionB.client);

  console.log("\n=== Summary ===");
  console.log(`Passed: ${results.filter((r) => r.pass).length}/${results.length}`);
  console.log(`Failures: ${failures}`);
  console.log(`Blockers: ${blockers}`);
  console.log(`Evidence self row: ${shortId(notifId)}`);
  console.log(`Evidence MATCH_SCHEDULED row: ${shortId(m1Id)}`);
  console.log(`Tracked created ids: ${createdInboxIds.length}`);

  if (blockers > 0) {
    console.log("\n🛑 NO-GO — blockers present.");
    process.exit(2);
  }
  if (failures > 0) {
    console.log("\n❌ FAIL — fix defects.");
    process.exit(1);
  }
  console.log("\n✅ Phase 1.4S Staging cloud sync smoke PASS (cleanup via Phase 1.5 QA RPC).");
}

main().catch((error) => {
  console.error(`\n❌ ${error?.message || error}`);
  process.exit(1);
});
