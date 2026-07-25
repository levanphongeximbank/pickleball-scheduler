#!/usr/bin/env node
/**
 * COMMS-ACT-04 Gate D helper — resolve fixture identity emails (read-only).
 * Never prints passwords. Redacts emails.
 */
import { loadProjectEnv } from "../load-env.mjs";
import {
  COMMS_STAGING_PROJECT_REF,
  COMMS_PRODUCTION_PROJECT_REF,
} from "../../src/features/communication/activation/index.js";

const MARKER = "COMMS_ACT_04_CERT_FIXTURE_";
const CLUB_A = "club-smoke-42i1";
const CLUB_B = "club-test-tt32-qa";
const TENANT_A = "venue-staging-a";

function extractProjectRef(url) {
  const m = String(url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

function redactEmail(email) {
  if (!email) return null;
  const [u, d] = String(email).split("@");
  if (!d) return "(redacted)";
  return `${u.slice(0, 2)}***@${d}`;
}

async function rest(url, key, table, query) {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });
  const json = await res.json().catch(() => []);
  return {
    ok: res.ok,
    status: res.status,
    rows: Array.isArray(json) ? json : [],
    error: res.ok ? null : String(JSON.stringify(json)).slice(0, 200),
  };
}

async function main() {
  loadProjectEnv();
  const url = process.env.STAGING_SUPABASE_URL || "";
  const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
  const ref = extractProjectRef(url);
  if (ref === COMMS_PRODUCTION_PROJECT_REF) {
    console.error(JSON.stringify({ verdict: "PRODUCTION_BLOCKED" }));
    process.exit(1);
  }
  if (ref !== COMMS_STAGING_PROJECT_REF || !key) {
    console.error(JSON.stringify({ verdict: "TARGET_OR_KEY_BAD", ref }));
    process.exit(1);
  }

  const convs = await rest(
    url,
    key,
    "communication_conversations",
    `select=conversation_id,conversation_type,club_id,tenant_id&conversation_id=in.(${MARKER}CLUB_A,${MARKER}CLUB_B,${MARKER}DIRECT,${MARKER}SYSTEM,${MARKER}COMMUNITY)`
  );
  const parts = await rest(
    url,
    key,
    "communication_conversation_participants",
    `select=conversation_id,participant_id&conversation_id=in.(${MARKER}CLUB_A,${MARKER}CLUB_B)`
  );
  const activeA = await rest(
    url,
    key,
    "club_members",
    `select=id,user_id,status,membership_type&club_id=eq.${CLUB_A}&status=eq.active&order=id.asc&limit=5`
  );
  const removedA = await rest(
    url,
    key,
    "club_members",
    `select=id,user_id,status&club_id=eq.${CLUB_A}&status=eq.removed&order=id.asc&limit=3`
  );
  const activeB = await rest(
    url,
    key,
    "club_members",
    `select=id,user_id,status&club_id=eq.${CLUB_B}&status=eq.active&order=id.asc&limit=10`
  );
  const sameTenant = await rest(
    url,
    key,
    "club_members",
    `select=id,user_id,club_id,status&tenant_id=eq.${TENANT_A}&status=eq.active&limit=100`
  );

  const participantA = (parts.rows || []).find(
    (p) => p.conversation_id === `${MARKER}CLUB_A`
  )?.participant_id;
  const participantB = (parts.rows || []).find(
    (p) => p.conversation_id === `${MARKER}CLUB_B`
  )?.participant_id;

  const aUsers = new Set([participantA, ...(activeA.rows || []).map((m) => m.user_id)]);
  const bUsers = new Set([participantB, ...(activeB.rows || []).map((m) => m.user_id)]);
  const removedUsers = new Set((removedA.rows || []).map((m) => m.user_id));

  const nonMember = (sameTenant.rows || []).find(
    (m) =>
      m.club_id !== CLUB_A &&
      m.club_id !== CLUB_B &&
      !aUsers.has(m.user_id) &&
      !bUsers.has(m.user_id) &&
      !removedUsers.has(m.user_id)
  );

  const ids = [
    ...new Set(
      [
        participantA,
        participantB,
        ...(removedA.rows || []).map((m) => m.user_id),
        nonMember?.user_id,
        ...(activeA.rows || []).map((m) => m.user_id),
        ...(activeB.rows || []).map((m) => m.user_id),
      ].filter(Boolean)
    ),
  ];

  const profiles = ids.length
    ? await rest(
        url,
        key,
        "profiles",
        `select=id,email,role&id=in.(${ids.join(",")})`
      )
    : { rows: [] };

  const byId = new Map((profiles.rows || []).map((p) => [p.id, p]));

  console.log(
    JSON.stringify(
      {
        target: ref,
        conversations: convs.rows,
        identities: {
          activeA: {
            userIdPrefix: String(participantA || "").slice(0, 8),
            email: redactEmail(byId.get(participantA)?.email),
            role: byId.get(participantA)?.role || null,
          },
          activeB: {
            userIdPrefix: String(participantB || "").slice(0, 8),
            email: redactEmail(byId.get(participantB)?.email),
            role: byId.get(participantB)?.role || null,
          },
          removedA: (removedA.rows || []).map((m) => ({
            userIdPrefix: String(m.user_id).slice(0, 8),
            email: redactEmail(byId.get(m.user_id)?.email),
            role: byId.get(m.user_id)?.role || null,
          })),
          sameTenantNonMember: nonMember
            ? {
                userIdPrefix: String(nonMember.user_id).slice(0, 8),
                clubId: nonMember.club_id,
                email: redactEmail(byId.get(nonMember.user_id)?.email),
                role: byId.get(nonMember.user_id)?.role || null,
              }
            : null,
        },
        knownQaEmailsPresent: (profiles.rows || [])
          .map((p) => p.email)
          .filter((e) => /@staging\.local$/i.test(e || ""))
          .map(redactEmail),
        secretsPrinted: false,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e.message || e) }));
  process.exit(1);
});
