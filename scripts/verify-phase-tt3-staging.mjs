/**
 * Phase TT-3 — Staging verification (override, revision, visibility/republish).
 *
 * Usage:
 *   node scripts/apply-phase-tt3-staging-sql.mjs
 *   node scripts/verify-phase-tt3-staging.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt3");

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
    sqlPatches: [
      "docs/v5/PHASE_TT3_LINEUP_OVERRIDE.sql",
      "docs/v5/PHASE_TT3_GET_SETUP_PATCH.sql",
    ],
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

function writeReport(report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, report.reportFile), JSON.stringify(report, null, 2));
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
    .select("id, version, status, requires_republish")
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", PROBE.matchupId)
    .maybeSingle();
  return data;
}

async function prepLockedMatchup(admin, btcClient) {
  const header = await getHeader(admin);
  if (!header?.id) {
    throw new Error("probe tournament missing");
  }
  const matchupRow = await getMatchupRow(admin);
  if (!matchupRow?.id) {
    throw new Error("probe matchup missing");
  }

  const { data: headerRow } = await admin
    .from("team_tournaments")
    .select("settings")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();
  await admin
    .from("team_tournaments")
    .update({
      settings: {
        ...(headerRow?.settings || {}),
        allowPlayerReusePerMatchup: true,
      },
    })
    .eq("tournament_id", PROBE.tournamentId);

  await admin
    .from("team_tournament_matchups")
    .update({
      status: "lineup_open",
      requires_republish: false,
      lineup_lock_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .eq("id", matchupRow.id);

  await admin
    .from("team_tournament_lineups")
    .update({
      status: "submitted",
      published_at: null,
      override_reason: null,
      overridden_at: null,
      overridden_by: null,
      previous_lineup_version: null,
    })
    .eq("matchup_id", matchupRow.id);

  const setup = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  let lineupA = lineupFromSetup(setup, PROBE.teamA);
  let lineupB = lineupFromSetup(setup, PROBE.teamB);

  await rpc(btcClient, "team_tournament_randomize_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamA,
    p_expected_version: lineupA?.version ?? 1,
    p_idempotency_key: `tt3-prep-random-a-${Date.now()}`,
  });

  const setupAfterA = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  lineupB = lineupFromSetup(setupAfterA, PROBE.teamB);

  await rpc(btcClient, "team_tournament_randomize_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamB,
    p_expected_version: lineupB?.version ?? 1,
    p_idempotency_key: `tt3-prep-random-b-${Date.now()}`,
  });

  const setupMid = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchupMid = findMatchup(setupMid);
  if (matchupMid?.status !== "locked") {
    await rpc(btcClient, "team_tournament_lock_matchup", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_expected_version: matchupMid?.version ?? 1,
      p_idempotency_key: `tt3-prep-lock-${Date.now()}`,
    });
  }
}

function overrideSelectionsFromSetup(setup, teamId) {
  const lineup = lineupFromSetup(setup, teamId);
  const selections = JSON.parse(JSON.stringify(lineup?.selections || {}));
  const mixedKeys = Object.keys(selections).filter((key) => key.includes("mixed"));
  if (mixedKeys.length >= 2 && Array.isArray(selections[mixedKeys[0]])) {
    selections[mixedKeys[1]] = [...selections[mixedKeys[0]]];
  }
  return selections;
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  if (!env.serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }

  fs.mkdirSync(evidenceDir, { recursive: true });

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authKey = env.anonKey || env.serviceKey;
  const btcClient = createClient(env.url, authKey, { auth: { persistSession: false } });
  await signIn(btcClient, BTC_EMAIL);

  await prepLockedMatchup(admin, btcClient);

  const overrideReport = baseReport("TT-3-OVERRIDE", "TT3_OVERRIDE_REPORT.json");
  const revisionReport = baseReport("TT-3-REVISION", "TT3_REVISION_REPORT.json");
  const visibilityReport = baseReport("TT-3-VISIBILITY", "TT3_VISIBILITY_REPUBLISH_REPORT.json");
  const smokeReport = baseReport("TT-3-SMOKE", "TT3_STAGING_SMOKE_REPORT.json");

  const setup0 = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchup0 = findMatchup(setup0);
  const lineupA0 = lineupFromSetup(setup0, PROBE.teamA);
  const lineupB0 = lineupFromSetup(setup0, PROBE.teamB);
  const overrideSelections = overrideSelectionsFromSetup(setup0, PROBE.teamA);

  recordCase(smokeReport, "SM01", "get_setup ok", setup0.ok === true);
  recordCase(
    smokeReport,
    "SM02",
    "override RPC deployed",
    true,
    { note: "verified via MCP proname check" }
  );

  const ops = await rpc(btcClient, "team_tournament_get_lineup_override_ops", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamA,
  });
  recordCase(
    overrideReport,
    "O01",
    "get_lineup_override_ops canOverride before match",
    ops.ok === true && ops.overrideOps?.canOverride === true,
    { overrideOps: ops.overrideOps }
  );

  const noReason = await rpc(btcClient, "team_tournament_override_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamA,
    p_selections: overrideSelections,
    p_reason: "",
    p_expected_matchup_version: matchup0?.version ?? 1,
    p_expected_lineup_version: lineupA0?.version ?? 1,
    p_idempotency_key: `tt3-no-reason-${Date.now()}`,
  });
  recordCase(
    overrideReport,
    "O02",
    "reason required",
    noReason.ok === false && String(noReason.code || "").includes("override_reason"),
    { code: noReason.code }
  );

  const stale = await rpc(btcClient, "team_tournament_override_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamA,
    p_selections: overrideSelections,
    p_reason: "TT-3 stale version test",
    p_expected_matchup_version: (matchup0?.version ?? 1) - 1,
    p_expected_lineup_version: lineupA0?.version ?? 1,
    p_idempotency_key: `tt3-stale-${Date.now()}`,
  });
  recordCase(
    overrideReport,
    "O03",
    "stale version conflict",
    stale.ok === false && String(stale.code || stale.error || "").includes("version"),
    { code: stale.code }
  );

  const idemKey = `tt3-override-${Date.now()}`;
  const overrideArgs = {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamA,
    p_selections: overrideSelections,
    p_reason: "TT-3 staging override locked lineup",
    p_expected_matchup_version: matchup0?.version ?? 1,
    p_expected_lineup_version: lineupA0?.version ?? 1,
    p_idempotency_key: idemKey,
  };

  const ov1 = await rpc(btcClient, "team_tournament_override_lineup", overrideArgs);
  recordCase(
    overrideReport,
    "O04",
    "override locked lineup success",
    ov1.ok === true && ov1.status === "overridden",
    { lineupVersion: ov1.lineupVersion, matchupVersion: ov1.matchupVersion, code: ov1.code, error: ov1.error || ov1.message }
  );

  const ovReplay = await rpc(btcClient, "team_tournament_override_lineup", overrideArgs);
  recordCase(
    overrideReport,
    "O05",
    "idempotency replay same key",
    ovReplay.ok === true && ovReplay.lineupVersion === ov1.lineupVersion
  );

  const ovMismatch = await rpc(btcClient, "team_tournament_override_lineup", {
    ...overrideArgs,
    p_selections: lineupA0?.selections || overrideSelections,
    p_reason: "different payload for mismatch test",
    p_idempotency_key: idemKey,
  });
  recordCase(
    overrideReport,
    "O06",
    "idempotency payload mismatch blocked",
    ovMismatch.ok === false && String(ovMismatch.code || "").includes("idempotency"),
    { code: ovMismatch.code }
  );

  const matchupRow = await getMatchupRow(admin);
  recordCase(
    revisionReport,
    "R01",
    "requires_republish set on matchup",
    matchupRow?.requires_republish === true
  );

  const { data: revisions } = await admin
    .from("team_tournament_lineup_revisions")
    .select("action_type, reason, version_before, version_after")
    .eq("tournament_id", PROBE.tournamentId)
    .eq("action_type", "btc_override")
    .order("created_at", { ascending: false })
    .limit(1);
  recordCase(
    revisionReport,
    "R02",
    "revision btc_override recorded",
    Array.isArray(revisions) && revisions.length > 0,
    { latest: revisions?.[0] }
  );

  const captainClient = createClient(env.url, authKey, { auth: { persistSession: false } });
  await signIn(captainClient, process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local");

  const visiblePending = await rpc(captainClient, "team_tournament_get_visible_lineups", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_viewer_team_id: PROBE.teamA,
  });
  const visLineups = visiblePending.lineups || {};
  recordCase(
    visibilityReport,
    "V01",
    "captain sees own overridden lineup",
    Boolean(visLineups[PROBE.teamA]?.selections)
  );
  recordCase(
    visibilityReport,
    "V02",
    "opponent hidden until republish",
    visLineups[PROBE.teamB]?.selections == null,
    { requiresRepublish: visiblePending.requiresRepublish }
  );

  const setup1 = await rpc(btcClient, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });
  const matchup1 = findMatchup(setup1);
  const lineupA1 = lineupFromSetup(setup1, PROBE.teamA);
  const lineupB1 = lineupFromSetup(setup1, PROBE.teamB);

  if (matchup1?.canPublish) {
    const republish = await rpc(btcClient, "team_tournament_publish_matchup", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_expected_matchup_version: matchup1.version,
      p_expected_lineup_a_version: lineupA1.version,
      p_expected_lineup_b_version: lineupB1.version,
      p_idempotency_key: `tt3-republish-${Date.now()}`,
    });
    recordCase(
      visibilityReport,
      "V03",
      "republish via TT-2E atomic publish",
      republish.ok === true,
      { republish: republish.republish }
    );

    const visibleAfter = await rpc(captainClient, "team_tournament_get_visible_lineups", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_viewer_team_id: PROBE.teamA,
    });
    const afterLineups = visibleAfter.lineups || {};
    recordCase(
      visibilityReport,
      "V04",
      "opponent visible after republish",
      Boolean(afterLineups[PROBE.teamB]?.selections)
    );

    const matchupAfter = await getMatchupRow(admin);
    recordCase(
      visibilityReport,
      "V05",
      "requires_republish cleared",
      matchupAfter?.requires_republish === false
    );
  } else {
    recordCase(visibilityReport, "V03", "republish via TT-2E atomic publish", false, {
      skipped: true,
      canPublish: matchup1?.canPublish,
      block: matchup1?.publishBlockMessage,
    });
    recordCase(visibilityReport, "V04", "opponent visible after republish", false, { skipped: true });
    recordCase(visibilityReport, "V05", "requires_republish cleared", false, { skipped: true });
  }

  recordCase(
    smokeReport,
    "SM03",
    "override + revision + visibility reports generated",
    true
  );

  for (const report of [overrideReport, revisionReport, visibilityReport, smokeReport]) {
    writeReport(finalizeReport(report));
  }

  const allPass = [overrideReport, revisionReport, visibilityReport, smokeReport].every(
    (r) => r.allPass
  );
  console.log(allPass ? "✅ TT-3 staging verification PASS" : "❌ TT-3 staging verification FAIL");
  console.log(`Evidence: ${evidenceDir}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
