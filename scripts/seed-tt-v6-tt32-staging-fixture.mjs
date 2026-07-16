#!/usr/bin/env node
/**
 * STAGING-ONLY — seed CLB TEST TT32 + 32 athletes (16M/16F) with Pick_VN ratings.
 *
 * Guards: refuses Production ref; idempotent upserts; secrets from env only.
 *
 * Usage:
 *   npm run seed:tt-v6-tt32-staging
 *   node scripts/seed-tt-v6-tt32-staging-fixture.mjs --dry-run
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
  ttV6Tt32UserId,
  ttV6Tt32AthleteId,
  ttV6Tt32MemberId,
  ttV6Tt32PhoneMarker,
} from "../src/features/team-tournament/fixtures/ttV6Tt32StagingFixture.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../docs/v5/qa-evidence/tt-v6-tt32-fixture");
const dryRun = process.argv.includes("--dry-run");

function assertStaging(url) {
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === TT_V6_TT32_PRODUCTION_REF) {
    throw new Error("REFUSING Production — TT32 fixture is Staging-only.");
  }
  if (ref !== TT_V6_TT32_STAGING_REF) {
    throw new Error(`Refusing unexpected ref ${ref}; expected ${TT_V6_TT32_STAGING_REF}`);
  }
  return ref;
}

async function ensureAuthUser(admin, row, password) {
  const userId = ttV6Tt32UserId(row.n);
  const meta = {
    qa_fixture: true,
    fixture_key: row.key,
    fixture_marker: TT_V6_TT32_FIXTURE.marker,
    bucket: row.bucket,
  };
  const byId = await admin.auth.admin.getUserById(userId);
  if (byId?.data?.user) {
    if (!dryRun) {
      await admin.auth.admin.updateUserById(userId, {
        email: row.email,
        email_confirm: true,
        user_metadata: meta,
      });
    }
    return { userId, created: false };
  }
  if (dryRun) return { userId, created: true, dryRun: true };
  const { data, error } = await admin.auth.admin.createUser({
    id: userId,
    email: row.email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (!error && data?.user) return { userId: data.user.id, created: true };
  const fallback = await admin.auth.admin.createUser({
    email: row.email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (fallback.error) {
    throw new Error(`${row.key} createUser: ${error?.message || fallback.error.message}`);
  }
  return { userId: fallback.data.user.id, created: true };
}

async function upsertProfile(admin, userId, row) {
  const payload = {
    id: userId,
    email: row.email,
    display_name: row.displayName,
    gender: row.gender,
    venue_id: TT_V6_TT32_FIXTURE.tenantId,
    player_id: row.playerId,
    role: "PLAYER",
    updated_at: new Date().toISOString(),
  };
  if (dryRun) return { dryRun: true };
  const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`${row.key} profiles: ${error.message}`);
  return { ok: true };
}

async function upsertAthlete(admin, userId, row) {
  const athleteId = ttV6Tt32AthleteId(row.n);
  const payload = {
    id: athleteId,
    tenant_id: TT_V6_TT32_FIXTURE.tenantId,
    display_name: row.displayName,
    phone: ttV6Tt32PhoneMarker(row),
    user_id: userId,
    status: "active",
    version: 1,
    updated_at: new Date().toISOString(),
  };
  if (dryRun) return { athleteId, dryRun: true };
  const { error } = await admin.from("athletes").upsert(payload, { onConflict: "id" });
  if (error) {
    const { data: existing } = await admin.from("athletes").select("id").eq("user_id", userId).maybeSingle();
    if (existing?.id) {
      const { error: updErr } = await admin
        .from("athletes")
        .update({
          display_name: row.displayName,
          phone: ttV6Tt32PhoneMarker(row),
          status: "active",
          tenant_id: TT_V6_TT32_FIXTURE.tenantId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (updErr) throw new Error(`${row.key} athletes update: ${updErr.message}`);
      return { athleteId: existing.id };
    }
    throw new Error(`${row.key} athletes: ${error.message}`);
  }
  return { athleteId };
}

async function upsertMembership(admin, userId, athleteId, row) {
  const memberId = ttV6Tt32MemberId(row.n);
  const payload = {
    id: memberId,
    tenant_id: TT_V6_TT32_FIXTURE.tenantId,
    club_id: TT_V6_TT32_FIXTURE.clubId,
    user_id: userId,
    athlete_id: athleteId,
    membership_type: "regular",
    status: "active",
    version: 1,
    updated_at: new Date().toISOString(),
  };
  if (dryRun) return { memberId, dryRun: true };
  const { error } = await admin.from("club_members").upsert(payload, { onConflict: "id" });
  if (error) {
    const { data: existing } = await admin
      .from("club_members")
      .select("id")
      .eq("club_id", TT_V6_TT32_FIXTURE.clubId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (existing?.id) {
      const { error: updErr } = await admin
        .from("club_members")
        .update({
          athlete_id: athleteId,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (updErr) throw new Error(`${row.key} club_members update: ${updErr.message}`);
      return { memberId: existing.id };
    }
    throw new Error(`${row.key} club_members: ${error.message}`);
  }
  return { memberId };
}

async function upsertPickVnRating(admin, userId, row) {
  if (dryRun) return { dryRun: true };
  const id = `pvn-qa-tt32-${row.n}`;
  const payload = {
    id,
    auth_user_id: userId,
    self_declared_rating: row.rating,
    provisional_rating: row.rating,
    current_rating: row.rating,
    rating_status: "self_declared",
    rating_confidence: 0,
    rating_match_count: 0,
    last_rating_updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("pick_vn_player_ratings").upsert(payload, { onConflict: "id" });
  if (error) return { ok: false, warning: error.message };
  return { ok: true };
}

async function ensureClub(admin) {
  const payload = {
    id: TT_V6_TT32_FIXTURE.clubId,
    tenant_id: TT_V6_TT32_FIXTURE.tenantId,
    name: TT_V6_TT32_FIXTURE.clubName,
    code: TT_V6_TT32_FIXTURE.clubCode,
    description: TT_V6_TT32_FIXTURE.description,
    status: "active",
    version: 1,
    deleted_at: null,
    updated_at: new Date().toISOString(),
  };
  if (dryRun) return { dryRun: true };
  const { error } = await admin.from("clubs").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`clubs upsert: ${error.message}`);
  return { ok: true };
}

async function main() {
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();
  if (!url || !serviceKey) throw new Error("Missing staging Supabase URL/service role");
  const ref = assertStaging(url);
  const password = process.env.TT_V6_TT32_FIXTURE_PASSWORD || "Tt32Qa!StagingLocalOnly";
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureClub(admin);
  const rows = [];
  for (const athlete of TT_V6_TT32_ATHLETES) {
    const auth = await ensureAuthUser(admin, athlete, password);
    await upsertProfile(admin, auth.userId, athlete);
    const { athleteId } = await upsertAthlete(admin, auth.userId, athlete);
    await upsertMembership(admin, auth.userId, athleteId, athlete);
    const rating = await upsertPickVnRating(admin, auth.userId, athlete);
    rows.push({
      key: athlete.key,
      userId: auth.userId,
      athleteId,
      rating: athlete.rating,
      ratingOk: rating.ok !== false,
      created: auth.created,
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    ok: true,
    dryRun,
    stagingRef: ref,
    clubId: TT_V6_TT32_FIXTURE.clubId,
    clubName: TT_V6_TT32_FIXTURE.clubName,
    marker: TT_V6_TT32_FIXTURE.marker,
    athleteCount: rows.length,
    maleCount: rows.filter((r) => r.key.includes("NAM")).length,
    femaleCount: rows.filter((r) => r.key.includes("NU")).length,
    rows,
    seededAt: new Date().toISOString(),
  };
  writeFileSync(join(OUT_DIR, "STAGING_TT32_FIXTURE_SEED_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, dryRun, athleteCount: rows.length, clubId: TT_V6_TT32_FIXTURE.clubId }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
