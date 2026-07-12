/**
 * Staging-only: reset probe matchup to lineup_open for UI mutation smoke.
 * STAGING: qyewbxjsiiyufanzcjcq — never production.
 */
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  matchupId: "phase23d-matchup-1",
};

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  if (!env.url.includes(STAGING_REF) || !env.serviceKey) {
    throw new Error("Staging service role required");
  }

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: header } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();

  if (!header?.id) {
    console.error(JSON.stringify({ ok: false, error: "tournament not found" }));
    process.exit(2);
  }

  const { data: matchup } = await admin
    .from("team_tournament_matchups")
    .select("id, status")
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", PROBE.matchupId)
    .maybeSingle();

  if (!matchup?.id) {
    console.error(JSON.stringify({ ok: false, error: "matchup not found" }));
    process.exit(2);
  }

  const lockAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { error: mErr } = await admin
    .from("team_tournament_matchups")
    .update({ status: "lineup_open", lineup_lock_at: lockAt })
    .eq("id", matchup.id);

  if (mErr) {
    console.error(JSON.stringify({ ok: false, error: mErr.message }));
    process.exit(2);
  }

  const { error: lErr } = await admin
    .from("team_tournament_lineups")
    .update({
      status: "draft",
      published_at: null,
      locked_at: null,
    })
    .eq("matchup_id", matchup.id);

  if (lErr) {
    console.error(JSON.stringify({ ok: false, error: lErr.message }));
    process.exit(2);
  }

  console.log(
    JSON.stringify({
      ok: true,
      tournamentId: PROBE.tournamentId,
      matchupId: PROBE.matchupId,
      previousStatus: matchup.status,
      newStatus: "lineup_open",
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
