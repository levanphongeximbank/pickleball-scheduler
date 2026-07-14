/**
 * Staging-only Phase 42N data backfill via service role (PostgREST).
 * Does NOT create DDL/RPC — those require SQL Editor if MCP apply is unavailable.
 * Safe: no Production, no profiles.club_id, no club_data_v3, no Pick_VN writes.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    out[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const candidateEnvPaths = [
  join(scriptDir, "../.env.staging-qa.local"),
  join(scriptDir, "../../pickleball-scheduler/.env.staging-qa.local"),
  "c:/Users/Le Phong/pickleball-scheduler/.env.staging-qa.local",
];
const env = candidateEnvPaths.reduce((acc, p) => ({ ...acc, ...loadEnv(p) }), {});
const url = process.env.STAGING_SUPABASE_URL || env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing staging URL or service role");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
if (ref !== "qyewbxjsiiyufanzcjcq") {
  console.error("Refusing to run: expected staging ref, got", ref);
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function displayName(profile, userId) {
  return (
    String(profile?.display_name || "").trim() ||
    String(profile?.email || "").trim() ||
    String(userId)
  );
}

const { data: targets, error: tErr } = await sb
  .from("club_members")
  .select("id,user_id,tenant_id,club_id,athlete_id,status")
  .eq("status", "active")
  .is("athlete_id", null);
if (tErr) throw tErr;

const userIds = [...new Set((targets || []).map((r) => r.user_id))];
console.log(
  JSON.stringify(
    {
      phase: "pre",
      ref,
      memberships_to_link: (targets || []).length,
      distinct_users: userIds.length,
    },
    null,
    2
  )
);

const athleteByUser = new Map();
const { data: existingAthletes } = await sb
  .from("athletes")
  .select("id,user_id")
  .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
for (const a of existingAthletes || []) {
  if (a.user_id && !athleteByUser.has(a.user_id)) athleteByUser.set(a.user_id, a.id);
}

let created = 0;
for (const userId of userIds) {
  if (athleteByUser.has(userId)) continue;
  const { data: profile } = await sb
    .from("profiles")
    .select("id,display_name,email,venue_id")
    .eq("id", userId)
    .maybeSingle();
  const member = (targets || []).find((t) => t.user_id === userId);
  const tenantId = member?.tenant_id || profile?.venue_id;
  if (!tenantId) {
    console.error("skip user missing tenant", userId);
    continue;
  }
  const { data: inserted, error } = await sb
    .from("athletes")
    .insert({
      tenant_id: tenantId,
      display_name: displayName(profile, userId),
      user_id: userId,
      status: "active",
      version: 1,
    })
    .select("id,user_id")
    .single();
  if (error) {
    // race / unique: fetch again
    const { data: again } = await sb
      .from("athletes")
      .select("id,user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (again?.id) {
      athleteByUser.set(userId, again.id);
      continue;
    }
    throw error;
  }
  athleteByUser.set(userId, inserted.id);
  created += 1;
}

let linked = 0;
for (const row of targets || []) {
  const athleteId = athleteByUser.get(row.user_id);
  if (!athleteId) continue;
  const { error } = await sb
    .from("club_members")
    .update({ athlete_id: athleteId, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("athlete_id", null);
  if (error) throw error;
  linked += 1;
}

const { count: nullAfter } = await sb
  .from("club_members")
  .select("id", { count: "exact", head: true })
  .eq("status", "active")
  .is("athlete_id", null);
const { count: athletesAfter } = await sb.from("athletes").select("id", { count: "exact", head: true });
const { count: withAth } = await sb
  .from("club_members")
  .select("id", { count: "exact", head: true })
  .eq("status", "active")
  .not("athlete_id", "is", null);

// Idempotency second pass
const { data: stillNull } = await sb
  .from("club_members")
  .select("id")
  .eq("status", "active")
  .is("athlete_id", null);
const secondPassTargets = stillNull?.length || 0;

console.log(
  JSON.stringify(
    {
      phase: "post",
      athletes_created: created,
      memberships_linked: linked,
      athletes_after: athletesAfter,
      active_with_athlete: withAth,
      remaining_null_athlete: nullAfter,
      second_pass_remaining: secondPassTargets,
      club_data_v3_untouched: true,
    },
    null,
    2
  )
);
