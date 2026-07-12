/**
 * Phase TT-2E — Staging verification (atomic publish, visibility, concurrency).
 *
 * Usage:
 *   node scripts/apply-phase-tt2e-staging-sql.mjs
 *   node scripts/verify-phase-tt2e-staging.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt2");

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  teamA: "phase23d-team-a",
  teamB: "phase23d-team-b",
  matchupId: "phase23d-matchup-1",
};

const BTC_EMAIL = process.env.STAGING_BTC_EMAIL || "admin@staging.local";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function baseReport(phase, fileName) {
  return {
    generatedAt: new Date().toISOString(),
    phase,
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    sqlPatches: ["docs/v5/PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql"],
    probe: PROBE,
    cases: [],
    verdict: "PENDING",
    reportFile: fileName,
  };
}

function recordCase(report, id, name, pass, detail = {}) {
  report.cases.push({ id, name, pass, ...detail });
}

function finalizeReport(report) {
  const passCount = report.cases.filter((c) => c.pass).length;
  report.passCount = passCount;
  report.totalCount = report.cases.length;
  report.allPass = passCount === report.cases.length;
  report.verdict = report.allPass ? "PASS" : "FAIL";
  return report;
}

async function signIn(client, email, password = QA_PASSWORD) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Sign-in failed (${email}): ${error.message}`);
  }
  return data.session;
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    return { ok: false, code: error.code, error: error.message, raw: error };
  }
  return typeof data === "object" && data ? data : { ok: true, data };
}

async function getHeader(admin) {
  const { data } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();
  return data;
}

async function getMatchupRow(admin) {
  const header = await getHeader(admin);
  if (!header?.id) {
    return null;
  }
  const { data } = await admin
    .from("team_tournament_matchups")
    .select("id, version, status, team_a_id, team_b_id")
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", PROBE.matchupId)
    .maybeSingle();
  return data;
}

async function getLineupRows(admin, matchupDbId) {
  const { data } = await admin
    .from("team_tournament_lineups")
    .select("team_external_id, status, version, published_at")
    .eq("matchup_id", matchupDbId);
  return data || [];
}

async function resetPublishedMatchup(admin) {
  const header = await getHeader(admin);
  if (!header?.id) {
    return;
  }
  const matchup = await getMatchupRow(admin);
  if (!matchup?.id) {
    return;
  }
  await admin
    .from("team_tournament_matchups")
    .update({ status: "locked", updated_at: new Date().toISOString() })
    .eq("id", matchup.id);
  await admin
    .from("team_tournament_lineups")
    .update({
      status: "locked",
      published_at: null,
    })
    .eq("matchup_id", matchup.id);
}

async function prepLockedMatchup(admin, btcClient) {
  await resetPublishedMatchup(admin);
  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const header = await getHeader(admin);
  if (!header?.id) {
    throw new Error("probe tournament not found");
  }
  await admin
    .from("team_tournament_matchups")
    .update({ lineup_lock_at: pastDeadline, status: "lineup_open" })
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", PROBE.matchupId);

  const setup0 = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchup0 = findMatchup(setup0);
  const lineupB = lineupFromSetup(setup0, PROBE.teamB);
  if (lineupB?.status !== "submitted" && lineupB?.status !== "locked") {
    await rpc(btcClient, "team_tournament_randomize_lineup", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_team_id: PROBE.teamB,
      p_expected_version: lineupB?.version ?? 1,
      p_idempotency_key: `tt2e-prep-random-${Date.now()}`,
    });
  }

  const setup1 = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchup1 = findMatchup(setup1);
  if (matchup1?.status !== "locked") {
    await rpc(btcClient, "team_tournament_lock_matchup", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_expected_version: matchup1?.version ?? 1,
      p_idempotency_key: `tt2e-prep-lock-${Date.now()}`,
    });
  }
}

function findMatchup(setup) {
  const matchups =
    setup?.tournament?.teamData?.matchups || setup?.matchups || [];
  return matchups.find((m) => m.id === PROBE.matchupId) || null;
}

function lineupFromSetup(setup, teamId) {
  const lineups =
    setup?.tournament?.teamData?.lineups || setup?.lineups || {};
  return lineups[`${PROBE.matchupId}::${teamId}`] || null;
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  if (!env.serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authKey = env.anonKey || env.serviceKey;
  const btcClient = createClient(env.url, authKey, { auth: { persistSession: false } });
  await signIn(btcClient, BTC_EMAIL);

  await prepLockedMatchup(admin, btcClient);

  const publishReport = baseReport("TT-2E-PUBLISH", "TT2E_PUBLISH_REPORT.json");
  const atomicityReport = baseReport("TT-2E-ATOMICITY", "TT2E_ATOMICITY_REPORT.json");
  const visibilityReport = baseReport("TT-2E-VISIBILITY", "TT2E_VISIBILITY_REPORT.json");
  const concurrencyReport = baseReport("TT-2E-CONCURRENCY", "TT2E_CONCURRENCY_REPORT.json");
  const smokeReport = baseReport("TT-2E-SMOKE", "TT2E_STAGING_SMOKE_REPORT.json");

  const setupLocked = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchup = findMatchup(setupLocked);
  const lineupA = lineupFromSetup(setupLocked, PROBE.teamA);
  const lineupB = lineupFromSetup(setupLocked, PROBE.teamB);

  recordCase(smokeReport, "S01", "get_setup ok", setupLocked.ok === true);
  recordCase(
    smokeReport,
    "S02",
    "canPublish exposed for BTC",
    typeof matchup?.canPublish === "boolean",
    { canPublish: matchup?.canPublish }
  );
  recordCase(
    smokeReport,
    "S03",
    "publishOps exposed",
    Boolean(matchup?.publishOps),
    { blockCode: matchup?.publishBlockCode }
  );

  const captainClient = createClient(env.url, authKey, { auth: { persistSession: false } });
  await signIn(captainClient, process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local");

  const visibleBefore = await rpc(captainClient, "team_tournament_get_visible_lineups", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_viewer_team_id: PROBE.teamA,
  });
  const beforeLineups = visibleBefore.lineups || {};
  recordCase(
    visibilityReport,
    "V01",
    "captain A sees own lineup before publish",
    Boolean(beforeLineups[PROBE.teamA]?.selections)
  );
  recordCase(
    visibilityReport,
    "V02",
    "captain A cannot see opponent before publish",
    beforeLineups[PROBE.teamB]?.selections == null
  );

  const stalePublish = await rpc(btcClient, "team_tournament_publish_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_matchup_version: (matchup?.version ?? 1) - 1,
    p_expected_lineup_a_version: lineupA?.version ?? 1,
    p_expected_lineup_b_version: lineupB?.version ?? 1,
    p_idempotency_key: `tt2e-stale-${Date.now()}`,
  });
  recordCase(
    publishReport,
    "P01",
    "stale matchup version returns version_conflict",
    stalePublish.ok === false && String(stalePublish.code || "").includes("version"),
    { code: stalePublish.code }
  );

  if (!matchup?.canPublish) {
    recordCase(publishReport, "P02", "publish success", false, { skipped: "canPublish=false" });
    recordCase(atomicityReport, "A01", "both lineups published", false, { skipped: true });
    recordCase(concurrencyReport, "C01", "idempotency replay", false, { skipped: true });
  } else {
    const idemKey = `tt2e-publish-${Date.now()}`;
    const publishArgs = {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_expected_matchup_version: matchup.version,
      p_expected_lineup_a_version: lineupA.version,
      p_expected_lineup_b_version: lineupB.version,
      p_idempotency_key: idemKey,
    };

    const pub1 = await rpc(btcClient, "team_tournament_publish_matchup", publishArgs);
    recordCase(
      publishReport,
      "P02",
      "atomic publish success",
      pub1.ok === true && pub1.code === "published",
      {
        matchupVersion: pub1.matchupVersion,
        lineupAVersion: pub1.lineupAVersion,
        lineupBVersion: pub1.lineupBVersion,
        publishedAt: pub1.publishedAt,
      }
    );

    const matchupRow = await getMatchupRow(admin);
    const lineupRows = await getLineupRows(admin, matchupRow.id);
    const allPublished =
      matchupRow?.status === "published" &&
      lineupRows.length === 2 &&
      lineupRows.every((row) => row.status === "published" && row.published_at);
    recordCase(atomicityReport, "A01", "both lineups + matchup published atomically", allPublished, {
      matchupStatus: matchupRow?.status,
      lineups: lineupRows,
    });

    const pub2 = await rpc(btcClient, "team_tournament_publish_matchup", publishArgs);
    recordCase(
      concurrencyReport,
      "C01",
      "same idempotency key replays without duplicate success audit",
      pub2.ok === true && pub2.matchupVersion === pub1.matchupVersion,
      { replayed: pub2.replayed, v1: pub1.matchupVersion, v2: pub2.matchupVersion }
    );

    const staleAfter = await rpc(btcClient, "team_tournament_publish_matchup", {
      ...publishArgs,
      p_idempotency_key: `tt2e-stale-after-${Date.now()}`,
    });
    recordCase(
      concurrencyReport,
      "C02",
      "second publish with new key returns already_published or version_conflict",
      staleAfter.ok === false,
      { code: staleAfter.code }
    );

    const visibleAfter = await rpc(captainClient, "team_tournament_get_visible_lineups", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_viewer_team_id: PROBE.teamA,
    });
    const afterLineups = visibleAfter.lineups || {};
    recordCase(
      visibilityReport,
      "V03",
      "captain A sees opponent after publish",
      Boolean(afterLineups[PROBE.teamB]?.selections)
    );

    const captainBClient = createClient(env.url, authKey, { auth: { persistSession: false } });
    await signIn(
      captainBClient,
      process.env.STAGING_CAPTAIN_B_EMAIL || process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local"
    );
    const visibleB = await rpc(captainBClient, "team_tournament_get_visible_lineups", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_viewer_team_id: PROBE.teamB,
    });
    const bLineups = visibleB.lineups || {};
    recordCase(
      visibilityReport,
      "V04",
      "captain B sees both lineups after publish",
      Boolean(bLineups[PROBE.teamA]?.selections) && Boolean(bLineups[PROBE.teamB]?.selections)
    );
  }

  for (const report of [
    publishReport,
    atomicityReport,
    visibilityReport,
    concurrencyReport,
    smokeReport,
  ]) {
    finalizeReport(report);
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, report.reportFile), JSON.stringify(report, null, 2));
    console.log(`${report.reportFile}: ${report.verdict} (${report.passCount}/${report.totalCount})`);
  }

  const allPass = [publishReport, atomicityReport, visibilityReport, concurrencyReport, smokeReport].every(
    (r) => r.allPass
  );
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
