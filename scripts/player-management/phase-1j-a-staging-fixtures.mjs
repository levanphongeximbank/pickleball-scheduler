#!/usr/bin/env node
/**
 * STAGING-ONLY — seed Player Management Phase 1J-A directory fixtures.
 *
 * Guards: refuses Production ref; idempotent upserts; secrets from env only.
 *
 * Usage:
 *   node scripts/player-management/phase-1j-a-staging-fixtures.mjs
 *   node scripts/player-management/phase-1j-a-staging-fixtures.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getStagingSupabaseEnv, loadProjectEnv } from "../load-env.mjs";
import {
  PM_1J_A_FIXTURE,
  PM_1J_A_FIXTURE_ROWS,
  PM_1J_A_ALL_PLAYER_IDS,
  PM_1J_A_ALL_USER_IDS,
  PM_1J_A_STAGING_REF,
  assertStagingProjectRef,
  buildFixtureProfilePayload,
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
      "Missing STAGING_SUPABASE_SERVICE_ROLE_KEY — fixture apply blocked (prepare-only mode)."
    );
  }
  const ref = assertStagingProjectRef(url);
  return { url, serviceKey, ref, offlineDryRun: false };
}

async function capturePreWriteSnapshot(admin) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,player_id,display_name,status,identity_verification_status")
    .in("player_id", PM_1J_A_ALL_PLAYER_IDS);
  if (error) {
    return { ok: false, error: error.message, rows: [] };
  }
  return {
    ok: true,
    rows: data || [],
    capturedAt: new Date().toISOString(),
  };
}

async function ensureAuthUser(admin, row, password) {
  const meta = {
    qa_fixture: true,
    fixture_key: row.key,
    fixture_marker: row.fixtureMarker,
    fixture_namespace: PM_1J_A_FIXTURE.namespace,
    fixture_role: row.role,
  };

  const byId = await admin.auth.admin.getUserById(row.userId);
  if (byId?.data?.user) {
    if (!dryRun) {
      await admin.auth.admin.updateUserById(row.userId, {
        email: row.email,
        email_confirm: true,
        user_metadata: meta,
      });
    }
    return { userId: row.userId, created: false };
  }

  if (dryRun) return { userId: row.userId, created: true, dryRun: true };

  const { data, error } = await admin.auth.admin.createUser({
    id: row.userId,
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

async function upsertProfile(admin, row) {
  const payload = buildFixtureProfilePayload(row);
  if (dryRun) return { dryRun: true, playerId: row.playerId };
  const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`${row.key} profiles: ${error.message}`);
  return { ok: true, playerId: row.playerId };
}

async function main() {
  const { url, serviceKey, ref, offlineDryRun } = requireServiceEnv({
    allowDryRunWithoutKey: true,
  });
  const password =
    process.env.PM_1J_A_FIXTURE_PASSWORD ||
    process.env.PHASE42L_QA_PASSWORD ||
    "Pm1JaQa!StagingLocalOnly";

  let preWrite = { ok: true, rows: [], offlineDryRun: true, capturedAt: new Date().toISOString() };
  let admin = null;
  if (!offlineDryRun) {
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    preWrite = await capturePreWriteSnapshot(admin);
  }
  const seeded = [];

  for (const row of PM_1J_A_FIXTURE_ROWS) {
    const auth = offlineDryRun
      ? { userId: row.userId, created: true, dryRun: true }
      : await ensureAuthUser(admin, row, password);
    const profile = offlineDryRun
      ? { dryRun: true, playerId: row.playerId }
      : await upsertProfile(admin, row);
    seeded.push({
      role: row.role,
      key: row.key,
      userId: auth.userId,
      playerId: row.playerId,
      displayName: row.displayName,
      directoryExpectation: row.directoryExpectation,
      created: auth.created,
      profileOk: profile.ok !== false || profile.dryRun === true,
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    ok: true,
    dryRun,
    offlineDryRun,
    stagingRef: ref,
    marker: PM_1J_A_FIXTURE.marker,
    namespace: PM_1J_A_FIXTURE.namespace,
    fixtureCount: seeded.length,
    preWriteSnapshot: preWrite,
    seeded,
    seededAt: new Date().toISOString(),
  };
  writeFileSync(
    join(OUT_DIR, "STAGING_PM1JA_FIXTURE_SEED_REPORT.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        stagingRef: ref,
        fixtureCount: seeded.length,
        eligiblePlayerId: PM_1J_A_FIXTURE_ROWS[0].playerId,
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
