#!/usr/bin/env node
/**
 * STAGING-ONLY verify for CLB TEST TT32 + local 8-team MLP formation checks.
 *
 * Usage:
 *   npm run verify:tt-v6-tt32-staging
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  TT_V6_TT32_STAGING_REF,
  TT_V6_TT32_PRODUCTION_REF,
  TT_V6_TT32_FIXTURE,
  TT_V6_TT32_ATHLETES,
} from "../src/features/team-tournament/fixtures/ttV6Tt32StagingFixture.js";
import {
  listAvailableAthletes,
  TEAM_TOURNAMENT_ATHLETE_SCOPE,
  applyTeamTournamentAthletePostFilters,
} from "../src/features/team-tournament/services/teamTournamentAthletePoolService.js";
import { runTeamFormationWithCanonicalAdapter } from "../src/features/competition-core/formation/adapters/teamFormationAdapter.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import { getPlayerGenderKey } from "../src/models/player.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../docs/v5/qa-evidence/tt-v6-tt32-fixture");

function assertStaging(url) {
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === TT_V6_TT32_PRODUCTION_REF) throw new Error("REFUSING Production verify.");
  if (ref !== TT_V6_TT32_STAGING_REF) throw new Error(`Unexpected ref ${ref}`);
  return ref;
}

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

async function main() {
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();
  if (!url || !serviceKey) throw new Error("Missing staging service env");
  const ref = assertStaging(url);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  const { data: club } = await admin
    .from("clubs")
    .select("id,name,status,description")
    .eq("id", TT_V6_TT32_FIXTURE.clubId)
    .maybeSingle();
  results.push(check("club is CLB TEST TT32", club?.name === TT_V6_TT32_FIXTURE.clubName, club));
  results.push(
    check("club marker present", String(club?.description || "").includes(TT_V6_TT32_FIXTURE.marker), club?.description)
  );

  const { data: members } = await admin
    .from("club_members")
    .select("id,user_id,athlete_id,status")
    .eq("club_id", TT_V6_TT32_FIXTURE.clubId)
    .eq("status", "active");
  const active = members || [];
  results.push(check("exactly 32 active members", active.length === 32, { count: active.length }));
  results.push(check("all members linked to athlete_id", active.every((m) => m.athlete_id), null));

  const athleteIds = active.map((m) => m.athlete_id).filter(Boolean);
  const { data: athletes } = athleteIds.length
    ? await admin.from("athletes").select("id,user_id,display_name,status,phone").in("id", athleteIds)
    : { data: [] };
  results.push(
    check(
      "all athletes active",
      (athletes || []).length === 32 && (athletes || []).every((a) => a.status === "active"),
      { count: (athletes || []).length }
    )
  );

  const userIds = active.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id,gender,email,display_name").in("id", userIds)
    : { data: [] };
  const males = (profiles || []).filter((p) => ["male", "nam", "m"].includes(String(p.gender).toLowerCase()));
  const females = (profiles || []).filter((p) =>
    ["female", "nữ", "nu", "f"].includes(String(p.gender).toLowerCase())
  );
  results.push(check("16 male profiles", males.length === 16, { males: males.length }));
  results.push(check("16 female profiles", females.length === 16, { females: females.length }));
  results.push(
    check(
      "emails are @staging.local",
      (profiles || []).every((p) => String(p.email || "").endsWith("@staging.local")),
      null
    )
  );

  const { data: ratings } = userIds.length
    ? await admin
        .from("pick_vn_player_ratings")
        .select("auth_user_id,current_rating")
        .in("auth_user_id", userIds)
    : { data: [] };
  results.push(check("32 Pick_VN ratings present", (ratings || []).length >= 32, { count: (ratings || []).length }));

  const pool = await listAvailableAthletes({
    clubId: TT_V6_TT32_FIXTURE.clubId,
    tenantId: TT_V6_TT32_FIXTURE.tenantId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
    callerName: "verify-tt-v6-tt32-staging-fixture",
    deps: {
      listMembers: async () => {
        const { data, error } = await admin
          .from("club_members")
          .select("id,user_id,athlete_id,status,tenant_id,club_id")
          .eq("club_id", TT_V6_TT32_FIXTURE.clubId);
        if (error) return { ok: false, error: error.message };
        return { ok: true, members: data || [] };
      },
      fetchProfiles: async (ids) => {
        const { data, error } = await admin
          .from("profiles")
          .select("id,gender,display_name,email,player_id")
          .in("id", ids);
        if (error) return { ok: false, error: error.message };
        return { ok: true, profiles: data || [] };
      },
      fetchAthletes: async (ids) => {
        const { data, error } = await admin
          .from("athletes")
          .select("id,user_id,display_name,status,phone")
          .in("id", ids);
        if (error) return { ok: false, error: error.message };
        return { ok: true, athletes: data || [] };
      },
      fetchRatings: async (ids) => {
        const { data, error } = await admin
          .from("pick_vn_player_ratings")
          .select("auth_user_id,current_rating")
          .in("auth_user_id", ids);
        if (error) return { ok: false, error: error.message };
        return { ok: true, ratings: data || [] };
      },
    },
  });

  const eligible = pool.athletes || [];
  results.push(check("pool ok", pool.ok !== false, { code: pool.code, count: eligible.length }));
  results.push(check("eligible pool is 32", eligible.length === 32, { count: eligible.length }));

  const formation = runTeamFormationWithCanonicalAdapter({
    players: eligible,
    selectedPlayerIds: eligible.map((a) => a.id),
    teamCount: 8,
    formatPreset: FORMAT_PRESET.MLP_4,
    randomFn: () => 0.42,
    envSource: { VITE_ENABLE_CANONICAL_FORMATION_RUNTIME: "false" },
  });
  const teams = formation.teams || [];
  const waiting = formation.waitingPlayerIds || [];
  results.push(check("MLP yields 8 teams", teams.length === 8, { teamCount: teams.length }));
  results.push(check("waiting list empty", waiting.length === 0, { waiting: waiting.length }));

  const rosterIds = [];
  let genderBalanced = teams.length === 8;
  for (const team of teams) {
    const ids = team.playerIds || team.players?.map((p) => p.id) || [];
    if (ids.length !== 4) genderBalanced = false;
    for (const id of ids) rosterIds.push(String(id));
    const members = ids.map((id) => eligible.find((a) => String(a.id) === String(id))).filter(Boolean);
    const m = members.filter((a) => getPlayerGenderKey(a.gender) === "male").length;
    const f = members.filter((a) => getPlayerGenderKey(a.gender) === "female").length;
    if (m !== 2 || f !== 2) genderBalanced = false;
  }
  results.push(check("each team 2M+2F / 4 athletes", genderBalanced, null));
  results.push(
    check("no duplicate athletes across teams", new Set(rosterIds).size === rosterIds.length, {
      unique: new Set(rosterIds).size,
      total: rosterIds.length,
    })
  );

  // Keep post-filter import exercised for assigned-athlete removal.
  const oneId = eligible[0]?.id;
  const afterAssign = applyTeamTournamentAthletePostFilters(eligible, {
    assignedAthleteIds: oneId ? [oneId] : [],
  });
  results.push(
    check(
      "selecting one removes only that athlete",
      !oneId ||
        ((afterAssign.athletes || afterAssign).length === eligible.length - 1 &&
          !(afterAssign.athletes || afterAssign).some((a) => String(a.id) === String(oneId))),
      { remaining: (afterAssign.athletes || afterAssign).length }
    )
  );

  const failed = results.filter((r) => !r.ok);
  const report = {
    ok: failed.length === 0,
    stagingRef: ref,
    fixture: TT_V6_TT32_FIXTURE.clubId,
    expectedAthletes: TT_V6_TT32_ATHLETES.length,
    results,
    failed,
    verifiedAt: new Date().toISOString(),
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "STAGING_TT32_FIXTURE_VERIFY_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, failed: failed.length, checks: results.length }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
