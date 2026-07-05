/**
 * Phase 23D — Seed team tournament blob → Supabase cloud tables.
 *
 * Usage:
 *   npm run seed:team-tournament-cloud
 *   npm run seed:team-tournament-cloud:dry-run
 *
 * Env (.env.local):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TEAM_TOURNAMENT_SEED_CLUB_ID=...          (optional — filter club_data_v3)
 *   TEAM_TOURNAMENT_SEED_BLOB_PATH=...        (optional — local JSON export)
 *   TEAM_TOURNAMENT_SEED_TENANT_ID=...        (override tenant when blob thiếu)
 *   TEAM_TOURNAMENT_SEED_DRY_RUN=1            (same as --dry-run)
 *
 * Production (Phase 23E):
 *   --club-id=REAL_CLUB --tenant-id=REAL_VENUE --production-confirm
 *   Không dùng --blob-path fixture trên Production (script chặn).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  createSeedStats,
  extractTeamTournamentsFromJson,
  isMissingTeamTournamentSchemaError,
  loadTeamTournamentsFromClubDataV3,
  seedTeamTournamentRecord,
  summarizeSeedStats,
} from "./lib/team-tournament-seed-core.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const FIXTURE_BLOCK_PATTERNS = [
  "tests/fixtures/",
  "team-tournament-blob-probe",
  "phase23d-probe",
  "phase23d-team",
];

function parseArgs(argv) {
  const dryRun =
    argv.includes("--dry-run") ||
    String(process.env.TEAM_TOURNAMENT_SEED_DRY_RUN || "").trim() === "1";
  const planOnly = argv.includes("--plan-only");
  const productionConfirm = argv.includes("--production-confirm");

  const clubIdArg = argv.find((arg) => arg.startsWith("--club-id="));
  const blobPathArg = argv.find((arg) => arg.startsWith("--blob-path="));
  const tenantIdArg = argv.find((arg) => arg.startsWith("--tenant-id="));

  return {
    dryRun,
    planOnly,
    productionConfirm,
    clubId:
      (clubIdArg ? clubIdArg.split("=")[1] : "") ||
      String(process.env.TEAM_TOURNAMENT_SEED_CLUB_ID || "").trim(),
    blobPath:
      (blobPathArg ? blobPathArg.split("=")[1] : "") ||
      String(process.env.TEAM_TOURNAMENT_SEED_BLOB_PATH || "").trim(),
    tenantId:
      (tenantIdArg ? tenantIdArg.split("=")[1] : "") ||
      String(process.env.TEAM_TOURNAMENT_SEED_TENANT_ID || "").trim(),
  };
}

function createAdminClientOptional() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAdminClient() {
  const client = createAdminClientOptional();
  if (!client) {
    throw new Error(
      "Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local"
    );
  }
  return client;
}

function assertProductionSeedSafety(options = {}) {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const isProduction = String(url || "").includes(PRODUCTION_REF);
  if (!isProduction) {
    return;
  }

  const blobPath = String(options.blobPath || "").toLowerCase();
  if (FIXTURE_BLOCK_PATTERNS.some((pattern) => blobPath.includes(pattern))) {
    throw new Error(
      "Production: không seed fixture/probe data. Xem docs/v5/PHASE_23E_PRODUCTION_BLOB_MIGRATION.md"
    );
  }

  if (!options.dryRun && !options.planOnly && !options.productionConfirm) {
    throw new Error(
      "Production write cần --production-confirm sau dry-run. Xem docs/v5/PHASE_23E_PRODUCTION_BLOB_MIGRATION.md"
    );
  }
}

async function loadTournamentSources(client, options) {
  const tournaments = [];

  if (options.blobPath) {
    const filePath = path.isAbsolute(options.blobPath)
      ? options.blobPath
      : path.join(rootDir, options.blobPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Không tìm thấy blob file: ${filePath}`);
    }
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    tournaments.push(...extractTeamTournamentsFromJson(payload));
  } else {
    tournaments.push(...(await loadTeamTournamentsFromClubDataV3(client, options)));
  }

  return tournaments;
}

export async function runTeamTournamentSeed(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const planOnly = Boolean(options.planOnly);
  const tenantOverride = String(options.tenantId || "").trim();
  const admin = planOnly ? null : options.admin || createAdminClientOptional();

  if (!planOnly && !admin) {
    throw new Error(
      "Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local"
    );
  }

  const tournaments =
    options.tournaments ||
    (planOnly && options.blobPath
      ? extractTeamTournamentsFromJson(
          JSON.parse(
            fs.readFileSync(
              path.isAbsolute(options.blobPath)
                ? options.blobPath
                : path.join(rootDir, options.blobPath),
              "utf8"
            )
          )
        )
      : await loadTournamentSources(admin, options));

  if (tournaments.length === 0) {
    return {
      ok: true,
      dryRun,
      planOnly,
      message: "Không tìm thấy giải team_tournament nào trong nguồn dữ liệu.",
      results: [],
      stats: createSeedStats(),
    };
  }

  const aggregateStats = createSeedStats();
  const results = [];

  for (const tournament of tournaments) {
    const stats = createSeedStats();
    try {
      const result = await seedTeamTournamentRecord(admin, tournament, {
        dryRun,
        planOnly,
        stats,
        tenantId: tenantOverride || tournament.tenantId,
      });
      results.push(result);
    } catch (error) {
      if (dryRun && isMissingTeamTournamentSchemaError(error)) {
        const fallback = await seedTeamTournamentRecord(null, tournament, {
          dryRun: true,
          planOnly: true,
          stats,
          tenantId: tenantOverride || tournament.tenantId,
        });
        fallback.note =
          "Plan-only fallback — apply PHASE_23C SQL trước khi seed thật.";
        results.push(fallback);
      } else {
        throw error;
      }
    }

    const resultStats = results[results.length - 1].stats;
    for (const [bucket, counts] of Object.entries(resultStats)) {
      aggregateStats[bucket].insert += counts.insert;
      aggregateStats[bucket].update += counts.update;
      aggregateStats[bucket].skip += counts.skip;
    }
  }

  return {
    ok: true,
    dryRun,
    planOnly: planOnly || results.some((row) => row.planOnly),
    count: tournaments.length,
    results,
    stats: aggregateStats,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertProductionSeedSafety(options);
  console.log("=== Phase 23D — Team Tournament Cloud Seed ===\n");
  console.log(`Mode: ${options.dryRun ? "DRY-RUN (không ghi DB)" : "WRITE"}`);
  if (options.planOnly) {
    console.log("Plan-only: chỉ đếm bản ghi từ blob (không kết nối DB)");
  }
  if (options.clubId) {
    console.log(`Club filter: ${options.clubId}`);
  }
  if (options.blobPath) {
    console.log(`Blob file: ${options.blobPath}`);
  }
  if (options.tenantId) {
    console.log(`Tenant override: ${options.tenantId}`);
  }
  if (options.productionConfirm) {
    console.log("Production confirm: YES (--production-confirm)");
  }
  console.log("");

  const outcome = await runTeamTournamentSeed(options);

  if (outcome.count === 0) {
    console.log(outcome.message);
    process.exit(0);
  }

  for (const result of outcome.results) {
    console.log(
      `${options.dryRun ? "[dry-run] " : ""}${result.planOnly ? "[plan-only] " : ""}Giải ${result.tournamentId} (tenant=${result.tenantId}, club=${result.clubId})`
    );
    if (result.note) {
      console.log(result.note);
    }
    console.log(summarizeSeedStats(result.stats));
    console.log("");
  }

  console.log("--- Tổng hợp ---");
  console.log(summarizeSeedStats(outcome.stats));
  console.log(`\n✅ Seed hoàn tất (${outcome.count} giải).`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\n❌ ${error?.message || String(error)}`);
    process.exit(1);
  });
}
