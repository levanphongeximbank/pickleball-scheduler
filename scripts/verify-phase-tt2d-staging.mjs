/**
 * Phase TT-2D — Staging verification (randomize, lock, concurrency, smoke).
 *
 * Usage:
 *   node scripts/apply-phase-tt2d-staging-sql.mjs
 *   node scripts/verify-phase-tt2d-staging.mjs
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
    sqlPatches: ["docs/v5/PHASE_TT2D_RANDOMIZE_LOCK_WORKFLOW.sql"],
    probe: PROBE,
    cases: [],
    verdict: "PENDING",
    reportFile: fileName,
  };
}

function recordCase(report, id, name, pass, detail = {}) {
  report.cases.push({ id, name, pass, ...detail });
}

async function signIn(client, email, password = QA_PASSWORD) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Sign-in failed (${email}): ${error.message}`);
  }
  return data.session;
}

async function setMatchupLockAt(admin, tournamentId, matchupId, lockAtIso) {
  const { data: header } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!header?.id) {
    throw new Error("probe tournament header not found");
  }
  const { error } = await admin
    .from("team_tournament_matchups")
    .update({ lineup_lock_at: lockAtIso, status: "lineup_open" })
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", matchupId);
  if (error) {
    throw new Error(error.message);
  }
}

async function resetTeamBLineup(admin, tournamentId, matchupId, teamId) {
  const { data: header } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!header?.id) {
    return;
  }
  const { data: matchup } = await admin
    .from("team_tournament_matchups")
    .select("id")
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", matchupId)
    .maybeSingle();
  if (!matchup?.id) {
    return;
  }
  await admin
    .from("team_tournament_lineups")
    .update({
      status: "not_submitted",
      source: "captain",
      selections: {},
      submitted_at: null,
      locked_at: null,
      audit_note: null,
    })
    .eq("matchup_id", matchup.id)
    .eq("team_external_id", teamId);
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    return { ok: false, code: error.code, error: error.message, raw: error };
  }
  return typeof data === "object" && data ? data : { ok: true, data };
}

async function getSetup(client) {
  return rpc(client, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
    p_viewer_team_id: null,
  });
}

function findMatchup(setup) {
  const matchups = setup?.tournament?.teamData?.matchups || [];
  return matchups.find((m) => m.id === PROBE.matchupId) || null;
}

function lineupKey(setup, teamId) {
  const lineups = setup?.tournament?.teamData?.lineups || {};
  return lineups[`${PROBE.matchupId}::${teamId}`] || null;
}

async function main() {
  loadProjectEnv();
  spawnSync("node", ["scripts/prep-tt2c-staging-player-genders.mjs"], {
    cwd: rootDir,
    stdio: "inherit",
  });
  const env = getStagingSupabaseEnv();
  if (!env.serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authKey = env.anonKey || env.serviceKey;
  const client = createClient(env.url, authKey, { auth: { persistSession: false } });
  await signIn(client, BTC_EMAIL);

  const { data: originalRow } = await admin
    .from("team_tournaments")
    .select("id, team_tournament_matchups(lineup_lock_at, external_matchup_id, status)")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();
  const originalLockAt =
    originalRow?.team_tournament_matchups?.find((m) => m.external_matchup_id === PROBE.matchupId)
      ?.lineup_lock_at || null;

  await resetTeamBLineup(admin, PROBE.tournamentId, PROBE.matchupId, PROBE.teamB);
  const futureDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, futureDeadline);

  const randomReport = baseReport("TT-2D-RANDOMIZE", "TT2D_RANDOMIZE_REPORT.json");
  const lockReport = baseReport("TT-2D-LOCK", "TT2D_LOCK_REPORT.json");
  const concurrencyReport = baseReport("TT-2D-CONCURRENCY", "TT2D_CONCURRENCY_REPORT.json");
  const smokeReport = baseReport("TT-2D-SMOKE", "TT2D_STAGING_SMOKE_REPORT.json");

  const setup0 = await getSetup(client);
  recordCase(smokeReport, "S01", "get_setup ok", setup0.ok === true, { setup0: setup0.ok });
  const matchup0 = findMatchup(setup0);
  recordCase(
    smokeReport,
    "S02",
    "matchup exposes canLock for BTC",
    matchup0 && "canLock" in matchup0,
    { canLock: matchup0?.canLock }
  );
  recordCase(
    smokeReport,
    "S03",
    "matchup exposes lineupOps",
    Boolean(matchup0?.lineupOps),
    { policy: matchup0?.lineupOps?.policy || matchup0?.missingLineupPolicy }
  );

  const lineupB = lineupKey(setup0, PROBE.teamB);
  const lineupVersion = lineupB?.version ?? 1;
  const matchupVersion = matchup0?.version ?? 1;

  const beforeDeadline = await rpc(client, "team_tournament_randomize_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamB,
    p_expected_version: lineupVersion,
    p_idempotency_key: `tt2d-verify-before-deadline-${Date.now()}`,
  });
  recordCase(
    randomReport,
    "R01",
    "randomize before deadline blocked when deadline not passed",
    beforeDeadline.ok === false && beforeDeadline.code === "DEADLINE_NOT_PASSED",
    { code: beforeDeadline.code }
  );

  const pastDeadline = new Date(Date.now() - 60 * 1000).toISOString();
  await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, pastDeadline);

  async function freshLineupVersion() {
    await resetTeamBLineup(admin, PROBE.tournamentId, PROBE.matchupId, PROBE.teamB);
    const setup = await getSetup(client);
    return lineupKey(setup, PROBE.teamB)?.version ?? 1;
  }

  const staleVersion = await freshLineupVersion();
  const stale = await rpc(client, "team_tournament_randomize_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamB,
    p_expected_version: staleVersion - 1,
    p_idempotency_key: `tt2d-verify-stale-${Date.now()}`,
  });
  recordCase(
    concurrencyReport,
    "C02",
    "stale expected_version returns version_conflict",
    stale.ok === false && String(stale.code || "").includes("version"),
    { code: stale.code }
  );

  const dualVersion = await freshLineupVersion();
  const dual = await Promise.all([
    rpc(client, "team_tournament_randomize_lineup", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_team_id: PROBE.teamB,
      p_expected_version: dualVersion,
      p_idempotency_key: `tt2d-dual-a-${Date.now()}`,
    }),
    rpc(client, "team_tournament_randomize_lineup", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_team_id: PROBE.teamB,
      p_expected_version: dualVersion,
      p_idempotency_key: `tt2d-dual-b-${Date.now()}`,
    }),
  ]);
  const dualOk = dual.filter((r) => r.ok).length;
  const dualConflict = dual.filter((r) => String(r.code || "").includes("version")).length;
  recordCase(
    concurrencyReport,
    "C03",
    "concurrent randomize — one succeeds or version_conflict",
    dualOk >= 1 || dualConflict >= 1,
    { outcomes: dual.map((r) => ({ ok: r.ok, code: r.code })) }
  );

  const idemVersion = await freshLineupVersion();
  const idemKey = `tt2d-verify-idem-${Date.now()}`;
  const rand1 = await rpc(client, "team_tournament_randomize_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamB,
    p_expected_version: idemVersion,
    p_idempotency_key: idemKey,
  });
  const rand2 = await rpc(client, "team_tournament_randomize_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamB,
    p_expected_version: idemVersion,
    p_idempotency_key: idemKey,
  });
  recordCase(
    concurrencyReport,
    "C01",
    "same idempotency key replays without double version bump",
    rand1.ok === true && rand2.ok === true && rand1.version === rand2.version,
    { v1: rand1.version, v2: rand2.version }
  );

  recordCase(
    randomReport,
    "R02",
    "randomize success sets source=random",
    rand1.ok === true && rand1.source === "random",
    { source: rand1.source }
  );

  const setup1 = await getSetup(client);
  const matchup1 = findMatchup(setup1);
  recordCase(
    lockReport,
    "L01",
    "canLock exposed from server after randomize",
    typeof matchup1?.canLock === "boolean",
    { canLock: matchup1?.canLock }
  );

  const lockBlocked = await rpc(client, "team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_expected_version: 1,
    p_idempotency_key: `tt2d-lock-stale-${Date.now()}`,
  });
  recordCase(
    lockReport,
    "L02",
    "lock with stale version conflicts",
    lockBlocked.ok === false && String(lockBlocked.code || "").includes("version"),
    { code: lockBlocked.code }
  );

  if (matchup1?.canLock) {
    const locked = await rpc(client, "team_tournament_lock_matchup", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_expected_version: matchup1.version ?? matchupVersion,
      p_idempotency_key: `tt2d-lock-${Date.now()}`,
    });
    recordCase(lockReport, "L03", "lock success", locked.ok === true, { code: locked.code });

    const captainClient = createClient(env.url, authKey, { auth: { persistSession: false } });
    await signIn(captainClient, process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local");
    const captainSetup = await rpc(captainClient, "team_tournament_get_setup", {
      p_tournament_id: PROBE.tournamentId,
      p_viewer_team_id: PROBE.teamA,
    });
    const captainMatchup = findMatchup(captainSetup);
    recordCase(
      lockReport,
      "L04",
      "captain cannot save/submit after lock",
      captainMatchup?.canSaveDraft === false && captainMatchup?.canSubmit === false,
      {
        canSaveDraft: captainMatchup?.canSaveDraft,
        canSubmit: captainMatchup?.canSubmit,
      }
    );
  } else {
    recordCase(lockReport, "L03", "lock success", false, { skipped: "canLock=false" });
    recordCase(lockReport, "L04", "captain cannot save/submit after lock", false, { skipped: true });
  }

  for (const report of [randomReport, lockReport, concurrencyReport, smokeReport]) {
    const passCount = report.cases.filter((c) => c.pass).length;
    report.verdict = passCount === report.cases.length ? "PASS" : "FAIL";
    report.summary = `${passCount}/${report.cases.length} PASS`;
  }

  if (originalLockAt) {
    await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, originalLockAt);
  } else {
    await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, futureDeadline);
  }

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "TT2D_RANDOMIZE_REPORT.json"), JSON.stringify(randomReport, null, 2));
  fs.writeFileSync(path.join(evidenceDir, "TT2D_LOCK_REPORT.json"), JSON.stringify(lockReport, null, 2));
  fs.writeFileSync(
    path.join(evidenceDir, "TT2D_CONCURRENCY_REPORT.json"),
    JSON.stringify(concurrencyReport, null, 2)
  );
  fs.writeFileSync(
    path.join(evidenceDir, "TT2D_STAGING_SMOKE_REPORT.json"),
    JSON.stringify(smokeReport, null, 2)
  );

  const allPass = [randomReport, lockReport, concurrencyReport, smokeReport].every(
    (r) => r.verdict === "PASS"
  );
  console.log(JSON.stringify({ allPass, randomReport, lockReport, concurrencyReport, smokeReport }, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
