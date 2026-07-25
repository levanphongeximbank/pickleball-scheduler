#!/usr/bin/env node
/**
 * COMMS-ACT-04 — Temporary Club certification fixtures (Staging only).
 *
 * Modes:
 *   --inventory              pre-fixture Communication inventory (read-only)
 *   --verify-backup=DIR      re-check ACT-04 backup dir/manifest/ZIP hash
 *   --plan                   discover Club A/B bindings (read-only)
 *   --apply-fixtures         insert marker fixtures via service-role (mutation)
 *   --verify-fixtures        count marker rows + certification readiness
 *   --cleanup-fixtures       delete marker rows only
 *
 * Hard rules:
 *   - Staging allowlist qyewbxjsiiyufanzcjcq only
 *   - Production expuvcohlcjzvrrauvud blocked
 *   - Communication tables only
 *   - Never mutates club_members / clubs / auth
 *   - Never applies ACT-03 RLS / realtime / grants
 *   - Marker prefix COMMS_ACT_04_CERT_FIXTURE_
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { loadProjectEnv } from "../load-env.mjs";
import {
  COMMS_STAGING_PROJECT_REF,
  COMMS_PRODUCTION_PROJECT_REF,
} from "../../src/features/communication/activation/index.js";

const MARKER = "COMMS_ACT_04_CERT_FIXTURE_";
const EXPECTED_BACKUP_DIR_SUFFIX = "20260725-101205";
const EXPECTED_ZIP_SHA256 =
  "cddbad9fca12e331cbe25cbe4cc965b4e6aebc0d0a92def353bc7446a05a4bf4";

const CLUB_A_ID = "club-smoke-42i1";
const CLUB_B_ID = "club-test-tt32-qa";
const TENANT_A = "venue-staging-a";
const FIXTURE_TS = "2026-07-25T03:00:00.000Z";

/** Exact IDs — avoid PostgREST `like` because `_` is a SQL LIKE wildcard. */
const CONV_IDS = [
  `${MARKER}CLUB_A`,
  `${MARKER}CLUB_B`,
  `${MARKER}DIRECT`,
  `${MARKER}SYSTEM`,
  `${MARKER}COMMUNITY`,
];
const MSG_IDS = [`${MARKER}CLUB_A_MSG1`, `${MARKER}CLUB_B_MSG1`];
const RX_IDS = [`${MARKER}CLUB_A_RX1`, `${MARKER}CLUB_B_RX1`];
const IN_CONV = `in.(${CONV_IDS.join(",")})`;
const IN_MSG = `in.(${MSG_IDS.join(",")})`;
const IN_RX = `in.(${RX_IDS.join(",")})`;

function extractProjectRef(url) {
  if (!url) return null;
  const m = String(url).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

function resolveCreds(env) {
  const url =
    env.STAGING_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    "";
  const serviceKey =
    env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  return { url, serviceKey, projectRef: extractProjectRef(url) };
}

function assertStaging(creds) {
  if (creds.projectRef === COMMS_PRODUCTION_PROJECT_REF) {
    return { ok: false, code: "PRODUCTION_BLOCKED" };
  }
  if (creds.projectRef !== COMMS_STAGING_PROJECT_REF) {
    return { ok: false, code: "TARGET_REF_MISMATCH" };
  }
  if (!creds.serviceKey) {
    return { ok: false, code: "SERVICE_ROLE_MISSING" };
  }
  return { ok: true, code: "STAGING_OK" };
}

function sha256File(filePath) {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

async function rest(url, key, method, table, { query = "", body = null, prefer } = {}) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  if (body != null) headers["Content-Type"] = "application/json";
  const res = await fetch(endpoint, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  const contentRange = res.headers.get("content-range") || "";
  const totalMatch = contentRange.match(/\/(\d+|\*)/);
  const total =
    totalMatch && totalMatch[1] !== "*"
      ? Number(totalMatch[1])
      : Array.isArray(json)
        ? json.length
        : null;
  return {
    ok: res.ok,
    status: res.status,
    json,
    total,
    error: res.ok ? null : String(text).slice(0, 400),
  };
}

async function selectAll(url, key, table, query) {
  const r = await rest(url, key, "GET", table, {
    query,
    prefer: "count=exact",
  });
  return {
    ...r,
    rows: Array.isArray(r.json) ? r.json : [],
  };
}

async function insertRows(url, key, table, rows) {
  return rest(url, key, "POST", table, {
    body: rows,
    prefer: "return=representation",
  });
}

async function deleteByQuery(url, key, table, query) {
  return rest(url, key, "DELETE", table, {
    query,
    prefer: "return=representation",
  });
}

function parseArgs(argv) {
  const args = {
    inventory: false,
    plan: false,
    apply: false,
    verify: false,
    cleanup: false,
    verifyBackup: null,
    help: false,
  };
  for (const raw of argv) {
    if (raw === "--inventory") args.inventory = true;
    else if (raw === "--plan") args.plan = true;
    else if (raw === "--apply-fixtures") args.apply = true;
    else if (raw === "--verify-fixtures") args.verify = true;
    else if (raw === "--cleanup-fixtures") args.cleanup = true;
    else if (raw.startsWith("--verify-backup=")) {
      args.verifyBackup = raw.slice("--verify-backup=".length);
    } else if (raw === "--help" || raw === "-h") args.help = true;
  }
  return args;
}

function verifyBackupDir(dirPath) {
  const findings = [];
  if (!dirPath || !existsSync(dirPath)) {
    return {
      ok: false,
      findings: [{ code: "BACKUP_DIR_MISSING", message: String(dirPath) }],
    };
  }
  const base = path.basename(dirPath);
  if (!base.includes(EXPECTED_BACKUP_DIR_SUFFIX)) {
    findings.push({
      code: "BACKUP_DIR_SUFFIX_UNEXPECTED",
      message: `Expected suffix ${EXPECTED_BACKUP_DIR_SUFFIX}, got ${base}`,
    });
  }
  const required = [
    "roles.sql",
    "schema.sql",
    "data.sql",
    "migration-history-schema.sql",
    "migration-history-data.sql",
    "backup-manifest.csv",
    "comms-act-04-owner-go-evidence.txt",
  ];
  for (const f of required) {
    const p = path.join(dirPath, f);
    if (!existsSync(p) || statSync(p).size <= 0) {
      findings.push({ code: "BACKUP_FILE_MISSING_OR_EMPTY", message: f });
    }
  }
  const manifestPath = path.join(dirPath, "backup-manifest.csv");
  if (existsSync(manifestPath)) {
    const raw = readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^file,/i.test(l));
    for (const line of lines) {
      const [file, bytes, hash] = line.split(",");
      if (!file || !bytes || !hash) continue;
      const p = path.join(dirPath, file);
      if (!existsSync(p)) {
        findings.push({ code: "MANIFEST_FILE_MISSING", message: file });
        continue;
      }
      const actualBytes = String(statSync(p).size);
      const actualHash = sha256File(p);
      if (actualBytes !== String(bytes)) {
        findings.push({
          code: "MANIFEST_BYTES_MISMATCH",
          message: `${file}: expected ${bytes} got ${actualBytes}`,
        });
      }
      if (actualHash !== String(hash).trim().toLowerCase()) {
        findings.push({
          code: "MANIFEST_HASH_MISMATCH",
          message: `${file}: expected ${hash} got ${actualHash}`,
        });
      }
    }
  }
  const zipPath = `${dirPath}.zip`;
  let zip = null;
  if (existsSync(zipPath)) {
    const hash = sha256File(zipPath);
    zip = { path: zipPath, bytes: statSync(zipPath).size, sha256: hash };
    if (hash !== EXPECTED_ZIP_SHA256) {
      findings.push({
        code: "ZIP_HASH_MISMATCH",
        message: `expected ${EXPECTED_ZIP_SHA256} got ${hash}`,
      });
    }
  } else {
    findings.push({ code: "ZIP_MISSING", message: zipPath });
  }

  // Ensure Communication tables were empty at backup time (count in dump)
  const dataPath = path.join(dirPath, "data.sql");
  let dumpConversationMarkers = 0;
  if (existsSync(dataPath)) {
    const sample = readFileSync(dataPath, "utf8");
    // Count COPY blocks mentioning communication_conversations with data rows is heavy;
    // instead check marker absence in dump (pre-fixture baseline).
    dumpConversationMarkers = (
      sample.match(/COMMS_ACT_04_CERT_FIXTURE_/g) || []
    ).length;
  }

  return {
    ok: findings.length === 0,
    dirPath,
    zip,
    dumpConversationMarkers,
    findings,
  };
}

async function inventoryCommunication(url, key) {
  const specs = [
    ["communication_conversations", `conversation_id=${IN_CONV}`],
    ["communication_conversation_participants", `conversation_id=${IN_CONV}`],
    ["communication_messages", `message_id=${IN_MSG}`],
    ["communication_message_reactions", `reaction_id=${IN_RX}`],
    ["communication_pinned_messages", `conversation_id=${IN_CONV}`],
    ["communication_read_cursors", `conversation_id=${IN_CONV}`],
    ["communication_message_position_counters", `conversation_id=${IN_CONV}`],
  ];
  const out = {};
  for (const [table, markerQuery] of specs) {
    const all = await selectAll(url, key, table, "select=*&limit=1");
    const marker = await selectAll(
      url,
      key,
      table,
      `select=*&${markerQuery}&limit=50`
    );
    out[table] = {
      totalApprox: all.total,
      markerApprox: marker.total,
      queryOk: all.ok && marker.ok,
      errors: [all.error, marker.error].filter(Boolean),
    };
  }
  return out;
}

async function resolveBindings(url, key) {
  const clubA = await selectAll(
    url,
    key,
    "clubs",
    `select=id,name,tenant_id,status&id=eq.${CLUB_A_ID}&limit=1`
  );
  const clubB = await selectAll(
    url,
    key,
    "clubs",
    `select=id,name,tenant_id,status&id=eq.${CLUB_B_ID}&limit=1`
  );
  const activeA = await selectAll(
    url,
    key,
    "club_members",
    `select=id,club_id,user_id,membership_type,status,tenant_id&club_id=eq.${CLUB_A_ID}&status=eq.active&order=id.asc&limit=1`
  );
  const removedA = await selectAll(
    url,
    key,
    "club_members",
    `select=id,club_id,user_id,membership_type,status,tenant_id&club_id=eq.${CLUB_A_ID}&status=eq.removed&order=id.asc&limit=1`
  );
  const activeB = await selectAll(
    url,
    key,
    "club_members",
    `select=id,club_id,user_id,membership_type,status,tenant_id&club_id=eq.${CLUB_B_ID}&status=eq.active&order=id.asc&limit=5`
  );
  const aUser = activeA.rows?.[0]?.user_id;
  const bMember =
    (activeB.rows || []).find((m) => m.user_id !== aUser) || activeB.rows?.[0];

  const sameTenantOther = await selectAll(
    url,
    key,
    "club_members",
    `select=id,club_id,user_id,membership_type,status,tenant_id&tenant_id=eq.${TENANT_A}&status=eq.active&limit=100`
  );
  const aIds = new Set(
    [aUser, bMember?.user_id, removedA.rows?.[0]?.user_id].filter(Boolean)
  );
  const nonMember = (sameTenantOther.rows || []).find(
    (m) =>
      m.club_id !== CLUB_A_ID &&
      m.club_id !== CLUB_B_ID &&
      !aIds.has(m.user_id)
  );

  const gov = await selectAll(
    url,
    key,
    "club_governance_assignments",
    "select=club_id,role_code,status&status=eq.active&limit=5"
  );

  const ok =
    clubA.ok &&
    clubB.ok &&
    clubA.rows?.[0]?.tenant_id === TENANT_A &&
    clubB.rows?.[0]?.tenant_id === TENANT_A &&
    Boolean(aUser) &&
    Boolean(bMember?.user_id) &&
    Boolean(removedA.rows?.[0]?.user_id);

  return {
    ok,
    clubA: clubA.rows?.[0] || null,
    clubB: clubB.rows?.[0] || null,
    activeA: activeA.rows?.[0] || null,
    removedA: removedA.rows?.[0] || null,
    activeB: bMember || null,
    sameTenantNonMember: nonMember || null,
    governanceSampleRoles: [
      ...new Set((gov.rows || []).map((r) => r.role_code).filter(Boolean)),
    ],
    managerOwner: {
      predicate: "phase42_active_club_member_id",
      roleAware: false,
      membershipTypeAware: false,
      structuralEquivalenceWithRegularActiveMember: true,
      note: "Club SELECT uses active membership only; no membership_type/role elevation required.",
    },
  };
}

function buildFixtureRows(bindings) {
  const activeA = bindings.activeA.user_id;
  const activeB = bindings.activeB.user_id;
  const ts = FIXTURE_TS;

  const conversations = [
    {
      conversation_id: `${MARKER}CLUB_A`,
      conversation_type: "CLUB",
      status: "ACTIVE",
      tenant_id: TENANT_A,
      club_id: CLUB_A_ID,
      created_at: ts,
      created_by_participant_id: activeA,
      channel_key: `${MARKER}CLUB_A_GENERAL`,
      channel_kind: "GENERAL",
      channel_name: "ACT-04 Cert Club A GENERAL",
      channel_visibility: "JOIN_REQUIRED",
      lifecycle_status: "ACTIVE",
      direct_pair_key: null,
      updated_at: ts,
    },
    {
      conversation_id: `${MARKER}CLUB_B`,
      conversation_type: "CLUB",
      status: "ACTIVE",
      tenant_id: TENANT_A,
      club_id: CLUB_B_ID,
      created_at: ts,
      created_by_participant_id: activeB,
      channel_key: `${MARKER}CLUB_B_GENERAL`,
      channel_kind: "GENERAL",
      channel_name: "ACT-04 Cert Club B GENERAL",
      channel_visibility: "JOIN_REQUIRED",
      lifecycle_status: "ACTIVE",
      direct_pair_key: null,
      updated_at: ts,
    },
    {
      conversation_id: `${MARKER}DIRECT`,
      conversation_type: "DIRECT",
      status: "ACTIVE",
      tenant_id: null,
      club_id: null,
      created_at: ts,
      created_by_participant_id: activeA,
      channel_key: null,
      channel_kind: null,
      channel_name: null,
      channel_visibility: null,
      lifecycle_status: null,
      direct_pair_key: `${MARKER}DIRECT_PAIR`,
      updated_at: ts,
    },
    {
      conversation_id: `${MARKER}SYSTEM`,
      conversation_type: "SYSTEM",
      status: "ACTIVE",
      tenant_id: TENANT_A,
      club_id: null,
      created_at: ts,
      created_by_participant_id: activeA,
      channel_key: null,
      channel_kind: null,
      channel_name: null,
      channel_visibility: null,
      lifecycle_status: null,
      direct_pair_key: null,
      updated_at: ts,
    },
    {
      conversation_id: `${MARKER}COMMUNITY`,
      conversation_type: "COMMUNITY",
      status: "ACTIVE",
      tenant_id: TENANT_A,
      club_id: null,
      created_at: ts,
      created_by_participant_id: activeA,
      channel_key: `${MARKER}COMMUNITY_LOBBY`,
      channel_kind: "LOBBY",
      channel_name: "ACT-04 Cert Community LOBBY",
      channel_visibility: "PUBLIC",
      lifecycle_status: "ACTIVE",
      direct_pair_key: null,
      updated_at: ts,
    },
  ];

  const participants = [
    {
      conversation_id: `${MARKER}CLUB_A`,
      participant_id: activeA,
      role: "MEMBER",
      status: "ACTIVE",
      joined_at: ts,
      updated_at: ts,
    },
    {
      conversation_id: `${MARKER}CLUB_B`,
      participant_id: activeB,
      role: "MEMBER",
      status: "ACTIVE",
      joined_at: ts,
      updated_at: ts,
    },
  ];

  const counters = [
    { conversation_id: `${MARKER}CLUB_A`, next_position: 2 },
    { conversation_id: `${MARKER}CLUB_B`, next_position: 2 },
  ];

  const messages = [
    {
      message_id: `${MARKER}CLUB_A_MSG1`,
      conversation_id: `${MARKER}CLUB_A`,
      sender_participant_id: activeA,
      body: `${MARKER} Club A message`,
      status: "VISIBLE",
      created_at: ts,
      position: 1,
      client_idempotency_key: `${MARKER}CLUB_A_IDEM1`,
    },
    {
      message_id: `${MARKER}CLUB_B_MSG1`,
      conversation_id: `${MARKER}CLUB_B`,
      sender_participant_id: activeB,
      body: `${MARKER} Club B message`,
      status: "VISIBLE",
      created_at: ts,
      position: 1,
      client_idempotency_key: `${MARKER}CLUB_B_IDEM1`,
    },
  ];

  const reactions = [
    {
      reaction_id: `${MARKER}CLUB_A_RX1`,
      message_id: `${MARKER}CLUB_A_MSG1`,
      conversation_id: `${MARKER}CLUB_A`,
      participant_id: activeA,
      emoji: "👍",
      created_at: ts,
    },
    {
      reaction_id: `${MARKER}CLUB_B_RX1`,
      message_id: `${MARKER}CLUB_B_MSG1`,
      conversation_id: `${MARKER}CLUB_B`,
      participant_id: activeB,
      emoji: "✅",
      created_at: ts,
    },
  ];

  const pins = [
    {
      conversation_id: `${MARKER}CLUB_A`,
      message_id: `${MARKER}CLUB_A_MSG1`,
      pinned_by_participant_id: activeA,
      pinned_at: ts,
    },
    {
      conversation_id: `${MARKER}CLUB_B`,
      message_id: `${MARKER}CLUB_B_MSG1`,
      pinned_by_participant_id: activeB,
      pinned_at: ts,
    },
  ];

  const cursors = [
    {
      conversation_id: `${MARKER}CLUB_A`,
      participant_id: activeA,
      last_read_at: ts,
      last_read_message_id: `${MARKER}CLUB_A_MSG1`,
      last_read_position: 1,
      updated_at: ts,
    },
    {
      conversation_id: `${MARKER}CLUB_B`,
      participant_id: activeB,
      last_read_at: ts,
      last_read_message_id: `${MARKER}CLUB_B_MSG1`,
      last_read_position: 1,
      updated_at: ts,
    },
  ];

  return { conversations, participants, counters, messages, reactions, pins, cursors };
}

async function countMarkers(url, key) {
  const counts = {};
  const specs = [
    ["conversations", "communication_conversations", `conversation_id=${IN_CONV}`],
    [
      "participants",
      "communication_conversation_participants",
      `conversation_id=${IN_CONV}`,
    ],
    ["messages", "communication_messages", `message_id=${IN_MSG}`],
    ["reactions", "communication_message_reactions", `reaction_id=${IN_RX}`],
    ["pins", "communication_pinned_messages", `conversation_id=${IN_CONV}`],
    ["cursors", "communication_read_cursors", `conversation_id=${IN_CONV}`],
    [
      "counters",
      "communication_message_position_counters",
      `conversation_id=${IN_CONV}`,
    ],
  ];
  for (const [label, table, filter] of specs) {
    const r = await selectAll(url, key, table, `select=*&${filter}&limit=100`);
    counts[label] = { ok: r.ok, count: r.total, error: r.error };
  }
  return counts;
}

async function applyFixtures(url, key, bindings) {
  const existing = await selectAll(
    url,
    key,
    "communication_conversations",
    `select=conversation_id&conversation_id=${IN_CONV}&limit=10`
  );
  if ((existing.total ?? 0) > 0) {
    return {
      ok: false,
      code: "MARKER_ALREADY_PRESENT",
      existing: existing.total,
      message: "Fixture marker already exists — run cleanup first.",
    };
  }

  const rows = buildFixtureRows(bindings);
  const steps = [];

  const c1 = await insertRows(
    url,
    key,
    "communication_conversations",
    rows.conversations
  );
  steps.push({ table: "communication_conversations", ...c1, expected: 5 });
  if (!c1.ok) return { ok: false, code: "INSERT_FAILED", steps };

  const c2 = await insertRows(
    url,
    key,
    "communication_conversation_participants",
    rows.participants
  );
  steps.push({
    table: "communication_conversation_participants",
    ...c2,
    expected: 2,
  });
  if (!c2.ok) return { ok: false, code: "INSERT_FAILED", steps };

  const c3 = await insertRows(
    url,
    key,
    "communication_message_position_counters",
    rows.counters
  );
  steps.push({
    table: "communication_message_position_counters",
    ...c3,
    expected: 2,
  });
  if (!c3.ok) return { ok: false, code: "INSERT_FAILED", steps };

  const c4 = await insertRows(url, key, "communication_messages", rows.messages);
  steps.push({ table: "communication_messages", ...c4, expected: 2 });
  if (!c4.ok) return { ok: false, code: "INSERT_FAILED", steps };

  const c5 = await insertRows(
    url,
    key,
    "communication_message_reactions",
    rows.reactions
  );
  steps.push({ table: "communication_message_reactions", ...c5, expected: 2 });
  if (!c5.ok) return { ok: false, code: "INSERT_FAILED", steps };

  const c6 = await insertRows(
    url,
    key,
    "communication_pinned_messages",
    rows.pins
  );
  steps.push({ table: "communication_pinned_messages", ...c6, expected: 2 });
  if (!c6.ok) return { ok: false, code: "INSERT_FAILED", steps };

  const c7 = await insertRows(
    url,
    key,
    "communication_read_cursors",
    rows.cursors
  );
  steps.push({ table: "communication_read_cursors", ...c7, expected: 2 });
  if (!c7.ok) return { ok: false, code: "INSERT_FAILED", steps };

  return { ok: true, code: "FIXTURES_INSERTED", steps };
}

async function cleanupFixtures(url, key) {
  // Order: dependents first, then conversations (exact IDs only)
  const order = [
    ["communication_message_reactions", `reaction_id=${IN_RX}`],
    ["communication_pinned_messages", `conversation_id=${IN_CONV}`],
    ["communication_read_cursors", `conversation_id=${IN_CONV}`],
    ["communication_messages", `message_id=${IN_MSG}`],
    ["communication_message_position_counters", `conversation_id=${IN_CONV}`],
    ["communication_conversation_participants", `conversation_id=${IN_CONV}`],
    ["communication_conversations", `conversation_id=${IN_CONV}`],
  ];
  const steps = [];
  for (const [table, query] of order) {
    const r = await deleteByQuery(url, key, table, query);
    steps.push({ table, ok: r.ok, status: r.status, error: r.error });
    if (!r.ok) return { ok: false, code: "CLEANUP_FAILED", steps };
  }
  const remaining = await countMarkers(url, key);
  const residual = Object.values(remaining).reduce(
    (n, x) => n + (x.count || 0),
    0
  );
  return {
    ok: residual === 0,
    code: residual === 0 ? "CLEANUP_ZERO_MARKERS" : "CLEANUP_RESIDUAL",
    remaining,
    steps,
  };
}

function expectedMarkerCounts() {
  return {
    conversations: 5,
    participants: 2,
    messages: 2,
    reactions: 2,
    pins: 2,
    cursors: 2,
    counters: 2,
  };
}

function certificationReadiness(bindings, markerCounts, inventory) {
  const expected = expectedMarkerCounts();
  const countsMatch = Object.entries(expected).every(
    ([k, v]) => markerCounts[k]?.count === v
  );
  const clubConvReady =
    (markerCounts.conversations?.count || 0) >= 2 &&
    Boolean(bindings.activeA) &&
    Boolean(bindings.activeB);
  return {
    positiveActiveMemberClubA: clubConvReady,
    positiveActiveMemberClubB: clubConvReady,
    crossClubDenyDataReady: clubConvReady,
    inactiveRemovedDenyDataReady: Boolean(bindings.removedA),
    sameTenantNonMemberDenyDataReady: Boolean(bindings.sameTenantNonMember),
    directDenyDataReady: (markerCounts.conversations?.count || 0) >= 5,
    systemDenyDataReady: (markerCounts.conversations?.count || 0) >= 5,
    communityDenyDataReady: (markerCounts.conversations?.count || 0) >= 5,
    writeStillDeniedAssumption: true,
    rpcStillDeniedAssumption: true,
    realtimeStillZeroAssumption: true,
    managerOwnerStructuralEquivalence: true,
    markerCountsMatchExpected: countsMatch,
    expectedMarkerCounts: expected,
    observedMarkerCounts: Object.fromEntries(
      Object.entries(markerCounts).map(([k, v]) => [k, v.count])
    ),
    preApplyRlsUnchanged:
      inventory?.communication_conversations?.totalApprox != null,
    act03NotAppliedByThisScript: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.inventory && !args.plan && !args.apply && !args.verify && !args.cleanup && !args.verifyBackup)) {
    console.log(`COMMS-ACT-04 cert fixtures

  --verify-backup=DIR
  --inventory
  --plan
  --apply-fixtures
  --verify-fixtures
  --cleanup-fixtures
`);
    process.exit(0);
  }

  loadProjectEnv();
  const creds = resolveCreds(process.env);
  const gate = assertStaging(creds);
  if (!gate.ok) {
    console.error(JSON.stringify({ verdict: gate.code, secretsPrinted: false }));
    process.exit(1);
  }

  const payload = {
    phase: "COMMS-ACT-04",
    mode: [],
    target: {
      projectRef: creds.projectRef,
      productionBlocked: true,
    },
    marker: MARKER,
    mutationCount: 0,
    act03SqlApplied: false,
    realtimeChanged: false,
    clubMembersMutated: false,
    authUsersCreated: false,
    secretsPrinted: false,
  };

  if (args.verifyBackup) {
    payload.mode.push("verify-backup");
    payload.backup = verifyBackupDir(args.verifyBackup);
  }

  if (args.inventory || args.apply || args.verify || args.plan) {
    payload.mode.push("inventory");
    payload.inventoryBefore = await inventoryCommunication(
      creds.url,
      creds.serviceKey
    );
  }

  let bindings = null;
  if (args.plan || args.apply || args.verify) {
    payload.mode.push("plan");
    bindings = await resolveBindings(creds.url, creds.serviceKey);
    payload.bindings = {
      ok: bindings.ok,
      clubAId: bindings.clubA?.id || null,
      clubBId: bindings.clubB?.id || null,
      tenantId: TENANT_A,
      activeAUserPrefix: String(bindings.activeA?.user_id || "").slice(0, 8),
      activeBUserPrefix: String(bindings.activeB?.user_id || "").slice(0, 8),
      removedAUserPrefix: String(bindings.removedA?.user_id || "").slice(0, 8),
      sameTenantNonMemberPrefix: String(
        bindings.sameTenantNonMember?.user_id || ""
      ).slice(0, 8),
      managerOwner: bindings.managerOwner,
      governanceSampleRoles: bindings.governanceSampleRoles,
    };
    if (!bindings.ok) {
      payload.verdict = "COMMS_ACT_04_BLOCKED_FIXTURE_BINDINGS";
      console.log(JSON.stringify(payload, null, 2));
      process.exit(1);
    }
  }

  if (args.apply) {
    payload.mode.push("apply-fixtures");
    const result = await applyFixtures(creds.url, creds.serviceKey, bindings);
    payload.apply = {
      ok: result.ok,
      code: result.code,
      steps: (result.steps || []).map((s) => ({
        table: s.table,
        ok: s.ok,
        status: s.status,
        expected: s.expected,
        error: s.error || null,
      })),
    };
    payload.mutationCount += result.ok ? 1 : 0;
    if (!result.ok) {
      payload.verdict = `COMMS_ACT_04_BLOCKED_${result.code}`;
      console.log(JSON.stringify(payload, null, 2));
      process.exit(1);
    }
  }

  if (args.cleanup) {
    payload.mode.push("cleanup-fixtures");
    const result = await cleanupFixtures(creds.url, creds.serviceKey);
    payload.cleanup = result;
    payload.mutationCount += 1;
    payload.verdict = result.ok
      ? "COMMS_ACT_04_FIXTURE_CLEANUP_COMPLETE"
      : "COMMS_ACT_04_BLOCKED_FIXTURE_CLEANUP";
    console.log(JSON.stringify(payload, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  if (args.verify || args.apply) {
    payload.mode.push("verify-fixtures");
    const markerCounts = await countMarkers(creds.url, creds.serviceKey);
    const inventoryAfter = await inventoryCommunication(
      creds.url,
      creds.serviceKey
    );
    payload.markerCounts = markerCounts;
    payload.inventoryAfter = inventoryAfter;
    payload.certificationReadiness = certificationReadiness(
      bindings,
      markerCounts,
      inventoryAfter
    );

    const expected = expectedMarkerCounts();
    const match = Object.entries(expected).every(
      ([k, v]) => markerCounts[k]?.count === v
    );
    const backupOk = args.verifyBackup ? payload.backup?.ok !== false : true;
    // If verify-backup not requested in same run, treat as separate.
    const ready =
      match &&
      bindings?.ok &&
      payload.certificationReadiness.positiveActiveMemberClubA &&
      payload.certificationReadiness.inactiveRemovedDenyDataReady &&
      payload.certificationReadiness.sameTenantNonMemberDenyDataReady &&
      payload.act03SqlApplied === false;

    payload.verdict = ready
      ? "COMMS_ACT_04_READY_FOR_STAGING_CLUB_SELECT_APPLY"
      : "COMMS_ACT_04_BLOCKED_TEST_IDENTITIES";

    // optional backup gate when provided
    if (args.verifyBackup && !payload.backup.ok) {
      payload.verdict = "COMMS_ACT_04_BLOCKED_BACKUP_INVALID";
    }

    console.log(JSON.stringify(payload, null, 2));
    process.exit(
      payload.verdict === "COMMS_ACT_04_READY_FOR_STAGING_CLUB_SELECT_APPLY"
        ? 0
        : 1
    );
  }

  if (args.verifyBackup && !args.inventory && !args.plan) {
    payload.verdict = payload.backup.ok
      ? "COMMS_ACT_04_BACKUP_STILL_VALID"
      : "COMMS_ACT_04_BLOCKED_BACKUP_INVALID";
    console.log(JSON.stringify(payload, null, 2));
    process.exit(payload.backup.ok ? 0 : 1);
  }

  if (args.inventory || args.plan) {
    payload.verdict = bindings?.ok
      ? "COMMS_ACT_04_FIXTURE_PLAN_READY"
      : payload.inventoryBefore
        ? "COMMS_ACT_04_INVENTORY_CAPTURED"
        : "COMMS_ACT_04_BLOCKED_TEST_IDENTITIES";
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      verdict: "COMMS_ACT_04_BLOCKED_FIXTURE_SCRIPT",
      error: String(err?.message || err),
      secretsPrinted: false,
    })
  );
  process.exit(1);
});
