/**
 * Phase TT-2B — Server-side lineup deadline verification (staging).
 *
 * Usage:
 *   node scripts/verify-phase-tt2b-deadline.mjs
 *   node scripts/verify-phase-tt2b-deadline.mjs --report=docs/v5/qa-evidence/phase-tt2/TT2B_DEADLINE_REPORT.json
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
  matchupId: "phase23d-matchup-1",
};

const CAPTAIN_EMAIL = process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function parseArgs(argv) {
  return {
    reportFile:
      argv.find((a) => a.startsWith("--report="))?.split("=")[1] ||
      "TT2B_DEADLINE_REPORT.json",
  };
}

function createReport() {
  return {
    generatedAt: new Date().toISOString(),
    phase: "TT-2B",
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    sqlPatch: "docs/v5/PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql",
    probe: PROBE,
    cases: [],
    verdict: "PENDING",
  };
}

function record(report, id, pass, expected, actual, detail = "") {
  report.cases.push({ id, pass, expected, actual, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}: ${actual}${detail ? ` — ${detail}` : ""}`);
}

async function signIn(client, email, password) {
  if (!client) {
    return { client: null, error: "missing_client" };
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { client: null, error: error.message };
  }
  return { client, userId: data.user.id, error: null };
}

async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }
  return data && typeof data === "object" ? data : { ok: true, data };
}

async function setMatchupLockAt(admin, tournamentId, matchupId, lockAtIso) {
  const { data: header, error: headerError } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (headerError) {
    throw new Error(headerError.message);
  }
  if (!header?.id) {
    throw new Error("probe tournament header not found");
  }

  const { data, error } = await admin
    .from("team_tournament_matchups")
    .update({ lineup_lock_at: lockAtIso })
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", matchupId)
    .select("lineup_lock_at");

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.length) {
    throw new Error(`matchup ${matchupId} not updated`);
  }
  return data[0].lineup_lock_at;
}

function findMatchup(setup, matchupId) {
  return setup?.tournament?.teamData?.matchups?.find((m) => m.id === matchupId) || null;
}

async function main() {
  loadProjectEnv();
  const args = parseArgs(process.argv.slice(2));
  const report = createReport();
  report.probe = PROBE;

  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging URL (expected ${STAGING_REF})`);
  }
  if (!serviceKey) {
    report.verdict = "NOT READY FOR TT-2C";
    report.blocker = "Missing STAGING_SUPABASE_SERVICE_ROLE_KEY";
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, args.reportFile), JSON.stringify(report, null, 2));
    console.error(`❌ ${report.blocker}`);
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let authClient = anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  if (!authClient) {
    authClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const captain = await signIn(authClient, CAPTAIN_EMAIL, QA_PASSWORD);
  if (!captain.client) {
    report.verdict = "NOT READY FOR TT-2C";
    report.blocker = `Captain sign-in failed: ${captain.error}`;
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, args.reportFile), JSON.stringify(report, null, 2));
    console.error(`❌ ${report.blocker}`);
    process.exit(2);
  }

  const { data: headerRow } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();

  const { data: originalRow, error: originalError } = headerRow?.id
    ? await admin
        .from("team_tournament_matchups")
        .select("lineup_lock_at")
        .eq("team_tournament_id", headerRow.id)
        .eq("external_matchup_id", PROBE.matchupId)
        .maybeSingle()
    : { data: null, error: null };

  if (originalError) {
    throw new Error(originalError.message);
  }

  const originalLockAt = originalRow?.lineup_lock_at || null;

  try {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const appliedFuture = await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, future);

    const beforeSetup = await rpc(captain.client, "team_tournament_get_setup", {
      p_tournament_id: PROBE.tournamentId,
      p_viewer_team_id: null,
    });

    record(
      report,
      "TT2B-01-get_setup-fields",
      beforeSetup.ok &&
        beforeSetup.serverTime &&
        beforeSetup.deadlineStatus &&
        typeof beforeSetup.canSaveDraft === "boolean" &&
        typeof beforeSetup.canSubmit === "boolean",
      "serverTime + lineupDeadline + canSaveDraft + canSubmit + deadlineStatus",
      JSON.stringify({
        serverTime: Boolean(beforeSetup.serverTime),
        lineupDeadline: beforeSetup.lineupDeadline,
        appliedLockAt: appliedFuture,
        canSaveDraft: beforeSetup.canSaveDraft,
        canSubmit: beforeSetup.canSubmit,
        deadlineStatus: beforeSetup.deadlineStatus,
      })
    );

    const beforeMatchup = findMatchup(beforeSetup, PROBE.matchupId);
    record(
      report,
      "TT2B-02-before-deadline",
      beforeSetup.deadlineStatus === "before" &&
        beforeSetup.canSaveDraft === true &&
        beforeSetup.canSubmit === true &&
        beforeMatchup?.canSaveDraft === true,
      "deadlineStatus=before, captain can save/submit",
      `status=${beforeSetup.deadlineStatus} save=${beforeSetup.canSaveDraft} submit=${beforeSetup.canSubmit}`
    );

    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, past);

    const afterSetup = await rpc(captain.client, "team_tournament_get_setup", {
      p_tournament_id: PROBE.tournamentId,
      p_viewer_team_id: null,
    });

    record(
      report,
      "TT2B-03-after-deadline",
      afterSetup.deadlineStatus === "past" &&
        afterSetup.canSaveDraft === false &&
        afterSetup.canSubmit === false,
      "deadlineStatus=past, blocked",
      `status=${afterSetup.deadlineStatus} save=${afterSetup.canSaveDraft}`
    );

    const draftAfter = await rpc(captain.client, "team_tournament_save_lineup_draft", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_team_id: PROBE.teamA,
      p_selections: {},
    });

    record(
      report,
      "TT2B-04-retry-after-deadline",
      draftAfter.ok === false &&
        (draftAfter.code === "LOCKED" ||
          draftAfter.code === "DEADLINE_PASSED" ||
          draftAfter.code === "deadline_passed"),
      "save draft rejected after deadline",
      `code=${draftAfter.code}`
    );

    const atServerMs = new Date(afterSetup.serverTime || Date.now()).getTime();
    const atLock = new Date(atServerMs - 100).toISOString();
    await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, atLock);

    const atSetup = await rpc(captain.client, "team_tournament_get_setup", {
      p_tournament_id: PROBE.tournamentId,
      p_viewer_team_id: null,
    });

    record(
      report,
      "TT2B-05-at-deadline",
      (atSetup.deadlineStatus === "at" || atSetup.deadlineStatus === "past") &&
        atSetup.canSaveDraft === false &&
        atSetup.canSubmit === false,
      "deadlineStatus=at (or past if >1s elapsed), blocked",
      `status=${atSetup.deadlineStatus} lockAt=${atLock}`
    );

    await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, future);
    const refreshSetup = await rpc(captain.client, "team_tournament_get_setup", {
      p_tournament_id: PROBE.tournamentId,
      p_viewer_team_id: null,
    });

    record(
      report,
      "TT2B-06-refresh-restore-before",
      refreshSetup.deadlineStatus === "before" && refreshSetup.canSubmit === true,
      "reload after lock restore → before",
      `status=${refreshSetup.deadlineStatus}`
    );

    record(
      report,
      "TT2B-07-serverTime-present",
      Boolean(refreshSetup.serverTime),
      "serverTime on every get_setup",
      refreshSetup.serverTime || "missing"
    );

    record(
      report,
      "TT2B-08-viewer-team-resolved",
      refreshSetup.viewerTeamId === PROBE.teamA,
      "viewerTeamId derived from auth",
      refreshSetup.viewerTeamId || "null"
    );

    const { data: helperAt, error: helperError } = await admin.rpc(
      "team_tournament_lineup_deadline_fields",
      {
        p_lineup_lock_at: refreshSetup.serverTime,
        p_matchup_status: "lineup_open",
        p_lineup_status: "draft",
        p_lineup_locked_at: null,
      }
    );

    record(
      report,
      "TT2B-09-at-boundary-helper",
      !helperError &&
        (helperAt?.deadlineStatus === "at" || helperAt?.deadlineStatus === "past") &&
        helperAt?.canSaveDraft === false &&
        helperAt?.canSubmit === false,
      "SQL helper blocks at exact server now() boundary",
      helperError?.message || JSON.stringify(helperAt)
    );
  } finally {
    if (originalLockAt != null) {
      try {
        await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, originalLockAt);
      } catch (restoreError) {
        report.restoreError = restoreError.message;
        console.warn(`⚠️  restore lineup_lock_at failed: ${restoreError.message}`);
      }
    }
  }

  const failed = report.cases.filter((c) => !c.pass);
  report.verdict = failed.length === 0 ? "READY FOR TT-2C" : "NOT READY FOR TT-2C";
  report.failedCount = failed.length;
  report.passCount = report.cases.length - failed.length;

  fs.mkdirSync(evidenceDir, { recursive: true });
  const outPath = path.join(evidenceDir, args.reportFile);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outPath}`);
  console.log(`Verdict: ${report.verdict}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
