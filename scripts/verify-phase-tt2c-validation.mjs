/**
 * Phase TT-2C — Server-side lineup validation verification (staging).
 *
 * Usage:
 *   node scripts/prep-tt2c-staging-player-genders.mjs
 *   node scripts/verify-phase-tt2c-validation.mjs
 *   node scripts/verify-phase-tt2c-validation.mjs --report=docs/v5/qa-evidence/phase-tt2/TT2C_VALIDATION_REPORT.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  validateLineupSelectionsStructured,
} from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { LINEUP_VALIDATION_CODE } from "../src/features/team-tournament/engines/lineupValidationContract.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/phase-tt2");

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  teamA: "phase23d-team-a",
  teamB: "phase23d-team-b",
  matchupId: "phase23d-matchup-1",
};

const CAPTAIN_EMAIL = process.env.STAGING_CAPTAIN_A_EMAIL || "player@staging.local";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

const PLAYERS = [
  { id: "player-staging-a-1", name: "A1", gender: "Nam" },
  { id: "player-staging-a-2", name: "A2", gender: "Nữ" },
  { id: "player-staging-a-3", name: "A3", gender: "Nam" },
  { id: "player-staging-a-4", name: "A4", gender: "Nữ" },
  { id: "player-staging-a-5", name: "A5", gender: "Nữ" },
  { id: "player-staging-a-6", name: "A6", gender: "Nam" },
  { id: "player-staging-a-7", name: "A7", gender: "Nam" },
  { id: "player-staging-a-8", name: "A8", gender: "Nữ" },
];

const VALID_SELECTIONS = {
  "disc-men": ["player-staging-a-1", "player-staging-a-3"],
  "disc-women": ["player-staging-a-4", "player-staging-a-5"],
  "disc-mixed-1": ["player-staging-a-6", "player-staging-a-8"],
  "disc-mixed-2": ["player-staging-a-7", "player-staging-a-2"],
};

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir });
  return r.stdout?.trim() || null;
}

function parseArgs(argv) {
  return {
    reportFile:
      argv.find((a) => a.startsWith("--report="))?.split("=")[1] ||
      "TT2C_VALIDATION_REPORT.json",
    skipPrep: argv.includes("--skip-prep"),
  };
}

function createReport() {
  return {
    generatedAt: new Date().toISOString(),
    phase: "TT-2C",
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    sqlPatches: [
      "docs/v5/PHASE_TT2C_LINEUP_VALIDATION.sql",
      "docs/v5/PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql",
    ],
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
  const { data: header } = await admin
    .from("team_tournaments")
    .select("id")
    .eq("tournament_id", tournamentId)
    .maybeSingle();

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

function buildTeamDataFromSetup(setup) {
  const tournament = setup?.tournament;
  const teamData = tournament?.teamData;
  if (!teamData) {
    return null;
  }
  return {
    ...teamData,
    settings: {
      allowPlayerReusePerMatchup: false,
      ...(teamData.settings || {}),
    },
  };
}

function expectParity(clientResult, serverCode, caseId) {
  return clientResult?.code === serverCode;
}

async function main() {
  loadProjectEnv();
  const args = parseArgs(process.argv.slice(2));
  const report = createReport();

  if (!args.skipPrep) {
    const prep = spawnSync("node", ["scripts/prep-tt2c-staging-player-genders.mjs"], {
      cwd: rootDir,
      encoding: "utf8",
    });
    record(
      report,
      "TT2C-00-prep-genders",
      prep.status === 0,
      "profiles.gender seeded for probe players",
      prep.status === 0 ? "ok" : "failed",
      prep.stderr?.trim() || prep.stdout?.trim() || ""
    );
  }

  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging URL (expected ${STAGING_REF})`);
  }
  if (!serviceKey) {
    report.verdict = "NOT READY FOR TT-2D";
    report.blocker = "Missing STAGING_SUPABASE_SERVICE_ROLE_KEY";
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, args.reportFile), JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let authClient = anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const captain = await signIn(authClient, CAPTAIN_EMAIL, QA_PASSWORD);
  if (!captain.client) {
    report.verdict = "NOT READY FOR TT-2D";
    report.blocker = `Captain sign-in failed: ${captain.error}`;
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, args.reportFile), JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const { data: originalRow } = await admin
    .from("team_tournaments")
    .select("id, team_tournament_matchups(lineup_lock_at, external_matchup_id)")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();

  const originalLockAt =
    originalRow?.team_tournament_matchups?.find((m) => m.external_matchup_id === PROBE.matchupId)
      ?.lineup_lock_at || null;

  const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, future);

  const setup = await rpc(captain.client, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
    p_viewer_team_id: null,
  });

  const teamData = buildTeamDataFromSetup(setup);
  const tournamentVersion = setup?.tournament?.version ?? null;

  async function saveDraft(selections, idempotencyKey, expectedVersion = null) {
    return rpc(captain.client, "team_tournament_save_lineup_draft", {
      p_tournament_id: PROBE.tournamentId,
      p_matchup_id: PROBE.matchupId,
      p_team_id: PROBE.teamA,
      p_selections: selections,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }
  record(
    report,
    "TT2C-01-setup-loaded",
    setup.ok === true && Boolean(teamData),
    "team_tournament_get_setup returns teamData",
    setup.ok ? "ok" : setup.code || setup.error
  );

  const { data: genderProbe, error: genderError } = await admin.rpc(
    "team_tournament_resolve_player_gender_key",
    {
      p_player_id: "player-staging-a-1",
      p_tenant_id: setup?.tournament?.tenantId || "venue-staging-a",
      p_club_id: setup?.tournament?.clubId || "club-staging-demo",
    }
  );

  record(
    report,
    "TT2C-02-gender-source",
    !genderError && genderProbe === "male",
    "profiles.gender resolves to male for player-staging-a-1",
    genderError ? genderError.message : String(genderProbe)
  );

  const validDraft = await saveDraft(VALID_SELECTIONS, `tt2c-valid-draft-${Date.now()}`);

  record(
    report,
    "TT2C-03-valid-draft-save",
    validDraft.ok === true,
    "valid lineup draft saves on server",
    validDraft.code || (validDraft.ok ? "ok" : validDraft.error)
  );

  const partialDraft = await saveDraft(
    { "disc-men": ["player-staging-a-1"] },
    `tt2c-partial-draft-${Date.now()}`,
    validDraft.version ?? tournamentVersion
  );

  record(
    report,
    "TT2C-04-partial-draft-allowed",
    partialDraft.ok === true,
    "incomplete draft allowed (basic scope checks pass)",
    partialDraft.code || (partialDraft.ok ? "ok" : partialDraft.error)
  );

  const outsiderSelections = {
    ...VALID_SELECTIONS,
    "disc-men": ["player-staging-b-1", "player-staging-b-3"],
  };
  const clientOutsider = validateLineupSelectionsStructured({
    teamData,
    teamId: PROBE.teamA,
    selections: outsiderSelections,
    players: PLAYERS,
  });
  const serverOutsider = await saveDraft(
    outsiderSelections,
    `tt2c-outsider-${Date.now()}`,
    partialDraft.version ?? validDraft.version ?? tournamentVersion
  );

  record(
    report,
    "TT2C-05-player-not-in-team",
    !clientOutsider.ok &&
      clientOutsider.code === LINEUP_VALIDATION_CODE.PLAYER_NOT_IN_TEAM &&
      serverOutsider.ok === false &&
      serverOutsider.code === "player_not_in_team" &&
      expectParity(clientOutsider, serverOutsider.code, "TT2C-05"),
    "client+server reject outsider player",
    `client=${clientOutsider.code} server=${serverOutsider.code}`
  );

  const badGenderSelections = {
    ...VALID_SELECTIONS,
    "disc-men": ["player-staging-a-4", "player-staging-a-5"],
  };
  const clientGender = validateLineupSelectionsStructured({
    teamData,
    teamId: PROBE.teamA,
    selections: badGenderSelections,
    players: PLAYERS,
  });
  const serverGender = await saveDraft(
    badGenderSelections,
    `tt2c-gender-${Date.now()}`,
    tournamentVersion
  );

  record(
    report,
    "TT2C-06-invalid-gender",
    !clientGender.ok &&
      clientGender.code === LINEUP_VALIDATION_CODE.INVALID_GENDER &&
      serverGender.ok === false &&
      serverGender.code === "invalid_gender" &&
      expectParity(clientGender, serverGender.code, "TT2C-06"),
    "client+server reject wrong gender in men's doubles",
    `client=${clientGender.code} server=${serverGender.code}`
  );

  const duplicateWithin = {
    "disc-men": ["player-staging-a-1", "player-staging-a-1"],
  };
  const clientDup = validateLineupSelectionsStructured({
    teamData,
    teamId: PROBE.teamA,
    selections: duplicateWithin,
    players: PLAYERS,
    partial: true,
  });
  const serverDup = await saveDraft(
    duplicateWithin,
    `tt2c-dup-within-${Date.now()}`,
    tournamentVersion
  );

  record(
    report,
    "TT2C-07-duplicate-player-slot",
    !clientDup.ok &&
      clientDup.code === LINEUP_VALIDATION_CODE.DUPLICATE_PLAYER &&
      serverDup.ok === false &&
      serverDup.code === "duplicate_player" &&
      expectParity(clientDup, serverDup.code, "TT2C-07"),
    "client+server reject duplicate within discipline",
    `client=${clientDup.code} server=${serverDup.code}`
  );

  const crossReuse = {
    "disc-men": ["player-staging-a-1", "player-staging-a-3"],
    "disc-women": ["player-staging-a-1", "player-staging-a-4"],
  };
  const clientCross = validateLineupSelectionsStructured({
    teamData,
    teamId: PROBE.teamA,
    selections: crossReuse,
    players: PLAYERS,
    partial: true,
  });
  const serverCross = await saveDraft(
    crossReuse,
    `tt2c-cross-${Date.now()}`,
    tournamentVersion
  );

  record(
    report,
    "TT2C-08-cross-discipline-duplicate",
    !clientCross.ok &&
      clientCross.code === LINEUP_VALIDATION_CODE.DUPLICATE_PLAYER &&
      serverCross.ok === false &&
      serverCross.code === "duplicate_player" &&
      expectParity(clientCross, serverCross.code, "TT2C-08"),
    "client+server reject reuse when allowPlayerReuse=false",
    `client=${clientCross.code} server=${serverCross.code}`
  );

  const incompleteSubmit = await rpc(captain.client, "team_tournament_submit_lineup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: PROBE.teamA,
    p_selections: { "disc-men": ["player-staging-a-1", "player-staging-a-3"] },
    p_expected_version: tournamentVersion,
    p_idempotency_key: `tt2c-incomplete-submit-${Date.now()}`,
  });

  record(
    report,
    "TT2C-09-submit-incomplete",
    incompleteSubmit.ok === false && incompleteSubmit.code === "lineup_incomplete",
    "submit rejects incomplete lineup",
    incompleteSubmit.code || incompleteSubmit.error
  );

  const overLimit = {
    "disc-men": ["player-staging-a-1", "player-staging-a-3", "player-staging-a-6"],
  };
  const serverOver = await saveDraft(
    overLimit,
    `tt2c-over-${Date.now()}`,
    tournamentVersion
  );

  record(
    report,
    "TT2C-10-roster-limit-exceeded",
    serverOver.ok === false && serverOver.code === "roster_limit_exceeded",
    "draft rejects too many players in discipline",
    serverOver.code || serverOver.error
  );

  const contractShape = serverGender?.fieldErrors !== undefined &&
    serverGender?.invalidPlayerIds !== undefined &&
    serverGender?.serverTime !== undefined;

  record(
    report,
    "TT2C-11-validation-contract",
    contractShape,
    "server returns fieldErrors + invalidPlayerIds + serverTime",
    JSON.stringify({
      fieldErrors: Boolean(serverGender?.fieldErrors),
      invalidPlayerIds: Array.isArray(serverGender?.invalidPlayerIds),
      serverTime: Boolean(serverGender?.serverTime),
    })
  );

  if (originalLockAt) {
    await setMatchupLockAt(admin, PROBE.tournamentId, PROBE.matchupId, originalLockAt);
  }

  const failed = report.cases.filter((item) => !item.pass);
  report.verdict = failed.length === 0 ? "READY FOR TT-2D" : "NOT READY FOR TT-2D";
  report.summary = {
    total: report.cases.length,
    passed: report.cases.length - failed.length,
    failed: failed.length,
  };

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, args.reportFile), JSON.stringify(report, null, 2));

  console.log(`\nVerdict: ${report.verdict} (${report.summary.passed}/${report.summary.total})`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
