/**
 * Phase TT-2C — Seed gender data for staging probe players (validation tests only).
 *
 * Strategy:
 * 1. Update profiles.gender where player_id exists
 * 2. Merge gender into club_data_v3.data.players fallback (server gender SoT path #2)
 *
 * Usage:
 *   node scripts/prep-tt2c-staging-player-genders.mjs
 *   node scripts/prep-tt2c-staging-player-genders.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const CLUB_ID = "club-staging-demo";

const GENDER_BY_PLAYER = Object.freeze({
  "player-staging-a-1": "Nam",
  "player-staging-a-3": "Nam",
  "player-staging-a-6": "Nam",
  "player-staging-a-7": "Nam",
  "player-staging-b-1": "Nam",
  "player-staging-b-3": "Nam",
  "player-staging-b-6": "Nam",
  "player-staging-b-7": "Nam",
  "player-staging-a-2": "Nữ",
  "player-staging-a-4": "Nữ",
  "player-staging-a-5": "Nữ",
  "player-staging-a-8": "Nữ",
  "player-staging-b-2": "Nữ",
  "player-staging-b-4": "Nữ",
  "player-staging-b-5": "Nữ",
  "player-staging-b-8": "Nữ",
});

function buildClubPlayersFallback(existingPlayers = []) {
  const byId = new Map(
    (Array.isArray(existingPlayers) ? existingPlayers : []).map((player) => [
      String(player.id),
      player,
    ])
  );

  for (const [playerId, gender] of Object.entries(GENDER_BY_PLAYER)) {
    const current = byId.get(playerId) || { id: playerId, name: playerId };
    byId.set(playerId, { ...current, id: playerId, gender });
  }

  return [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();

  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging URL (expected ${STAGING_REF})`);
  }
  if (!serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let profileUpdates = 0;
  for (const [playerId, gender] of Object.entries(GENDER_BY_PLAYER)) {
    if (dryRun) {
      console.log(`[dry-run] profile ${playerId} => ${gender}`);
      profileUpdates += 1;
      continue;
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ gender })
      .eq("player_id", playerId)
      .select("player_id, gender");

    if (error) {
      console.error(`❌ profile ${playerId}: ${error.message}`);
      continue;
    }

    if (data?.length) {
      profileUpdates += 1;
      console.log(`✅ profile ${playerId} => ${gender}`);
    }
  }

  const { data: clubRow, error: clubReadError } = await admin
    .from("club_data_v3")
    .select("club_id, data")
    .eq("club_id", CLUB_ID)
    .maybeSingle();

  if (clubReadError) {
    throw new Error(clubReadError.message);
  }

  const mergedPlayers = buildClubPlayersFallback(clubRow?.data?.players);
  const nextData = {
    ...(clubRow?.data && typeof clubRow.data === "object" ? clubRow.data : {}),
    players: mergedPlayers,
  };

  if (dryRun) {
    console.log(`[dry-run] club_data_v3.players => ${mergedPlayers.length} entries`);
  } else if (clubRow?.club_id) {
    const { error: clubWriteError } = await admin
      .from("club_data_v3")
      .update({ data: nextData })
      .eq("club_id", CLUB_ID);

    if (clubWriteError) {
      throw new Error(clubWriteError.message);
    }
    console.log(`✅ club_data_v3.players fallback => ${mergedPlayers.length} entries`);
  } else {
    console.warn(`⚠️  club_data_v3 row missing for ${CLUB_ID}`);
  }

  const { data: probeGender, error: probeError } = await admin.rpc(
    "team_tournament_resolve_player_gender_key",
    {
      p_player_id: "player-staging-a-4",
      p_tenant_id: "venue-staging-a",
      p_club_id: CLUB_ID,
    }
  );

  if (probeError) {
    console.warn(`⚠️  gender probe failed: ${probeError.message}`);
  } else {
    console.log(`✅ probe player-staging-a-4 gender => ${probeGender}`);
  }

  console.log(
    `\nDone: ${profileUpdates}/${Object.keys(GENDER_BY_PLAYER).length} profile rows updated; club fallback ${mergedPlayers.length} players.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
