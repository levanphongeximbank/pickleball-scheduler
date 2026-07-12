/**
 * TT-1B — Migrate team tournament blob → Supabase (dry-run default).
 *
 * Usage:
 *   node scripts/migrate-team-tournament-blob-to-cloud.mjs --dry-run --club-id=X --tournament-id=Y
 *   node scripts/migrate-team-tournament-blob-to-cloud.mjs --club-id=X --tenant-id=Z
 *
 * Reuses Phase 23D seed core. Does NOT auto-resolve blob/cloud conflicts.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, getSupabaseEnv } from "./load-env.mjs";
import {
  createSeedStats,
  extractTeamTournamentsFromClubBlob,
  extractTeamTournamentsFromJson,
  loadTeamTournamentsFromClubDataV3,
  seedTeamTournamentRecord,
  summarizeSeedStats,
} from "./lib/team-tournament-seed-core.mjs";
import { compareTeamTournamentSnapshots } from "../src/features/team-tournament/repositories/teamTournamentCompare.js";
import { readFileSync } from "node:fs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run") || argv.includes("--plan-only");
  const tournamentIdArg = argv.find((a) => a.startsWith("--tournament-id="));
  const clubIdArg = argv.find((a) => a.startsWith("--club-id="));
  const tenantIdArg = argv.find((a) => a.startsWith("--tenant-id="));
  const blobPathArg = argv.find((a) => a.startsWith("--blob-path="));
  return {
    dryRun,
    tournamentId: tournamentIdArg ? tournamentIdArg.split("=")[1] : "",
    clubId: clubIdArg ? clubIdArg.split("=")[1] : "",
    tenantId: tenantIdArg ? tenantIdArg.split("=")[1] : "",
    blobPath: blobPathArg ? blobPathArg.split("=")[1] : "",
  };
}

function createAdminClient() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    throw new Error("Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  }
  if (String(url).includes(PRODUCTION_REF)) {
    throw new Error("TT-1B: script migrate bị chặn trên Production ref.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchCloudSetup(client, tournamentId) {
  const { data, error } = await client.rpc("team_tournament_get_setup", {
    p_tournament_id: String(tournamentId),
    p_viewer_team_id: null,
  });
  if (error) {
    return { ok: false, code: "RPC_ERROR", error: error.message };
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stats = {
    read: 0,
    valid: 0,
    migrated: 0,
    skippedDuplicate: 0,
    conflicts: 0,
    errors: 0,
    conflictReports: [],
    errorReports: [],
  };

  let tournaments = [];

  if (args.blobPath) {
    const raw = JSON.parse(readFileSync(path.resolve(args.blobPath), "utf8"));
    tournaments = extractTeamTournamentsFromJson(raw);
  } else if (args.clubId) {
    const client = createAdminClient();
    tournaments = await loadTeamTournamentsFromClubDataV3(client, args.clubId);
  } else {
    throw new Error("Cần --club-id= hoặc --blob-path=");
  }

  if (args.tournamentId) {
    tournaments = tournaments.filter((t) => String(t.id) === String(args.tournamentId));
  }

  stats.read = tournaments.length;
  const client = args.dryRun ? null : createAdminClient();
  const seedStats = createSeedStats();

  for (const tournament of tournaments) {
    if (!tournament?.teamData) {
      stats.errors += 1;
      stats.errorReports.push({ tournamentId: tournament?.id, error: "missing teamData" });
      continue;
    }
    stats.valid += 1;

    if (!args.dryRun && client) {
      const cloud = await fetchCloudSetup(client, tournament.id);
      if (cloud?.ok && cloud.tournament?.teamData) {
        const compare = compareTeamTournamentSnapshots(
          tournament.teamData,
          cloud.tournament.teamData
        );
        if (!compare.ok) {
          stats.conflicts += 1;
          stats.conflictReports.push({
            tournamentId: tournament.id,
            mismatches: compare.mismatches,
          });
          continue;
        }
        stats.skippedDuplicate += 1;
        continue;
      }
    }

    if (args.dryRun) {
      stats.migrated += 1;
      continue;
    }

    try {
      const result = await seedTeamTournamentRecord(client, tournament, {
        tenantIdOverride: args.tenantId || tournament.tenantId,
        stats: seedStats,
      });
      if (result?.skipped) {
        stats.skippedDuplicate += 1;
      } else {
        stats.migrated += 1;
      }
    } catch (error) {
      stats.errors += 1;
      stats.errorReports.push({
        tournamentId: tournament.id,
        error: error.message,
      });
    }
  }

  const report = {
    phase: "TT-1B",
    dryRun: args.dryRun,
    stats,
    seedStats: summarizeSeedStats(seedStats),
    generatedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(stats.errors > 0 ? 2 : stats.conflicts > 0 ? 3 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
