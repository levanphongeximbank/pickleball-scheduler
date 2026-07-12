/**

 * Staging-only: align QA accounts for TT-1C Preview UI smoke.

 * - player_id for captain resolution

 * - club_members in probe club (V2 membership SoT)

 * - team_member.view for captains (route /team-portal)

 * - team tournament captain assignment audit

 *

 * STAGING: qyewbxjsiiyufanzcjcq — never production.

 */

import { createClient } from "@supabase/supabase-js";

import { randomUUID } from "node:crypto";

import fs from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";

import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";



const STAGING_REF = "qyewbxjsiiyufanzcjcq";

const PROBE_CLUB_ID = "club-staging-demo";

const PROBE_TENANT_ID = "venue-staging-a";

const PROBE_TOURNAMENT_ID = "phase23d-probe-tournament";



const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const reportPath = path.join(rootDir, "docs/v5/qa-evidence/phase-tt1c/PREP_CAPTAIN_PROFILES_REPORT.json");



const CAPTAIN_LINKS = [

  {

    email: process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local",

    playerId: "player-staging-a-1",

    teamId: "phase23d-team-a",

  },

  {

    email: process.env.STAGING_CAPTAIN_B_EMAIL || "club@staging.local",

    playerId: "player-staging-b-1",

    teamId: "phase23d-team-b",

  },

];



const MEMBER_EMAILS = [

  process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local",

  process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local",

  process.env.STAGING_CAPTAIN_B_EMAIL || "club@staging.local",

  process.env.STAGING_REFEREE_EMAIL || "manager@staging.local",

];



function assertStagingOnly(url) {

  if (!url.includes(STAGING_REF)) {

    throw new Error(`Refusing non-staging Supabase URL: ${url}`);

  }

  if (/supabase\.co\/project\/[a-z0-9]+/.test(url) && !url.includes(STAGING_REF)) {

    throw new Error("Production ref detected — aborting");

  }

}



async function ensurePermission(admin, permissionId, module, action, description) {

  const { error } = await admin.from("permissions").upsert(

    {

      id: permissionId,

      module,

      action,

      description,

    },

    { onConflict: "id" }

  );

  if (error && !/duplicate|already exists/i.test(error.message)) {

    throw new Error(`permission ${permissionId}: ${error.message}`);

  }

}



async function ensureRolePermission(admin, roleId, permissionId) {

  const { error } = await admin.from("role_permissions").upsert(

    { role_id: roleId, permission_id: permissionId },

    { onConflict: "role_id,permission_id" }

  );

  if (error && !/duplicate|already exists/i.test(error.message)) {

    throw new Error(`role_permission ${roleId}/${permissionId}: ${error.message}`);

  }

}



async function ensureProbeClub(admin) {

  const { data: existing, error: fetchError } = await admin

    .from("clubs")

    .select("id")

    .eq("id", PROBE_CLUB_ID)

    .maybeSingle();



  if (fetchError) {

    throw new Error(`clubs fetch: ${fetchError.message}`);

  }

  if (existing?.id) {

    return "exists";

  }



  const { error: insertError } = await admin.from("clubs").insert({

    id: PROBE_CLUB_ID,

    tenant_id: PROBE_TENANT_ID,

    name: "CLB Staging Demo (TT probe)",

    code: "STGDEMO",

    description: "Phase 23D / TT-1C team tournament probe club",

    status: "active",

    version: 1,

  });



  if (insertError) {

    throw new Error(`clubs insert: ${insertError.message}`);

  }



  return "inserted";

}



async function ensureClubMember(admin, userId) {

  const { data: existing, error: fetchError } = await admin

    .from("club_members")

    .select("id, status")

    .eq("club_id", PROBE_CLUB_ID)

    .eq("user_id", userId)

    .maybeSingle();



  if (fetchError) {

    throw new Error(`club_members fetch: ${fetchError.message}`);

  }



  if (existing?.status === "active") {

    return { userId, action: "skip" };

  }



  if (existing?.id) {

    const { error: updateError } = await admin

      .from("club_members")

      .update({ status: "active", left_at: null, updated_at: new Date().toISOString() })

      .eq("id", existing.id);

    if (updateError) {

      throw new Error(`club_members update: ${updateError.message}`);

    }

    return { userId, action: "reactivated" };

  }



  const { error: insertError } = await admin.from("club_members").insert({

    id: randomUUID(),

    tenant_id: PROBE_TENANT_ID,

    club_id: PROBE_CLUB_ID,

    user_id: userId,

    membership_type: "regular",

    status: "active",

    joined_at: new Date().toISOString(),

    version: 1,

  });



  if (insertError) {

    throw new Error(`club_members insert: ${insertError.message}`);

  }



  return { userId, action: "inserted" };

}



async function fetchCaptainAudit(admin, email) {

  const normalized = String(email).trim().toLowerCase();

  const { data: profile, error: profileError } = await admin

    .from("profiles")

    .select("id, email, role, player_id, club_id, venue_id, status")

    .eq("email", normalized)

    .maybeSingle();



  if (profileError) {

    throw new Error(`profile audit ${normalized}: ${profileError.message}`);

  }



  let clubMember = null;

  if (profile?.id) {

    const { data, error } = await admin

      .from("club_members")

      .select("id, club_id, status, membership_type")

      .eq("user_id", profile.id)

      .eq("club_id", PROBE_CLUB_ID)

      .maybeSingle();

    if (error) {

      throw new Error(`club_members audit ${normalized}: ${error.message}`);

    }

    clubMember = data;

  }



  const link = CAPTAIN_LINKS.find((item) => item.email.toLowerCase() === normalized);

  let team = null;

  let teamMember = null;



  if (link?.teamId) {

    const { data: tt, error: ttError } = await admin

      .from("team_tournaments")

      .select("id, tournament_id, club_id, tenant_id")

      .eq("tournament_id", PROBE_TOURNAMENT_ID)

      .maybeSingle();

    if (ttError) {

      throw new Error(`team_tournaments audit: ${ttError.message}`);

    }



    if (tt?.id) {

      const { data: teamRow, error: teamError } = await admin

        .from("team_tournament_teams")

        .select("id, external_team_id, name, captain_player_id, tenant_id, tournament_id")

        .eq("team_tournament_id", tt.id)

        .eq("external_team_id", link.teamId)

        .maybeSingle();

      if (teamError) {

        throw new Error(`team audit ${link.teamId}: ${teamError.message}`);

      }

      team = teamRow;



      if (teamRow?.id && profile?.player_id) {

        const { data: memberRow, error: memberError } = await admin

          .from("team_tournament_team_members")

          .select("id, player_id, role")

          .eq("team_id", teamRow.id)

          .eq("player_id", profile.player_id)

          .maybeSingle();

        if (memberError) {

          throw new Error(`team member audit: ${memberError.message}`);

        }

        teamMember = memberRow;

      }

    }

  }



  return {

    email: normalized,

    profile,

    clubMember,

    team,

    teamMember,

    expectedPlayerId: link?.playerId || null,

    expectedTeamId: link?.teamId || null,

  };

}



async function main() {

  loadProjectEnv();

  const env = getStagingSupabaseEnv();

  assertStagingOnly(env.url);

  if (!env.serviceKey) {

    throw new Error("Staging service role required");

  }



  const admin = createClient(env.url, env.serviceKey, {

    auth: { persistSession: false, autoRefreshToken: false },

  });



  const before = {

    generatedAt: new Date().toISOString(),

    captains: [],

  };

  for (const link of CAPTAIN_LINKS) {

    before.captains.push(await fetchCaptainAudit(admin, link.email));

  }



  await ensurePermission(

    admin,

    "team_member.view",

    "team_member",

    "view",

    "Đội trưởng — xem thành viên"

  );

  await ensureRolePermission(admin, "CLUB_OWNER", "team_member.view");

  await ensureRolePermission(admin, "CLUB_OWNER", "team.lineup.submit");

  await ensureRolePermission(admin, "PLAYER", "team_member.view");

  await ensureRolePermission(admin, "PLAYER", "team.view");

  await ensureRolePermission(admin, "PLAYER", "team.lineup.submit");



  const clubAction = await ensureProbeClub(admin);



  const profileResults = [];

  for (const link of CAPTAIN_LINKS) {

    const email = String(link.email).trim().toLowerCase();

    const { data: beforeProfile, error: fetchError } = await admin

      .from("profiles")

      .select("id, email, player_id, venue_id, role, status, club_id")

      .eq("email", email)

      .maybeSingle();



    if (fetchError) {

      throw new Error(`fetch ${email}: ${fetchError.message}`);

    }

    if (!beforeProfile) {

      throw new Error(`profile not found: ${email}`);

    }



    const patch = {

      player_id: link.playerId,

      status: "active",

      updated_at: new Date().toISOString(),

    };

    if (email === (process.env.STAGING_CAPTAIN_B_EMAIL || "club@staging.local").toLowerCase()) {

      patch.role = "PLAYER";

    }

    if (!beforeProfile.venue_id) {

      patch.venue_id = PROBE_TENANT_ID;

    }



    const { data: after, error: updateError } = await admin

      .from("profiles")

      .update(patch)

      .eq("id", beforeProfile.id)

      .select("email, player_id, role, venue_id, club_id, status")

      .single();



    if (updateError) {

      throw new Error(`update ${email}: ${updateError.message}`);

    }



    profileResults.push({

      email,

      before: beforeProfile,

      after,

    });

  }



  const memberResults = [];

  for (const email of MEMBER_EMAILS) {

    const normalized = String(email).trim().toLowerCase();

    const { data: profile, error } = await admin

      .from("profiles")

      .select("id, email")

      .eq("email", normalized)

      .maybeSingle();

    if (error) {

      throw new Error(`profile ${normalized}: ${error.message}`);

    }

    if (!profile?.id) {

      throw new Error(`profile missing: ${normalized}`);

    }

    memberResults.push({

      email: normalized,

      ...(await ensureClubMember(admin, profile.id)),

    });

  }



  const after = {

    generatedAt: new Date().toISOString(),

    captains: [],

  };

  for (const link of CAPTAIN_LINKS) {

    after.captains.push(await fetchCaptainAudit(admin, link.email));

  }



  const report = {

    ok: true,

    stagingRef: STAGING_REF,

    clubId: PROBE_CLUB_ID,

    tenantId: PROBE_TENANT_ID,

    tournamentId: PROBE_TOURNAMENT_ID,

    before,

    after,

    profileResults,

    memberResults,

    clubAction,

    checks: after.captains.map((row) => ({

      email: row.email,

      playerIdOk: row.profile?.player_id === row.expectedPlayerId,

      clubMemberActive: row.clubMember?.status === "active",

      captainPlayerIdOk: row.team?.captain_player_id === row.expectedPlayerId,

      teamMemberOk: Boolean(row.teamMember?.id),

      tournamentClubOk: row.team ? true : Boolean(row.expectedTeamId),

    })),

  };



  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);



  console.log(JSON.stringify(report, null, 2));

}



main().catch((error) => {

  console.error(JSON.stringify({ ok: false, error: error.message }));

  process.exit(1);

});


