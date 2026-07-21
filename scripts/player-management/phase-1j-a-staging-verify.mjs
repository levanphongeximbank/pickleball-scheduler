#!/usr/bin/env node
/**
 * STAGING-ONLY read-only verification for Phase 1J-A directory fixtures.
 *
 * Usage:
 *   node scripts/player-management/phase-1j-a-staging-verify.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getStagingSupabaseEnv, loadProjectEnv } from "../load-env.mjs";
import {
  PM_1J_A_FIXTURE,
  PM_1J_A_ELIGIBLE_ROW,
  PM_1J_A_HIDDEN_ROW,
  PM_1J_A_SUSPENDED_ROW,
  PM_1J_A_UNVERIFIED_ROW,
  PM_1J_A_MASKED_ROW,
  assertStagingProjectRef,
} from "../../src/features/player/fixtures/phase1jAStagingFixture.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../../", PM_1J_A_FIXTURE.evidenceDir);
const NONEXISTENT_PLAYER_ID = "qa-pm1ja-nonexistent-0000";

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

function resolveVerifierPassword() {
  return String(
    process.env.PM_1J_A_VERIFIER_PASSWORD ||
      process.env.PHASE42L_QA_PASSWORD ||
      process.env.STAGING_PLAYER_NEW_PASSWORD ||
      process.env.STAGING_OWNER_A_PASSWORD ||
      "PickleStaging!358"
  ).trim();
}

function resolveVerifierEmail() {
  return String(
    process.env.PM_1J_A_VERIFIER_EMAIL || PM_1J_A_FIXTURE.verifierEmail
  ).trim();
}

function findRowByPlayerId(payload, playerId) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.find((row) => String(row?.player_id || "") === playerId) || null;
}

function hasHiddenTotalLeak(meta) {
  if (!meta || typeof meta !== "object") return false;
  const forbidden = [
    "total",
    "totalCount",
    "total_count",
    "hiddenCount",
    "hidden_count",
    "totalHidden",
    "total_hidden",
    "eligibleTotal",
    "eligible_total",
  ];
  return forbidden.some((key) => meta[key] !== undefined && meta[key] !== null);
}

async function signInVerifier(url, anonKey) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = resolveVerifierEmail();
  const password = resolveVerifierPassword();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, client, error: error.message, email };
  }
  return { ok: true, client, userId: data.user?.id || null, email };
}

async function main() {
  loadProjectEnv();
  const { url, anonKey } = getStagingSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error("Missing staging Supabase URL/anon key");
  }
  const ref = assertStagingProjectRef(url);

  const auth = await signInVerifier(url, anonKey);
  const results = [];
  results.push(
    check("verifier auth", auth.ok, auth.ok ? { email: auth.email } : { error: auth.error })
  );

  if (!auth.ok) {
    const report = {
      ok: false,
      stagingRef: ref,
      results,
      verifiedAt: new Date().toISOString(),
    };
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      join(OUT_DIR, "STAGING_PM1JA_FIXTURE_VERIFY_REPORT.json"),
      JSON.stringify(report, null, 2)
    );
    console.log(JSON.stringify({ ok: false, reason: "verifier_auth_failed" }, null, 2));
    process.exit(1);
  }

  const client = auth.client;

  const browse = await client.rpc("player_directory_search", {
    p_query: null,
    p_region: null,
    p_cursor: null,
    p_limit: 50,
  });
  results.push(check("browse rpc ok", browse.data?.ok === true, browse.error?.message || null));
  results.push(
    check(
      "eligible athlete appears in browse",
      findRowByPlayerId(browse.data, PM_1J_A_ELIGIBLE_ROW.playerId) != null,
      { playerId: PM_1J_A_ELIGIBLE_ROW.playerId }
    )
  );
  results.push(
    check(
      "hidden athlete excluded from browse",
      findRowByPlayerId(browse.data, PM_1J_A_HIDDEN_ROW.playerId) == null,
      { playerId: PM_1J_A_HIDDEN_ROW.playerId }
    )
  );
  results.push(
    check(
      "suspended athlete excluded from browse",
      findRowByPlayerId(browse.data, PM_1J_A_SUSPENDED_ROW.playerId) == null,
      { playerId: PM_1J_A_SUSPENDED_ROW.playerId }
    )
  );
  results.push(
    check(
      "unverified athlete excluded from browse",
      findRowByPlayerId(browse.data, PM_1J_A_UNVERIFIED_ROW.playerId) == null,
      { playerId: PM_1J_A_UNVERIFIED_ROW.playerId }
    )
  );
  results.push(
    check(
      "no hidden total leak in meta",
      !hasHiddenTotalLeak(browse.data?.meta),
      browse.data?.meta || null
    )
  );

  const eligibleSearch = await client.rpc("player_directory_search", {
    p_query: "PM1JA Eligible",
    p_region: null,
    p_cursor: null,
    p_limit: 20,
  });
  const eligibleHit = findRowByPlayerId(eligibleSearch.data, PM_1J_A_ELIGIBLE_ROW.playerId);
  results.push(
    check(
      "eligible search by display_name",
      eligibleSearch.data?.ok === true && eligibleHit != null,
      { count: eligibleSearch.data?.meta?.count }
    )
  );

  const eligibleDetail = await client.rpc("player_directory_get", {
    p_player_id: PM_1J_A_ELIGIBLE_ROW.playerId,
  });
  const eligibleRow = Array.isArray(eligibleDetail.data?.data)
    ? eligibleDetail.data.data[0]
    : eligibleDetail.data?.data;
  results.push(
    check(
      "eligible detail returns strict fields",
      eligibleDetail.data?.ok === true &&
        eligibleRow?.player_id === PM_1J_A_ELIGIBLE_ROW.playerId &&
        eligibleRow?.is_verified === true,
      eligibleRow
        ? {
            player_id: eligibleRow.player_id,
            display_name: eligibleRow.display_name,
            gender: eligibleRow.gender,
            handedness: eligibleRow.handedness,
            activity_region: eligibleRow.activity_region,
          }
        : eligibleDetail.data
    )
  );

  const maskedDetail = await client.rpc("player_directory_get", {
    p_player_id: PM_1J_A_MASKED_ROW.playerId,
  });
  const maskedRow = Array.isArray(maskedDetail.data?.data)
    ? maskedDetail.data.data[0]
    : maskedDetail.data?.data;
  results.push(
    check(
      "masked detail keeps row but nulls masked fields",
      maskedDetail.data?.ok === true &&
        maskedRow?.player_id === PM_1J_A_MASKED_ROW.playerId &&
        maskedRow?.gender == null &&
        maskedRow?.handedness == null &&
        maskedRow?.activity_region == null,
      maskedRow
    )
  );

  async function expectNullDetail(playerId, label) {
    const res = await client.rpc("player_directory_get", { p_player_id: playerId });
    const row = Array.isArray(res.data?.data) ? res.data.data[0] : res.data?.data;
    results.push(
      check(`${label} detail is null`, res.data?.ok === true && (row == null || row === null), {
        playerId,
      })
    );
  }

  await expectNullDetail(PM_1J_A_HIDDEN_ROW.playerId, "hidden");
  await expectNullDetail(PM_1J_A_SUSPENDED_ROW.playerId, "suspended");
  await expectNullDetail(PM_1J_A_UNVERIFIED_ROW.playerId, "unverified");
  await expectNullDetail(NONEXISTENT_PLAYER_ID, "nonexistent");

  const invalidCursor = await client.rpc("player_directory_search", {
    p_query: null,
    p_region: null,
    p_cursor: "pd1.invalid-cursor-token",
    p_limit: 20,
  });
  results.push(
    check(
      "invalid cursor is controlled",
      invalidCursor.data?.ok === false &&
        String(invalidCursor.data?.code || "").toUpperCase() === "INVALID_CURSOR" &&
        Array.isArray(invalidCursor.data?.data) &&
        invalidCursor.data.data.length === 0,
      { code: invalidCursor.data?.code }
    )
  );

  const failed = results.filter((row) => !row.ok);
  const report = {
    ok: failed.length === 0,
    stagingRef: ref,
    verifierEmail: auth.email,
    marker: PM_1J_A_FIXTURE.marker,
    results,
    failed,
    verifiedAt: new Date().toISOString(),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "STAGING_PM1JA_FIXTURE_VERIFY_REPORT.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify({ ok: report.ok, failed: failed.length, checks: results.length }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
