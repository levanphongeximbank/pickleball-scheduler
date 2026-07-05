/**
 * Phase 23E — Production blob inventory (read-only).
 *
 * Liệt kê giải team_tournament trong club_data_v3 + rows cloud hiện có.
 *
 * Usage:
 *   node scripts/inventory-team-tournament-production.mjs
 *
 * Env (.env.local) — Production:
 *   VITE_SUPABASE_URL=https://expuvcohlcjzvrrauvud.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...   (service role Production — không commit)
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  extractTeamTournamentsFromClubBlob,
  isTeamTournamentRecord,
} from "./lib/team-tournament-seed-core.mjs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

function assertProductionUrl(url) {
  if (!String(url || "").includes(PRODUCTION_REF)) {
    fail(
      `URL không phải Production ${PRODUCTION_REF}. Đặt VITE_SUPABASE_URL Production trong .env.local (tạm) hoặc chạy SQL trong docs/v5/PHASE_23E_PRODUCTION_BLOB_INVENTORY.sql`
    );
  }
}

async function main() {
  console.log("=== Phase 23E — Production Team Tournament Blob Inventory ===\n");

  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !serviceKey) {
    fail("Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  }
  assertProductionUrl(url);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: clubRows, error: clubError } = await admin
    .from("club_data_v3")
    .select("club_id, venue_id, updated_at, data");

  if (clubError) {
    fail(`club_data_v3 read failed: ${clubError.message}`);
  }

  const findings = [];
  for (const row of clubRows || []) {
    const tournaments = extractTeamTournamentsFromClubBlob(row);
    for (const tournament of tournaments) {
      if (!isTeamTournamentRecord(tournament)) {
        continue;
      }
      findings.push({
        club_id: row.club_id,
        venue_id: row.venue_id || tournament.tenantId || "",
        tournament_id: tournament.id,
        name: tournament.name || "",
        status: tournament.status || "",
        teams: (tournament.teamData?.teams || []).length,
        matchups: (tournament.teamData?.matchups || []).length,
        updated_at: row.updated_at,
      });
    }
  }

  const { count: cloudCount, error: cloudError } = await admin
    .from("team_tournaments")
    .select("id", { count: "exact", head: true });

  if (cloudError) {
    fail(`team_tournaments count failed: ${cloudError.message}`);
  }

  console.log("--- club_data_v3 (blob) team_tournament ---\n");
  if (findings.length === 0) {
    ok("Không có giải team_tournament trong club_data_v3 — **không cần migrate**");
  } else {
    info(`Tìm thấy ${findings.length} giải cần review:`);
    for (const row of findings) {
      console.log(
        `  • club=${row.club_id} venue=${row.venue_id} id=${row.tournament_id} ` +
          `name="${row.name}" status=${row.status} teams=${row.teams} matchups=${row.matchups}`
      );
    }
  }

  console.log("\n--- team_tournaments (cloud) ---\n");
  info(`Rows hiện có trên cloud: ${cloudCount ?? 0}`);
  if ((cloudCount ?? 0) === 0 && findings.length === 0) {
    ok("Verdict: SKIP migration — bật flag Production khi owner GO (giải mới sync qua RPC)");
  } else if (findings.length > 0 && (cloudCount ?? 0) === 0) {
    info("Verdict: CẦN migrate blob → cloud trước khi bật VITE_TEAM_TOURNAMENT_SUPABASE=true");
  } else if (findings.length > 0 && (cloudCount ?? 0) > 0) {
    info("Verdict: REVIEW — có cả blob và cloud; so khớp tournament_id trước GO");
  } else {
    ok("Verdict: Cloud có data, blob không có team_tournament — OK nếu đã migrate trước đó");
  }

  console.log("\n--- Summary ---\n");
  console.log(`blob_team_tournaments=${findings.length}`);
  console.log(`cloud_team_tournaments=${cloudCount ?? 0}`);
  console.log(`migrate_required=${findings.length > 0 && (cloudCount ?? 0) < findings.length ? "yes" : "no"}`);
}

main().catch((error) => fail(error?.message || String(error)));
