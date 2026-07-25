#!/usr/bin/env node
/**
 * COMMS-ACT-04 — discover existing Staging clubs/members for cert fixtures (read-only).
 * Never mutates. Staging allowlist only.
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
    totalMatch && totalMatch[1] !== "*"
      ? Number(totalMatch[1])
      : Array.isArray(rows)
        ? rows.length
        : null;
  return {
    ok: res.ok,
    status: res.status,
    rows: Array.isArray(rows) ? rows : [],
    total,
    error: res.ok ? null : text.slice(0, 240),
  };
}

function pickPlan(activeRows, removedRows, clubsRows) {
  const clubMeta = new Map(clubsRows.map((c) => [c.id, c]));
  const byClub = new Map();
  for (const m of activeRows) {
    if (!byClub.has(m.club_id)) byClub.set(m.club_id, []);
    byClub.get(m.club_id).push(m);
  }
  const removedByClub = new Map();
  for (const m of removedRows) {
    if (!removedByClub.has(m.club_id)) removedByClub.set(m.club_id, []);
    removedByClub.get(m.club_id).push(m);
  }

  const clubs = [...byClub.entries()]
    .map(([clubId, members]) => {
      const meta = clubMeta.get(clubId);
      const removed = removedByClub.get(clubId) || [];
      return {
        clubId,
        tenantId: members[0]?.tenant_id || meta?.tenant_id || null,
        name: meta?.name || null,
        status: meta?.status || null,
        activeMembers: members,
        removedMembers: removed,
      };
    })
    .filter((c) => c.activeMembers.length >= 1 && c.tenantId);

  // Prefer club with removed member as Club A.
  clubs.sort(
    (a, b) =>
      b.removedMembers.length - a.removedMembers.length ||
      b.activeMembers.length - a.activeMembers.length
  );

  const clubA = clubs[0] || null;
  if (!clubA) return { ok: false, reason: "NO_ACTIVE_CLUB" };

  // Club B: different club, prefer same tenant, different active user than A's primary.
  const aUser = clubA.activeMembers[0].user_id;
  const clubB =
    clubs.find(
      (c) =>
        c.clubId !== clubA.clubId &&
        c.tenantId === clubA.tenantId &&
        c.activeMembers.some((m) => m.user_id !== aUser)
    ) ||
    clubs.find(
      (c) =>
        c.clubId !== clubA.clubId &&
        c.activeMembers.some((m) => m.user_id !== aUser)
    ) ||
    clubs.find((c) => c.clubId !== clubA.clubId) ||
    null;

  if (!clubB) return { ok: false, reason: "NO_SECOND_CLUB", clubA };

  const activeA = clubA.activeMembers[0];
  const activeB =
    clubB.activeMembers.find((m) => m.user_id !== activeA.user_id) ||
    clubB.activeMembers[0];
  const removedA = clubA.removedMembers[0] || null;

  // Same-tenant non-member: active in another club of same tenant, not in A or B.
  const membersOfA = new Set(clubA.activeMembers.map((m) => m.user_id));
  const membersOfB = new Set(clubB.activeMembers.map((m) => m.user_id));
  const removedOfA = new Set(clubA.removedMembers.map((m) => m.user_id));
  let sameTenantNonMember = null;
  for (const c of clubs) {
    if (c.tenantId !== clubA.tenantId) continue;
    if (c.clubId === clubA.clubId || c.clubId === clubB.clubId) continue;
    for (const m of c.activeMembers) {
      if (
        !membersOfA.has(m.user_id) &&
        !membersOfB.has(m.user_id) &&
        !removedOfA.has(m.user_id)
      ) {
        sameTenantNonMember = m;
        break;
      }
    }
    if (sameTenantNonMember) break;
  }

  // Cross-tenant candidate if available.
  let crossTenantMember = null;
  for (const c of clubs) {
    if (c.tenantId === clubA.tenantId) continue;
    if (c.activeMembers[0]) {
      crossTenantMember = c.activeMembers[0];
      break;
    }
  }

  return {
    ok: true,
    clubA: {
      clubId: clubA.clubId,
      tenantId: clubA.tenantId,
      name: clubA.name,
      activeMember: {
        memberId: activeA.id,
        userId: activeA.user_id,
        membershipType: activeA.membership_type,
        status: activeA.status,
      },
      removedMember: removedA
        ? {
            memberId: removedA.id,
            userId: removedA.user_id,
            membershipType: removedA.membership_type,
            status: removedA.status,
          }
        : null,
    },
    clubB: {
      clubId: clubB.clubId,
      tenantId: clubB.tenantId,
      name: clubB.name,
      activeMember: {
        memberId: activeB.id,
        userId: activeB.user_id,
        membershipType: activeB.membership_type,
        status: activeB.status,
      },
    },
    sameTenantNonMember: sameTenantNonMember
      ? {
          memberId: sameTenantNonMember.id,
          userId: sameTenantNonMember.user_id,
          clubId: sameTenantNonMember.club_id,
          tenantId: sameTenantNonMember.tenant_id,
          membershipType: sameTenantNonMember.membership_type,
          status: sameTenantNonMember.status,
        }
      : null,
    crossTenantMember: crossTenantMember
      ? {
          memberId: crossTenantMember.id,
          userId: crossTenantMember.user_id,
          clubId: crossTenantMember.club_id,
          tenantId: crossTenantMember.tenant_id,
        }
      : null,
    sameTenant: clubA.tenantId === clubB.tenantId,
  };
}

async function main() {
  loadProjectEnv();
  const url =
    process.env.STAGING_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const serviceKey =
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const projectRef = extractProjectRef(url);

  if (projectRef === COMMS_PRODUCTION_PROJECT_REF) {
    console.error(JSON.stringify({ verdict: "PRODUCTION_BLOCKED" }));
    process.exit(1);
  }
  if (projectRef !== COMMS_STAGING_PROJECT_REF) {
    console.error(
      JSON.stringify({ verdict: "TARGET_REF_MISMATCH", projectRef })
    );
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(JSON.stringify({ verdict: "SERVICE_ROLE_MISSING" }));
    process.exit(1);
  }

  const [active, removed, clubs, managers, gov, convCount] = await Promise.all([
    restSelect(
      url,
      serviceKey,
      "club_members",
      "select=id,club_id,user_id,membership_type,status,tenant_id&status=eq.active&limit=200"
    ),
    restSelect(
      url,
      serviceKey,
      "club_members",
      "select=id,club_id,user_id,membership_type,status,tenant_id&status=eq.removed&limit=50"
    ),
    restSelect(
      url,
      serviceKey,
      "clubs",
      "select=id,name,tenant_id,status&limit=50"
    ),
    restSelect(url, serviceKey, "club_managers", "select=*&limit=5"),
    restSelect(
      url,
      serviceKey,
      "club_governance_assignments",
      "select=club_id,role_code,status,club_member_id&status=eq.active&limit=30"
    ),
    restSelect(
      url,
      serviceKey,
      "communication_conversations",
      "select=conversation_id&limit=1"
    ),
  ]);

  const plan = pickPlan(active.rows, removed.rows, clubs.rows);

  const payload = {
    phase: "COMMS-ACT-04",
    mode: "fixture-discover-readonly",
    target: { projectRef, productionBlocked: true },
    mutationCount: 0,
    inventory: {
      communicationConversations: convCount.total,
      activeMembers: active.total,
      removedMembers: removed.total,
      clubs: clubs.total,
      clubManagers: managers.ok ? managers.total : null,
      clubManagersQueryOk: managers.ok,
      governanceActive: gov.ok ? gov.total : null,
      governanceQueryOk: gov.ok,
      governanceRoles: [
        ...new Set((gov.rows || []).map((r) => r.role_code).filter(Boolean)),
      ],
      membershipTypes: [
        ...new Set(
          [...active.rows, ...removed.rows]
            .map((m) => m.membership_type)
            .filter(Boolean)
        ),
      ],
    },
    plan,
    managerOwnerPredicate: {
      helper: "phase42_active_club_member_id(text)",
      checks: ["club_members.club_id", "club_members.user_id = auth.uid()", "status = active"],
      roleAware: false,
      membershipTypeAware: false,
      structuralEquivalenceWithRegularActiveMember: true,
    },
    secretsPrinted: false,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(plan.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      verdict: "FIXTURE_DISCOVER_FAILED",
      error: String(err?.message || err),
    })
  );
  process.exit(1);
});
