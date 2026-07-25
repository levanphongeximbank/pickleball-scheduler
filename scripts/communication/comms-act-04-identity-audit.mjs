#!/usr/bin/env node
/**
 * COMMS-ACT-04 — Staging identity/data audit for Club SELECT certification (read-only).
 *
 * Uses Staging service-role only for SELECT inventory. Never mutates.
 * Never prints emails in full when avoidable; prints counts + redacted markers.
 * Refuses Production. Refuses --apply / --seed / --write.
 */

import { loadProjectEnv } from "../load-env.mjs";
import {
  COMMS_STAGING_PROJECT_REF,
  COMMS_PRODUCTION_PROJECT_REF,
} from "../../src/features/communication/activation/index.js";

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

function redactEmail(email) {
  if (!email || typeof email !== "string") return null;
  const [user, domain] = email.split("@");
  if (!domain) return "(redacted)";
  const u = user.length <= 2 ? "*" : `${user.slice(0, 2)}***`;
  return `${u}@${domain}`;
}

async function restSelect(url, key, table, query) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${table}?${query}`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });
  const text = await res.text();
  let rows = [];
  try {
    rows = JSON.parse(text);
  } catch {
    rows = [];
  }
  const contentRange = res.headers.get("content-range") || "";
  const totalMatch = contentRange.match(/\/(\d+|\*)/);
  const total =
    totalMatch && totalMatch[1] !== "*" ? Number(totalMatch[1]) : Array.isArray(rows) ? rows.length : null;
  return { ok: res.ok, status: res.status, rows: Array.isArray(rows) ? rows : [], total, rawError: res.ok ? null : text.slice(0, 240) };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.some((a) => a === "--apply" || a === "--seed" || a === "--write")) {
    console.error(
      JSON.stringify({
        verdict: "COMMS_ACT_04_BLOCKED_MUTATION_REFUSED",
        secretsPrinted: false,
      })
    );
    process.exit(1);
  }

  loadProjectEnv();
  const creds = resolveCreds(process.env);
  if (creds.projectRef === COMMS_PRODUCTION_PROJECT_REF) {
    console.error(JSON.stringify({ verdict: "PRODUCTION_BLOCKED", secretsPrinted: false }));
    process.exit(1);
  }
  if (creds.projectRef !== COMMS_STAGING_PROJECT_REF) {
    console.error(
      JSON.stringify({
        verdict: "TARGET_REF_MISMATCH",
        projectRef: creds.projectRef,
        secretsPrinted: false,
      })
    );
    process.exit(1);
  }
  if (!creds.serviceKey) {
    console.error(
      JSON.stringify({
        verdict: "SERVICE_ROLE_MISSING",
        secretsPrinted: false,
      })
    );
    process.exit(1);
  }

  const findings = [];

  const clubConv = await restSelect(
    creds.url,
    creds.serviceKey,
    "communication_conversations",
    "select=conversation_id,conversation_type,club_id,tenant_id,status&conversation_type=eq.CLUB&limit=20"
  );
  const directConv = await restSelect(
    creds.url,
    creds.serviceKey,
    "communication_conversations",
    "select=conversation_id&conversation_type=eq.DIRECT&limit=1"
  );
  const systemConv = await restSelect(
    creds.url,
    creds.serviceKey,
    "communication_conversations",
    "select=conversation_id&conversation_type=eq.SYSTEM&limit=1"
  );
  const communityConv = await restSelect(
    creds.url,
    creds.serviceKey,
    "communication_conversations",
    "select=conversation_id&conversation_type=eq.COMMUNITY&limit=1"
  );
  const allConvCount = await restSelect(
    creds.url,
    creds.serviceKey,
    "communication_conversations",
    "select=conversation_id&limit=1"
  );

  // Club membership inventory (canonical SoT used by phase42 helper).
  // club_members has membership_type (not role); status in {active,left,removed}.
  const activeMembers = await restSelect(
    creds.url,
    creds.serviceKey,
    "club_members",
    "select=id,club_id,user_id,membership_type,status,tenant_id&status=eq.active&limit=50"
  );
  const inactiveMembers = await restSelect(
    creds.url,
    creds.serviceKey,
    "club_members",
    "select=id,club_id,user_id,membership_type,status,tenant_id&status=neq.active&limit=20"
  );
  const clubs = await restSelect(
    creds.url,
    creds.serviceKey,
    "clubs",
    "select=id,name,tenant_id,status&limit=20"
  );

  // Probe alternate status spellings if first returns empty schema errors.
  let memberStatusNote = null;
  if (!activeMembers.ok) {
    memberStatusNote = `club_members active query failed http=${activeMembers.status}`;
    findings.push({
      level: "warn",
      code: "CLUB_MEMBERS_QUERY",
      message: memberStatusNote,
    });
  }

  const profiles = await restSelect(
    creds.url,
    creds.serviceKey,
    "profiles",
    "select=id,email,role&limit=30"
  );

  const clubIdsFromConv = [
    ...new Set(
      (clubConv.rows || [])
        .map((r) => r.club_id)
        .filter(Boolean)
    ),
  ];
  const activeUserIds = [
    ...new Set((activeMembers.rows || []).map((r) => r.user_id).filter(Boolean)),
  ];
  const inactiveUserIds = [
    ...new Set((inactiveMembers.rows || []).map((r) => r.user_id).filter(Boolean)),
  ];

  // Overlap: active members whose club_id appears in Club conversations
  const positiveCandidates = (activeMembers.rows || []).filter((m) =>
    clubIdsFromConv.includes(m.club_id)
  );
  const managerOwnerCandidates = positiveCandidates.filter((m) =>
    /owner|manager|admin|president/i.test(String(m.membership_type || ""))
  );

  // Negative candidate pools
  const unrelatedUsers = (profiles.rows || []).filter(
    (p) => !activeUserIds.includes(p.id) && !inactiveUserIds.includes(p.id)
  );

  const stagingLocalProfiles = (profiles.rows || []).filter((p) =>
    /@staging\.local$/i.test(String(p.email || ""))
  );

  if (!clubConv.ok) {
    findings.push({
      level: "error",
      code: "CLUB_CONV_QUERY_FAILED",
      message: `Cannot read communication_conversations: http=${clubConv.status}`,
    });
  }
  if ((clubConv.total ?? clubConv.rows.length) === 0) {
    findings.push({
      level: "error",
      code: "NO_CLUB_CONVERSATIONS",
      message: "No CLUB conversations in Staging — positive SELECT certification blocked.",
    });
  }
  if (positiveCandidates.length === 0) {
    findings.push({
      level: "error",
      code: "NO_POSITIVE_MEMBER_OVERLAP",
      message:
        "No active club_members overlapping Club conversation club_id — positive certification blocked.",
    });
  }

  const payload = {
    phase: "COMMS-ACT-04",
    mode: "identity-audit-readonly",
    target: {
      projectRef: creds.projectRef,
      productionBlocked: true,
    },
    mutationCount: 0,
    conversations: {
      totalApprox: allConvCount.total,
      clubApprox: clubConv.total,
      clubSampleCount: clubConv.rows.length,
      clubIdsSampled: clubIdsFromConv,
      directPresent: (directConv.total ?? directConv.rows.length) > 0,
      systemPresent: (systemConv.total ?? systemConv.rows.length) > 0,
      communityPresent: (communityConv.total ?? communityConv.rows.length) > 0,
    },
    membership: {
      activeApprox: activeMembers.total,
      inactiveApprox: inactiveMembers.total,
      activeSampleCount: activeMembers.rows.length,
      inactiveSampleCount: inactiveMembers.rows.length,
      membershipTypesSampled: [
        ...new Set(
          (activeMembers.rows || []).map((m) => m.membership_type).filter(Boolean)
        ),
      ],
      statusesSampled: [
        ...new Set(
          [...(activeMembers.rows || []), ...(inactiveMembers.rows || [])]
            .map((m) => m.status)
            .filter(Boolean)
        ),
      ],
      queryOk: activeMembers.ok,
      note: memberStatusNote,
      clubsApprox: clubs.total,
      clubsSampleCount: clubs.rows.length,
      clubsQueryOk: clubs.ok,
    },
    profiles: {
      sampleCount: profiles.rows.length,
      totalApprox: profiles.total,
      stagingLocalCount: stagingLocalProfiles.length,
      stagingLocalRedacted: stagingLocalProfiles
        .slice(0, 8)
        .map((p) => ({ idPrefix: String(p.id || "").slice(0, 8), email: redactEmail(p.email), role: p.role })),
    },
    certificationReadiness: {
      positiveActiveMemberForClubScope: positiveCandidates.length > 0,
      positiveManagerOwner: managerOwnerCandidates.length > 0,
      positiveCandidateCount: positiveCandidates.length,
      managerOwnerCandidateCount: managerOwnerCandidates.length,
      negativeUnrelatedProfileSample: unrelatedUsers.length > 0,
      negativeInactiveMemberSample: inactiveUserIds.length > 0,
      negativeCrossClubPossible:
        clubIdsFromConv.length >= 2 ||
        new Set((activeMembers.rows || []).map((m) => m.club_id)).size >= 2,
      directRowsAvailableForNegative: (directConv.total ?? directConv.rows.length) > 0,
      communityRowsAvailableForNegative:
        (communityConv.total ?? communityConv.rows.length) > 0,
      systemRowsAvailableForNegative: (systemConv.total ?? systemConv.rows.length) > 0,
      anonNegative: true,
      writeNegative: true,
      rpcNegative: true,
      realtimeNegative: true,
    },
    findings,
    pass: !findings.some((f) => f.level === "error"),
    verdict: null,
    secretsPrinted: false,
    passwordsPrinted: false,
  };

  payload.verdict = payload.pass
    ? positiveCandidates.length > 0
      ? "COMMS_ACT_04_IDENTITIES_READY"
      : "COMMS_ACT_04_BLOCKED_TEST_IDENTITIES"
    : findings.some((f) => f.code === "NO_POSITIVE_MEMBER_OVERLAP" || f.code === "NO_CLUB_CONVERSATIONS")
      ? "COMMS_ACT_04_BLOCKED_TEST_IDENTITIES"
      : "COMMS_ACT_04_BLOCKED_LIVE_PREFLIGHT";

  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      verdict: "COMMS_ACT_04_BLOCKED_TEST_IDENTITIES",
      error: String(err?.message || err),
      secretsPrinted: false,
    })
  );
  process.exit(1);
});
