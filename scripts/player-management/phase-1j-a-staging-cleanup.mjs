#!/usr/bin/env node
/**
 * STAGING-ONLY cleanup for Phase 1J-A directory fixtures.
 * Deletes only deterministic fixture namespace rows.
 *
 * Usage:
 *   node scripts/player-management/phase-1j-a-staging-cleanup.mjs
 *   node scripts/player-management/phase-1j-a-staging-cleanup.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getStagingSupabaseEnv, loadProjectEnv } from "../load-env.mjs";
import {
  PM_1J_A_FIXTURE,
  PM_1J_A_ALL_PLAYER_IDS,
  PM_1J_A_ALL_USER_IDS,
  PM_1J_A_FIXTURE_ROWS,
  PM_1J_A_STAGING_REF,
  assertStagingProjectRef,
} from "../../src/features/player/fixtures/phase1jAStagingFixture.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const OUT_DIR = join(__dirname, "../../", PM_1J_A_FIXTURE.evidenceDir);

function requireServiceEnv({ allowDryRunWithoutKey = false } = {}) {
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();
  if (!url) {
    throw new Error("Missing staging Supabase URL");
  }
  assertStagingProjectRef(url);
  if (!serviceKey) {
    if (allowDryRunWithoutKey && dryRun) {
      return { url, serviceKey: null, ref: PM_1J_A_STAGING_REF, offlineDryRun: true };
    }
    throw new Error(
      "Missing STAGING_SUPABASE_SERVICE_ROLE_KEY — cleanup blocked (prepare-only mode)."
    );
  }
  const ref = assertStagingProjectRef(url);
  return { url, serviceKey, ref, offlineDryRun: false };
}

async function captureScopedProfiles(admin) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,player_id,display_name")
    .in("player_id", PM_1J_A_ALL_PLAYER_IDS);
  if (error) return { ok: false, error: error.message, rows: [] };
  return { ok: true, rows: data || [] };
}

async function deleteProfiles(admin) {
  if (dryRun) return { dryRun: true, deleted: PM_1J_A_ALL_USER_IDS.length };
  const { error, count } = await admin
    .from("profiles")
    .delete({ count: "exact" })
    .in("id", PM_1J_A_ALL_USER_IDS);
  if (error) throw new Error(`profiles delete: ${error.message}`);
  return { deleted: count ?? PM_1J_A_ALL_USER_IDS.length };
}

async function deleteAuthUsers(admin) {
  const removed = [];
  for (const row of PM_1J_A_FIXTURE_ROWS) {
    if (dryRun) {
      removed.push({ userId: row.userId, dryRun: true });
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(row.userId);
    removed.push({
      userId: row.userId,
      role: row.role,
      ok: !error,
      error: error?.message || null,
    });
  }
  return removed;
}

async function main() {
  const { url, serviceKey, ref, offlineDryRun } = requireServiceEnv({
    allowDryRunWithoutKey: true,
  });

  let before = {
    ok: true,
    rows: PM_1J_A_FIXTURE_ROWS.map((row) => ({
      id: row.userId,
      player_id: row.playerId,
      display_name: row.displayName,
    })),
    offlineDryRun: true,
  };
  let profileDelete = { dryRun: true, deleted: PM_1J_A_ALL_USER_IDS.length };
  let authDelete = PM_1J_A_FIXTURE_ROWS.map((row) => ({ userId: row.userId, dryRun: true }));
  let after = { ok: true, rows: [], offlineDryRun: true };

  if (!offlineDryRun) {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    before = await captureScopedProfiles(admin);
    profileDelete = await deleteProfiles(admin);
    authDelete = await deleteAuthUsers(admin);
    after = dryRun ? before : await captureScopedProfiles(admin);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    ok: true,
    dryRun,
    offlineDryRun,
    stagingRef: ref,
    marker: PM_1J_A_FIXTURE.marker,
    namespace: PM_1J_A_FIXTURE.namespace,
    scopedPlayerIds: PM_1J_A_ALL_PLAYER_IDS,
    before,
    profileDelete,
    authDelete,
    after,
    cleanedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(OUT_DIR, "STAGING_PM1JA_FIXTURE_CLEANUP_REPORT.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        stagingRef: ref,
        scopedProfiles: PM_1J_A_ALL_PLAYER_IDS.length,
        remaining: (after.rows || []).length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
