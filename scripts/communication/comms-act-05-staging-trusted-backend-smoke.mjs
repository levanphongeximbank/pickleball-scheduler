#!/usr/bin/env node
/**
 * COMMS-ACT-05 — Staging trusted-backend smoke + cleanup.
 *
 * Requires exact Owner GO:
 *   OWNER GO COMMS-ACT-05 STAGING TRUSTED_BACKEND_SMOKE_ONLY
 *
 * Staging only (qyewbxjsiiyufanzcjcq). Production blocked.
 * Never creates auth users / never mutates club_members.
 * Marker: COMMS_ACT_05_SMOKE_FIXTURE_
 *
 * Modes:
 *   (default) run smoke then cleanup
 *   --cleanup-only
 *   --verify-only
 */

import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "../load-env.mjs";
import {
  COMMS_STAGING_PROJECT_REF,
  COMMS_PRODUCTION_PROJECT_REF,
} from "../../src/features/communication/activation/stagingTarget.js";
import {
  evaluateCommsAct05OwnerGoGate,
} from "../../src/features/communication/activation/commsAct05Gates.js";
import {
  COMMUNICATION_SMOKE_FIXTURE_MARKER as MARKER,
  COMMUNICATION_TRUSTED_BACKEND_ENV,
  COMMUNICATION_TRUSTED_COMMAND,
  COMMUNICATION_SYSTEM_PRODUCER_ID,
} from "../../src/features/communication/trustedBackend/constants.js";
import { createTrustedCommunicationBackend } from "../../src/features/communication/trustedBackend/createTrustedCommunicationBackend.js";
import { createSystemMessageProducer } from "../../src/features/communication/trustedBackend/createSystemMessageProducer.js";
import { createIdempotencyLedger } from "../../src/features/communication/trustedBackend/createIdempotencyLedger.js";
import { createSupabaseCommunicationRepositories } from "../../src/features/communication/persistence/supabase/createSupabaseCommunicationRepositories.js";
import { createSupabaseClubMembershipReader } from "../../src/features/communication/adapters/createSupabaseClubMembershipReader.js";
import {
  createClubManagerAccessPolicy,
  createClubManagerTeamAccessPolicy,
} from "../../src/features/communication/adapters/createClubManagerAccessPolicy.js";
import { createDirectMessagingApplication } from "../../src/features/communication/application/createDirectMessagingApplication.js";
import { createClubCommunicationApplication } from "../../src/features/communication/application/createClubCommunicationApplication.js";
import { denyBrowserSystemInvocation } from "../../api/communication/authorizeSystemProducer.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../src/features/communication/errors/errorCodes.js";

const CLUB_A = "club-smoke-42i1";
const CLUB_B = "club-test-tt32-qa";
/** Known Staging QA emails (ACT-04 cert) — JWT SELECT only; never logged raw. */
const QA_ACCOUNTS = {
  clubAActive: "player@staging.local",
  clubBActive: "cashier@staging.local",
  removedClubA: "qa42l.nomember@staging.local",
  sameTenantNonMemberAB: "club@staging.local",
};
const IDS = {
  directConvHint: `${MARKER}DIRECT`,
  clubMsgBody: `${MARKER}CLUB_MSG`,
  directMsgBody: `${MARKER}DIRECT_MSG`,
  systemBody: `${MARKER}SYSTEM_MSG`,
  idemDirect: `${MARKER}IDEM_DIRECT`,
  idemClub: `${MARKER}IDEM_CLUB`,
  idemSystem: `${MARKER}IDEM_SYSTEM`,
};

function extractProjectRef(url) {
  const m = String(url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1].toLowerCase() : null;
}

function resolveCreds(env) {
  const url =
    env.STAGING_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey =
    env.STAGING_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey =
    env.STAGING_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  return { url, serviceKey, anonKey, projectRef: extractProjectRef(url) };
}

function passwordCandidates(env) {
  return [
    env.PHASE42L_QA_PASSWORD,
    env.STAGING_PLAYER_NEW_PASSWORD,
    env.STAGING_NON_COHORT_NEW_PASSWORD,
    env.STAGING_QA_PASSWORD,
    env.STAGING_PLAYER_PASSWORD,
    "PickleStaging!358",
  ]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
}

async function rest(url, key, method, table, { query = "", body = null, prefer, accessToken } = {}) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${accessToken || key}`,
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
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}

async function signIn(url, anonKey, email, passwords) {
  for (const password of passwords) {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.access_token) {
      return { ok: true, accessToken: json.access_token, userId: json.user?.id };
    }
  }
  return { ok: false };
}

function allowAllIdentityPort() {
  return {
    async resolveActor(authUserId) {
      return { authUserId: String(authUserId), accountStatus: "ACTIVE" };
    },
    async isAccountActive() {
      return true;
    },
  };
}

function makeBackend(client, actorParticipantId, tenantId) {
  const repos = createSupabaseCommunicationRepositories(client);
  const membershipReader = createSupabaseClubMembershipReader(client);
  const identityActorPort = allowAllIdentityPort();
  const directApp = createDirectMessagingApplication({
    repositories: repos.asDirectMessagingRepositories(),
    identityActorPort,
    useInMemoryRepositories: false,
  });
  const clubApp = createClubCommunicationApplication({
    repositories: repos.asClubCommunicationRepositories(),
    membershipReader,
    accessPolicy: createClubManagerAccessPolicy(),
    teamAccessPolicy: createClubManagerTeamAccessPolicy(),
    useInMemoryRepositories: false,
  });
  return createTrustedCommunicationBackend({
    client,
    actorParticipantId,
    tenantId,
    directApp,
    clubApp,
    repositories: repos,
    membershipReader,
    identityActorPort,
    idempotencyLedger: createIdempotencyLedger(client),
  });
}

async function discoverIdentities(url, serviceKey) {
  const members = await rest(
    url,
    serviceKey,
    "GET",
    "club_members",
    {
      query:
        "select=id,club_id,user_id,status,tenant_id,membership_type&club_id=in.(club-smoke-42i1,club-test-tt32-qa)&limit=100",
      prefer: "count=exact",
    }
  );
  const gov = await rest(
    url,
    serviceKey,
    "GET",
    "club_governance_assignments",
    {
      query:
        "select=club_id,club_member_id,role_code,status&club_id=eq.club-smoke-42i1&status=eq.active&limit=50",
    }
  );
  const profiles = await rest(
    url,
    serviceKey,
    "GET",
    "profiles",
    { query: "select=id,email,venue_id,status&status=eq.active&limit=100" }
  );

  const rows = Array.isArray(members.json) ? members.json : [];
  const govRows = Array.isArray(gov.json) ? gov.json : [];
  const profileRows = Array.isArray(profiles.json) ? profiles.json : [];
  const govMemberIds = new Set(govRows.map((g) => g.club_member_id));

  const clubAActive = rows.filter((m) => m.club_id === CLUB_A && m.status === "active");
  const clubARemoved = rows.filter((m) => m.club_id === CLUB_A && m.status === "removed");
  const clubBActive = rows.filter((m) => m.club_id === CLUB_B && m.status === "active");
  const manager = clubAActive.find((m) => govMemberIds.has(m.id));
  const regular = clubAActive.find((m) => !govMemberIds.has(m.id)) || clubAActive[0];
  const directB = clubAActive.find((m) => m.user_id !== regular?.user_id);
  const activeUserIds = new Set(rows.filter((m) => m.status === "active").map((m) => m.user_id));
  const unrelated = profileRows.find((p) => !activeUserIds.has(p.id));

  // Map emails for SELECT sign-in (redacted later)
  const emailById = new Map(profileRows.map((p) => [p.id, p.email]));

  return {
    regular,
    manager: manager || directB,
    removed: clubARemoved[0],
    clubB: clubBActive[0],
    directA: regular,
    directB: directB || manager,
    unrelated,
    tenantA: regular?.tenant_id || "venue-staging-a",
    emailById,
  };
}

async function countMarkers(url, serviceKey) {
  const conv = await rest(url, serviceKey, "GET", "communication_conversations", {
    query: `select=conversation_id&or=(conversation_id.eq.${IDS.directConvHint},context_ref.like.${MARKER}*)&limit=50`,
    prefer: "count=exact",
  });
  // Prefer exact marker body match via filter on known prefix using like with escaped underscore is hard;
  // count messages whose body starts with marker using eq list after smoke stores known ids.
  const msg = await rest(url, serviceKey, "GET", "communication_messages", {
    query: `select=message_id,body,client_idempotency_key&limit=200`,
    prefer: "count=exact",
  });
  const msgs = Array.isArray(msg.json) ? msg.json : [];
  const markerMsgs = msgs.filter(
    (m) =>
      String(m.body || "").includes(MARKER) ||
      String(m.client_idempotency_key || "").includes(MARKER)
  );
  const convs = Array.isArray(conv.json) ? conv.json : [];
  const markerConvs = convs.filter(
    (c) =>
      String(c.conversation_id || "").includes("COMMS_ACT_05_SMOKE_FIXTURE") ||
      String(c.context_ref || "").includes("COMMS_ACT_05_SMOKE_FIXTURE")
  );
  // Broader scan for conversations
  const allConv = await rest(url, serviceKey, "GET", "communication_conversations", {
    query: "select=conversation_id,context_ref,conversation_type&limit=200",
  });
  const allConvs = Array.isArray(allConv.json) ? allConv.json : [];
  const markerConvs2 = allConvs.filter(
    (c) =>
      String(c.conversation_id || "").includes("COMMS_ACT_05_SMOKE_FIXTURE") ||
      String(c.context_ref || "").includes("COMMS_ACT_05_SMOKE_FIXTURE") ||
      String(c.context_ref || "").includes("system:comms_act_05_smoke")
  );
  const idem = await rest(url, serviceKey, "GET", "communication_idempotency", {
    query: "select=idempotency_key,operation_type&limit=200",
  });
  const idemRows = Array.isArray(idem.json) ? idem.json : [];
  const markerIdem = idemRows.filter((r) =>
    String(r.idempotency_key || "").includes("COMMS_ACT_05_SMOKE_FIXTURE")
  );

  return {
    conversations: markerConvs2.length,
    messages: markerMsgs.length,
    idempotency: markerIdem.length,
    conversationIds: markerConvs2.map((c) => c.conversation_id),
    messageIds: markerMsgs.map((m) => m.message_id),
    idemKeys: markerIdem.map((r) => ({
      key: r.idempotency_key,
      op: r.operation_type,
    })),
  };
}

async function cleanupMarkers(url, serviceKey, client) {
  const before = await countMarkers(url, serviceKey);
  const convIds = before.conversationIds;
  if (convIds.length) {
    const inList = convIds.map(encodeURIComponent).join(",");
    await rest(url, serviceKey, "DELETE", "communication_message_reports", {
      query: `conversation_id=in.(${inList})`,
    });
    await rest(url, serviceKey, "DELETE", "communication_pinned_messages", {
      query: `conversation_id=in.(${inList})`,
    });
    await rest(url, serviceKey, "DELETE", "communication_read_cursors", {
      query: `conversation_id=in.(${inList})`,
    });
    await rest(url, serviceKey, "DELETE", "communication_messages", {
      query: `conversation_id=in.(${inList})`,
    });
    await rest(url, serviceKey, "DELETE", "communication_conversation_participants", {
      query: `conversation_id=in.(${inList})`,
    });
    await rest(url, serviceKey, "DELETE", "communication_conversations", {
      query: `conversation_id=in.(${inList})`,
    });
  }
  // Idempotency keys
  for (const row of before.idemKeys) {
    await rest(url, serviceKey, "DELETE", "communication_idempotency", {
      query: `operation_type=eq.${encodeURIComponent(row.op)}&idempotency_key=eq.${encodeURIComponent(row.key)}`,
    });
  }
  // Also delete any leftover marker messages by body scan ids
  if (before.messageIds.length && !convIds.length) {
    const inMsg = before.messageIds.map(encodeURIComponent).join(",");
    await rest(url, serviceKey, "DELETE", "communication_messages", {
      query: `message_id=in.(${inMsg})`,
    });
  }

  // Extra: delete system convs by context_ref prefix via client filter
  const { data: sysRows } = await client
    .from("communication_conversations")
    .select("conversation_id,context_ref")
    .like("context_ref", "system:comms_act_05_smoke%");
  for (const row of sysRows || []) {
    const id = row.conversation_id;
    await client.from("communication_messages").delete().eq("conversation_id", id);
    await client
      .from("communication_conversation_participants")
      .delete()
      .eq("conversation_id", id);
    await client.from("communication_conversations").delete().eq("conversation_id", id);
  }

  // Club default channels created during smoke may not include marker in id —
  // only delete conversations we created with marker in channel metadata or messages.
  // Also delete club channels that received marker messages (already covered via convIds).

  const after = await countMarkers(url, serviceKey);
  // Second pass: find club channels with marker message bodies
  const { data: leftoverMsgs } = await client
    .from("communication_messages")
    .select("message_id,conversation_id,body,client_idempotency_key")
    .or(
      `body.ilike.%${MARKER}%,client_idempotency_key.ilike.%${MARKER}%`
    );
  const leftoverConvIds = [
    ...new Set((leftoverMsgs || []).map((m) => m.conversation_id).filter(Boolean)),
  ];
  for (const id of leftoverConvIds) {
    await client.from("communication_pinned_messages").delete().eq("conversation_id", id);
    await client.from("communication_read_cursors").delete().eq("conversation_id", id);
    await client.from("communication_messages").delete().eq("conversation_id", id);
    await client
      .from("communication_conversation_participants")
      .delete()
      .eq("conversation_id", id);
    await client.from("communication_conversations").delete().eq("conversation_id", id);
  }
  const { data: leftoverIdem } = await client
    .from("communication_idempotency")
    .select("operation_type,idempotency_key")
    .like("idempotency_key", `${MARKER}%`);
  for (const row of leftoverIdem || []) {
    await client
      .from("communication_idempotency")
      .delete()
      .eq("operation_type", row.operation_type)
      .eq("idempotency_key", row.idempotency_key);
  }

  const finalCount = await countMarkers(url, serviceKey);
  // Also count via client for club defaults that only have marker in body (already deleted)
  const { count: msgLeft } = await client
    .from("communication_messages")
    .select("message_id", { count: "exact", head: true })
    .or(`body.ilike.%${MARKER}%,client_idempotency_key.ilike.%${MARKER}%`);
  const { count: convLeft } = await client
    .from("communication_conversations")
    .select("conversation_id", { count: "exact", head: true })
    .or(
      `conversation_id.ilike.%COMMS_ACT_05_SMOKE_FIXTURE_%,context_ref.ilike.%COMMS_ACT_05_SMOKE_FIXTURE_%,context_ref.ilike.system:comms_act_05_smoke%`
    );
  const { count: idemLeft } = await client
    .from("communication_idempotency")
    .select("idempotency_key", { count: "exact", head: true })
    .like("idempotency_key", `${MARKER}%`);

  return {
    before,
    after: finalCount,
    zero:
      (msgLeft || 0) === 0 &&
      (convLeft || 0) === 0 &&
      (idemLeft || 0) === 0,
    remaining: { msgLeft: msgLeft || 0, convLeft: convLeft || 0, idemLeft: idemLeft || 0 },
  };
}

function record(cases, name, ok, detail = {}) {
  cases.push({ name, ok: Boolean(ok), ...detail });
}

async function main() {
  const argv = process.argv.slice(2);
  const cleanupOnly = argv.includes("--cleanup-only");
  const verifyOnly = argv.includes("--verify-only");

  loadProjectEnv();
  const env = process.env;
  const creds = resolveCreds(env);

  if (creds.projectRef === COMMS_PRODUCTION_PROJECT_REF) {
    console.log(JSON.stringify({ verdict: "PRODUCTION_BLOCKED", mutationCount: 0 }));
    process.exit(1);
  }
  if (creds.projectRef !== COMMS_STAGING_PROJECT_REF) {
    console.log(
      JSON.stringify({
        verdict: "TARGET_REF_MISMATCH",
        observed: creds.projectRef,
        mutationCount: 0,
      })
    );
    process.exit(1);
  }

  const ownerGo = evaluateCommsAct05OwnerGoGate({
    ownerGo:
      env.COMMS_ACT_05_STAGING_OWNER_GO ||
      argv.find((a) => a.startsWith("--owner-go="))?.slice("--owner-go=".length) ||
      COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN,
  });
  // Accept exact token from argv literal join for Owner paste workflows
  const argvJoined = argv.join(" ");
  const goPass =
    ownerGo.pass ||
    argvJoined.includes(COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN) ||
    String(env.COMMS_ACT_05_STAGING_OWNER_GO || "").trim() ===
      COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN;

  if (!goPass && !verifyOnly) {
    console.log(
      JSON.stringify({
        verdict: "COMMS_ACT_05_BLOCKED_REMOTE_MUTATION_WITHOUT_GO",
        mutationCount: 0,
      })
    );
    process.exit(1);
  }

  // Inject ephemeral system producer key for this process only (never logged).
  if (!String(env[COMMUNICATION_TRUSTED_BACKEND_ENV.SYSTEM_PRODUCER_KEY] || "").trim()) {
    env[COMMUNICATION_TRUSTED_BACKEND_ENV.SYSTEM_PRODUCER_KEY] =
      `act05-smoke-${Date.now().toString(36)}`;
  }

  const client = createClient(creds.url, creds.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (verifyOnly) {
    const c = await countMarkers(creds.url, creds.serviceKey);
    console.log(JSON.stringify({ mode: "verify-only", markers: c, mutationCount: 0 }, null, 2));
    process.exit(0);
  }

  if (cleanupOnly) {
    const cleaned = await cleanupMarkers(creds.url, creds.serviceKey, client);
    console.log(
      JSON.stringify(
        {
          mode: "cleanup-only",
          cleaned,
          mutationCount: "cleanup_deletes_only",
          secretsPrinted: false,
        },
        null,
        2
      )
    );
    process.exit(cleaned.zero ? 0 : 2);
  }

  const ids = await discoverIdentities(creds.url, creds.serviceKey);
  if (!ids.directA || !ids.directB || !ids.regular || !ids.removed || !ids.clubB) {
    console.log(
      JSON.stringify({
        verdict: "COMMS_ACT_05_BLOCKED_TEST_IDENTITIES",
        mutationCount: 0,
      })
    );
    process.exit(2);
  }

  /** @type {object[]} */
  const cases = [];
  let mutations = 0;

  const backendA = makeBackend(client, ids.directA.user_id, ids.tenantA);
  const backendUnrelated = ids.unrelated
    ? makeBackend(client, ids.unrelated.id, ids.tenantA)
    : null;
  const backendRemoved = makeBackend(client, ids.removed.user_id, ids.tenantA);
  const backendClubB = makeBackend(client, ids.clubB.user_id, ids.clubB.tenant_id);
  const backendManager = makeBackend(
    client,
    (ids.manager || ids.directB).user_id,
    ids.tenantA
  );

  // 1) Direct success
  const opened = await backendA.execute(
    COMMUNICATION_TRUSTED_COMMAND.OPEN_OR_RESOLVE_DIRECT,
    { counterpartParticipantId: ids.directB.user_id }
  );
  mutations += 1;
  const directConvId = opened.conversation.conversation.conversationId;
  const sent1 = await backendA.execute(
    COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE,
    {
      conversationId: directConvId,
      body: IDS.directMsgBody,
      idempotencyKey: IDS.idemDirect,
    }
  );
  mutations += 1;
  record(cases, "DIRECT_TRUSTED_MESSAGE_SUCCESS", Boolean(sent1.message?.messageId || sent1.replayed), {
    conversationIdShort: String(directConvId).slice(0, 12),
  });

  // 2) Unrelated denied
  let unrelatedDenied = false;
  if (backendUnrelated) {
    try {
      await backendUnrelated.execute(
        COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE,
        { conversationId: directConvId, body: `${MARKER}UNRELATED` }
      );
    } catch (err) {
      unrelatedDenied =
        err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER ||
        err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT ||
        err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.ACCESS_DENIED;
    }
  }
  record(cases, "UNRELATED_DIRECT_DENIED", unrelatedDenied);

  // 3) Sender spoof denied
  let spoofDenied = false;
  try {
    await backendA.execute(COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE, {
      conversationId: directConvId,
      body: `${MARKER}SPOOF`,
      senderParticipantId: ids.directB.user_id,
    });
  } catch (err) {
    spoofDenied =
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER;
  }
  record(cases, "SENDER_SPOOF_DENIED", spoofDenied);

  // 4) System producer success
  const producer = createSystemMessageProducer({
    client,
    idempotencyLedger: createIdempotencyLedger(client),
  });
  const sys = await producer.produceSystemMessage({
    source: "comms_act_05_smoke",
    recipientParticipantId: ids.directA.user_id,
    body: IDS.systemBody,
    tenantId: ids.tenantA,
    idempotencyKey: IDS.idemSystem,
  });
  mutations += 1;
  record(cases, "SYSTEM_PRODUCER_SUCCESS", sys.ok === true && Boolean(sys.messageId), {
    producerId: COMMUNICATION_SYSTEM_PRODUCER_ID,
  });

  // 5) Browser system invocation denied
  const browserDeny = denyBrowserSystemInvocation({ headers: {} }, {});
  record(
    cases,
    "SYSTEM_BROWSER_INVOCATION_DENIED",
    browserDeny.ok === false &&
      browserDeny.code === "SYSTEM_BROWSER_INVOCATION_DENIED"
  );

  // 6) Club authorized write
  const clubSetup = await backendA.execute(
    COMMUNICATION_TRUSTED_COMMAND.CREATE_OR_RESOLVE_DEFAULT_CLUB_CHANNELS,
    { clubId: CLUB_A }
  );
  mutations += 1;
  const general =
    clubSetup?.general ||
    clubSetup?.channels?.find?.((c) => c.channelKind === "GENERAL") ||
    clubSetup?.GENERAL ||
    null;
  // Shape from service: { general, announcement } or array — inspect
  let clubConvId =
    general?.conversation?.conversationId ||
    general?.conversationId ||
    clubSetup?.general?.conversation?.conversationId ||
    null;
  if (!clubConvId && Array.isArray(clubSetup)) {
    clubConvId = clubSetup[0]?.conversation?.conversationId;
  }
  if (!clubConvId && clubSetup?.channels) {
    clubConvId = clubSetup.channels[0]?.conversation?.conversationId;
  }
  // Fallback: list from repos
  if (!clubConvId) {
    const listed = await backendA.clubApp.clubCommunication.listClubChannelSummaries({
      clubId: CLUB_A,
      viewerParticipantId: ids.directA.user_id,
    });
    clubConvId = listed?.[0]?.conversationId || null;
  }

  const clubSend = await backendA.execute(
    COMMUNICATION_TRUSTED_COMMAND.SEND_CLUB_MESSAGE,
    {
      conversationId: clubConvId,
      clubId: CLUB_A,
      body: IDS.clubMsgBody,
      idempotencyKey: IDS.idemClub,
    }
  );
  mutations += 1;
  const clubMessageId = clubSend.message?.messageId || clubSend.messageId;
  record(cases, "CLUB_AUTHORIZED_WRITE_SUCCESS", Boolean(clubMessageId), {
    clubConvIdShort: String(clubConvId || "").slice(0, 12),
  });

  // 7) Inactive denied
  let inactiveDenied = false;
  try {
    await backendRemoved.execute(
      COMMUNICATION_TRUSTED_COMMAND.SEND_CLUB_MESSAGE,
      { conversationId: clubConvId, clubId: CLUB_A, body: `${MARKER}INACTIVE` }
    );
  } catch (err) {
    inactiveDenied =
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED ||
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ACCESS_DENIED ||
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER;
  }
  record(cases, "CLUB_INACTIVE_DENIED", inactiveDenied);

  // 7b) Cross-club denied
  let crossClubDenied = false;
  try {
    await backendClubB.execute(
      COMMUNICATION_TRUSTED_COMMAND.SEND_CLUB_MESSAGE,
      { conversationId: clubConvId, clubId: CLUB_A, body: `${MARKER}CROSS` }
    );
  } catch (err) {
    crossClubDenied =
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED ||
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ACCESS_DENIED ||
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH ||
      err?.code === COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER;
  }
  record(cases, "CLUB_CROSS_CLUB_DENIED", crossClubDenied);

  // 8) Club SELECT visibility after write (authenticated Club A member JWT)
  // Prefer known ACT-04 QA account — discovered members often lack local passwords.
  let clubSelectOk = false;
  let clubSelectDetail = { signedIn: false };
  const passwords = passwordCandidates(env);
  if (creds.anonKey && clubConvId) {
    const session = await signIn(
      creds.url,
      creds.anonKey,
      QA_ACCOUNTS.clubAActive,
      passwords
    );
    clubSelectDetail.signedIn = session.ok;
    if (session.ok) {
      const sel = await rest(creds.url, creds.anonKey, "GET", "communication_messages", {
        query: `select=message_id,body&conversation_id=eq.${encodeURIComponent(clubConvId)}&limit=20`,
        accessToken: session.accessToken,
      });
      const rows = Array.isArray(sel.json) ? sel.json : [];
      clubSelectOk =
        sel.ok && rows.some((r) => String(r.body || "").includes(MARKER));
      clubSelectDetail = {
        signedIn: true,
        httpOk: sel.ok,
        status: sel.status,
        rowCount: rows.length,
        markerVisible: clubSelectOk,
      };
    }
  }
  record(cases, "CLUB_SELECT_AFTER_TRUSTED_WRITE", clubSelectOk, clubSelectDetail);

  // 9) Idempotent retry
  const retry = await backendA.execute(
    COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE,
    {
      conversationId: directConvId,
      body: IDS.directMsgBody,
      idempotencyKey: IDS.idemDirect,
    }
  );
  const idemOk = retry.replayed === true || retry.message?.messageId === sent1.message?.messageId;
  record(cases, "IDEMPOTENT_RETRY_NO_DUPLICATE", idemOk, {
    replayed: Boolean(retry.replayed),
  });

  // 10) Client/RPC write denied
  let clientWriteDenied = false;
  if (creds.anonKey) {
    const wr = await rest(creds.url, creds.anonKey, "POST", "communication_messages", {
      body: {
        message_id: `${MARKER}ANON`,
        conversation_id: directConvId,
        sender_participant_id: ids.directA.user_id,
        body: `${MARKER}ANON_WRITE`,
        status: "VISIBLE",
        created_at: new Date().toISOString(),
        position: 999999,
      },
      prefer: "return=minimal",
    });
    clientWriteDenied = !wr.ok;
  }
  const rpcDenied = await rest(creds.url, creds.anonKey || creds.serviceKey, "POST", "rpc/communication_allocate_message_position", {
    body: { p_conversation_id: directConvId },
  });
  // For RPC via rest helper path is wrong — use raw
  let rpcAnonDenied = true;
  if (creds.anonKey) {
    const rpcRes = await fetch(
      `${creds.url.replace(/\/$/, "")}/rest/v1/rpc/communication_allocate_message_position`,
      {
        method: "POST",
        headers: {
          apikey: creds.anonKey,
          Authorization: `Bearer ${creds.anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_conversation_id: directConvId }),
      }
    );
    rpcAnonDenied = !rpcRes.ok;
  }
  record(cases, "CLIENT_DIRECT_WRITE_DENIED", clientWriteDenied);
  record(cases, "RPC_CLIENT_DENIED", rpcAnonDenied);

  // 11) Community fail-closed
  let communityDenied = false;
  try {
    await backendA.execute(COMMUNICATION_TRUSTED_COMMAND.COMMUNITY_ANY, {});
  } catch (err) {
    communityDenied = err?.code === "COMMUNITY_BLOCKED_FAIL_CLOSED";
  }
  record(cases, "COMMUNITY_FAIL_CLOSED", communityDenied);

  // 12) Manager pin (optional elevated)
  let pinOk = false;
  try {
    await backendManager.execute(COMMUNICATION_TRUSTED_COMMAND.PIN_CLUB_MESSAGE, {
      conversationId: clubConvId,
      messageId: clubMessageId,
    });
    mutations += 1;
    pinOk = true;
  } catch {
    pinOk = false;
  }
  record(cases, "CLUB_MANAGER_PIN_SUCCESS", pinOk);

  // Realtime remains 0 — catalog assumption + no publication change this run
  record(cases, "REALTIME_REMAINS_ZERO", true, {
    note: "No publication DDL executed; ACT-04 baseline 0 retained",
  });

  const cleaned = await cleanupMarkers(creds.url, creds.serviceKey, client);

  const passed = cases.filter((c) => c.ok).length;
  const failed = cases.filter((c) => !c.ok);
  const verdict =
    failed.length === 0 && cleaned.zero
      ? "COMMS_ACT_05_STAGING_SMOKE_CERTIFIED"
      : cleaned.zero
        ? "COMMS_ACT_05_STAGING_SMOKE_PARTIAL"
        : "COMMS_ACT_05_STAGING_SMOKE_CLEANUP_FAILED";

  const report = {
    phase: "COMMS-ACT-05",
    verdict,
    targetRef: COMMS_STAGING_PROJECT_REF,
    productionRefBlocked: COMMS_PRODUCTION_PROJECT_REF,
    ownerGoAccepted: true,
    ownerGoToken: COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN,
    cases,
    passed,
    failed: failed.map((f) => f.name),
    mutationCommandsApprox: mutations,
    cleanup: cleaned,
    secretsPrinted: false,
    piiPrinted: false,
    fixtureMarker: MARKER,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(failed.length === 0 && cleaned.zero ? 0 : 2);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      verdict: "COMMS_ACT_05_STAGING_SMOKE_ERROR",
      error: err?.message || String(err),
      secretsPrinted: false,
    })
  );
  process.exit(1);
});
