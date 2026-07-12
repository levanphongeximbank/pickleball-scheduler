/**
 * TT-1C — Mirror live cloud tournament aggregate into club_data_v3 (staging only).
 * Used before shadow compare so blob side matches cloud SSOT.
 *
 * Usage:
 *   node scripts/sync-staging-blob-mirror-from-cloud.mjs --club-id=CLUB --tournament-id=ID
 *
 * STAGING ONLY: qyewbxjsiiyufanzcjcq
 */
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import { TEAM_TOURNAMENT_MODE } from "./lib/team-tournament-seed-core.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";

function parseArgs(argv) {
  const get = (prefix) => argv.find((a) => a.startsWith(prefix))?.split("=")[1] || "";
  return {
    clubId: get("--club-id="),
    tournamentId: get("--tournament-id="),
    btcEmail: get("--btc-email=") || process.env.STAGING_BTC_EMAIL || "owner@staging.local",
    dryRun: argv.includes("--dry-run"),
  };
}

async function main() {
  loadProjectEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!args.clubId || !args.tournamentId) {
    console.error("Thiếu --club-id= và --tournament-id=");
    process.exit(1);
  }

  const env = getStagingSupabaseEnv();
  if (!env.url.includes(STAGING_REF) || !env.serviceKey) {
    throw new Error("Staging URL/service role required (STAGING_SUPABASE_* in .env.staging-qa.local)");
  }

  const signIn = await signInStagingUser(args.btcEmail);
  if (!signIn.client) {
    console.error(JSON.stringify({ ok: false, code: "BLOCKED", error: signIn.error }));
    process.exit(2);
  }

  const { data, error } = await signIn.client.rpc("team_tournament_get_setup", {
    p_tournament_id: args.tournamentId,
    p_viewer_team_id: null,
  });

  if (error || !data?.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        code: "cloud_read_error",
        error: error?.message || data?.error || data?.code,
      })
    );
    process.exit(2);
  }

  const tournament = data.tournament;
  if (!tournament?.teamData) {
    console.error(JSON.stringify({ ok: false, code: "cloud_read_error", error: "empty teamData" }));
    process.exit(2);
  }

  const shell = {
    id: args.tournamentId,
    clubId: args.clubId,
    tenantId: tournament.tenantId || tournament.clubId,
    mode: TEAM_TOURNAMENT_MODE,
    status: tournament.status || "ready",
    version: tournament.version ?? 1,
    teamData: tournament.teamData,
    _cloudMirrorAt: new Date().toISOString(),
  };

  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, tournamentId: args.tournamentId, clubId: args.clubId }));
    process.exit(0);
  }

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: readErr } = await admin
    .from("club_data_v3")
    .select("club_id, venue_id, data, version")
    .eq("club_id", args.clubId)
    .maybeSingle();

  if (readErr) {
    console.error(JSON.stringify({ ok: false, code: "blob_read_error", error: readErr.message }));
    process.exit(2);
  }

  const baseData =
    existing?.data && typeof existing.data === "object" ? { ...existing.data } : { tournaments: [] };
  const tournaments = Array.isArray(baseData.tournaments) ? [...baseData.tournaments] : [];
  const index = tournaments.findIndex((t) => String(t.id) === String(args.tournamentId));

  if (index >= 0) {
    tournaments[index] = { ...tournaments[index], ...shell };
  } else {
    tournaments.push(shell);
  }

  baseData.tournaments = tournaments;

  const row = {
    club_id: args.clubId,
    venue_id: existing?.venue_id || shell.tenantId || null,
    data: baseData,
    synced_at: new Date().toISOString(),
    version: (existing?.version ?? 0) + 1,
  };

  const { error: upsertErr } = existing
    ? await admin.from("club_data_v3").update(row).eq("club_id", args.clubId)
    : await admin.from("club_data_v3").insert(row);

  if (upsertErr) {
    console.error(JSON.stringify({ ok: false, code: "blob_write_error", error: upsertErr.message }));
    process.exit(2);
  }

  console.log(
    JSON.stringify({
      ok: true,
      clubId: args.clubId,
      tournamentId: args.tournamentId,
      action: existing ? "updated" : "inserted",
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
