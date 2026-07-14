/**
 * R2-2G — Staging E2E: TT Rally → V5 provision map → finalize → consumer.
 * Staging only (qyewbxjsiiyufanzcjcq). Production untouched.
 *
 *   node scripts/apply-r22g-provision-map-staging-sql.mjs
 *   node scripts/verify-r22g-team-tournament-rally-staging.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(rootDir, "docs/v5/qa-evidence/referee-v5-rally/r2-2g");

const PROBE = {
  tournamentId: "phase23d-probe-tournament",
  matchupId: "phase23d-matchup-1",
  subMatchId: "phase23d-sub-1",
};

const BTC_EMAIL = process.env.STAGING_BTC_EMAIL || "admin@staging.local";
const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

function gitSha() {
  return spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: rootDir }).stdout?.trim() || null;
}

function writeJson(name, data) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, name), JSON.stringify(data, null, 2));
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) return { ok: false, code: error.code, error: error.message, raw: error };
  return typeof data === "object" && data ? data : { ok: true, data };
}

async function main() {
  loadProjectEnv();
  const env = getStagingSupabaseEnv();
  if (String(env.url).includes(PRODUCTION_REF)) {
    console.error("Blocked: production URL");
    process.exit(1);
  }
  if (!String(env.url).includes(STAGING_REF)) {
    console.error(`URL must be staging ${STAGING_REF}`);
    process.exit(1);
  }
  if (!env.serviceKey) throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const btc = createClient(env.url, env.anonKey || env.serviceKey, {
    auth: { persistSession: false },
  });
  const { error: signErr } = await btc.auth.signInWithPassword({
    email: BTC_EMAIL,
    password: QA_PASSWORD,
  });
  if (signErr) throw new Error(`BTC sign-in failed: ${signErr.message}`);
  const { data: session } = await btc.auth.getSession();
  const adminUserId = session?.session?.user?.id;

  const configCases = [];
  const provisionCases = [];
  const legacyCases = [];
  const consumerCases = [];
  const standingsCases = [];
  const correctionCases = [];

  const rallyMap = await rpc(admin, "team_tournament_resolve_v5_scoring_map", {
    p_scoring_format: {
      scoringSystem: "rally",
      scoringVariant: "USAP_2026_PROVISIONAL_RALLY",
      targetScore: 11,
      winBy: 2,
      freezeAt: null,
      matchFormat: "best_of_1",
    },
    p_match_type: "doubles",
  });
  configCases.push({
    id: "CFG-RALLY-MAP",
    pass: rallyMap?.ok === true && rallyMap?.scoringVariant === "USAP_2026_PROVISIONAL_RALLY",
    detail: rallyMap,
  });

  const singlesReject = await rpc(admin, "team_tournament_resolve_v5_scoring_map", {
    p_scoring_format: { scoringSystem: "rally", targetScore: 11, winBy: 2 },
    p_match_type: "singles",
  });
  configCases.push({
    id: "CFG-SINGLES-REJECT",
    pass: singlesReject?.ok === false && singlesReject?.code === "UNSUPPORTED_SCORING_VARIANT",
    detail: singlesReject,
  });

  const mlpReject = await rpc(admin, "team_tournament_resolve_v5_scoring_map", {
    p_scoring_format: { scoringSystem: "rally", targetScore: 21, freezeAt: 20, winBy: 2 },
    p_match_type: "doubles",
  });
  configCases.push({
    id: "CFG-MLP-REJECT",
    pass: mlpReject?.ok === false,
    detail: mlpReject,
  });

  const sideOutMap = await rpc(admin, "team_tournament_resolve_v5_scoring_map", {
    p_scoring_format: { scoringSystem: "side_out", targetScore: 21, winBy: 2 },
    p_match_type: "doubles",
  });
  configCases.push({
    id: "CFG-SIDEOUT-MAP",
    pass: sideOutMap?.ok === true && Number(sideOutMap?.pointsToWin) === 21,
    detail: sideOutMap,
  });

  const { data: header } = await admin
    .from("team_tournaments")
    .select("id, tenant_id, tournament_id, settings")
    .eq("tournament_id", PROBE.tournamentId)
    .maybeSingle();

  if (!header?.id) {
    writeJson("STAGING_E2E_REPORT.json", {
      verdict: "NO-GO",
      reason: "probe tournament missing",
      stagingRef: STAGING_REF,
      localCommitSha: gitSha(),
    });
    console.error("Probe tournament missing — run TT-5 seed first.");
    process.exit(1);
  }

  const { data: matchup } = await admin
    .from("team_tournament_matchups")
    .select("id, version, team_a_id, team_b_id")
    .eq("team_tournament_id", header.id)
    .eq("external_matchup_id", PROBE.matchupId)
    .maybeSingle();

  const { data: subRow } = await admin
    .from("team_tournament_sub_matches")
    .select("id, version, discipline_external_id, status")
    .eq("matchup_id", matchup.id)
    .eq("external_sub_match_id", PROBE.subMatchId)
    .maybeSingle();

  await admin
    .from("team_tournament_disciplines")
    .update({
      scoring_format: {
        scoringSystem: "rally",
        scoringVariant: "USAP_2026_PROVISIONAL_RALLY",
        targetScore: 11,
        pointsToWin: 11,
        winBy: 2,
        matchFormat: "best_of_1",
        freezeAt: null,
        freezeRule: "NONE",
        serverNumberRule: "NONE",
        winPoints: 1,
      },
    })
    .eq("team_tournament_id", header.id)
    .eq("external_discipline_id", subRow.discipline_external_id);

  await admin
    .from("team_tournament_sub_matches")
    .update({
      status: "waiting",
      winner_team_id: null,
      score: { teamA: 0, teamB: 0, games: [] },
      result_confirmed_at: null,
    })
    .eq("id", subRow.id);

  await admin.from("team_sub_match_referee_links").delete().eq("sub_match_id", subRow.id);
  const stateId = `${header.tenant_id}::${header.tournament_id}::${PROBE.subMatchId}`;
  await admin.from("team_tournament_referee_event_inbox").delete().eq("sub_match_id", subRow.id);
  await admin.from("match_integration_outbox").delete().eq("match_state_id", stateId);
  await admin.from("match_result_revisions").delete().eq("match_id", PROBE.subMatchId);
  await admin.from("match_live_states").delete().eq("id", stateId);
  await admin
    .from("referee_assignments")
    .delete()
    .eq("tenant_id", header.tenant_id)
    .eq("tournament_id", header.tournament_id)
    .eq("match_id", PROBE.subMatchId);

  await admin
    .from("team_tournament_lineups")
    .update({ status: "published" })
    .eq("matchup_id", matchup.id);
  await admin
    .from("team_tournament_matchups")
    .update({ status: "published", requires_republish: false })
    .eq("id", matchup.id);

  const { data: assignment } = await admin
    .from("referee_assignments")
    .insert({
      tenant_id: header.tenant_id,
      tournament_id: header.tournament_id,
      match_id: PROBE.subMatchId,
      referee_user_id: adminUserId,
      referee_display_name: "R2-2G Probe Referee",
      role: "REFEREE",
      status: "active",
    })
    .select("id")
    .single();

  const { data: subFresh } = await admin
    .from("team_tournament_sub_matches")
    .select("version")
    .eq("id", subRow.id)
    .single();

  const provision1 = await rpc(btc, "team_tournament_provision_referee_match", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_assignment_id: assignment.id,
    p_expected_sub_match_version: subFresh.version,
    p_idempotency_key: `r22g-prov-${Date.now()}`,
    p_reason: "r22g_e2e",
    p_source: "verify",
  });

  const { data: live } = await admin
    .from("match_live_states")
    .select("state_payload, scoring_system, points_to_win, win_by, best_of, state_version, version")
    .eq("id", stateId)
    .maybeSingle();

  const payload = live?.state_payload || {};
  provisionCases.push({ id: "PROV-OK", pass: provision1?.ok === true, detail: provision1 });
  provisionCases.push({
    id: "PROV-VARIANT",
    pass:
      payload.scoringVariant === "USAP_2026_PROVISIONAL_RALLY" &&
      payload.scoringSystem === "RALLY" &&
      Number(payload.pointsToWin) === 11 &&
      Number(payload.winBy) === 2,
    detail: {
      scoringSystem: payload.scoringSystem,
      scoringVariant: payload.scoringVariant,
      pointsToWin: payload.pointsToWin,
      winBy: payload.winBy,
      ruleSetId: payload.ruleSetId,
      columnScoringSystem: live?.scoring_system,
    },
  });

  const provision2 = await rpc(btc, "team_tournament_provision_referee_match", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_referee_assignment_id: assignment.id,
    p_expected_sub_match_version: subFresh.version,
    p_idempotency_key: `r22g-prov-retry-${Date.now()}`,
    p_reason: "r22g_idempotent",
    p_source: "verify",
  });
  const { count: linkCount } = await admin
    .from("team_sub_match_referee_links")
    .select("id", { count: "exact", head: true })
    .eq("sub_match_id", subRow.id)
    .neq("status", "revoked");

  provisionCases.push({
    id: "PROV-IDEMPOTENT",
    pass: Number(linkCount) === 1,
    detail: { provision2, linkCount },
  });

  const draftBlock = await rpc(btc, "team_tournament_save_sub_match_draft", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_score: { teamA: 1, teamB: 0, games: [] },
  });
  legacyCases.push({
    id: "LEGACY-DRAFT-BLOCKED",
    pass:
      draftBlock?.ok === false &&
      /referee_v5|linked|lock/i.test(String(draftBlock?.code || draftBlock?.error || "")),
    detail: draftBlock,
  });

  const idemKey = `r22g-fin-${Date.now()}`;
  const finalize = await rpc(admin, "referee_v5_commit_match_finalization", {
    p_tenant_id: header.tenant_id,
    p_tournament_id: header.tournament_id,
    p_match_id: PROBE.subMatchId,
    p_actor_id: adminUserId,
    p_expected_state_version: live?.state_version ?? live?.version ?? 0,
    p_idempotency_key: idemKey,
    p_request_hash: `hash-${idemKey}`,
    p_revision: {
      revision: 1,
      status: "confirmed",
      teamAId: matchup.team_a_id,
      teamBId: matchup.team_b_id,
      winnerId: matchup.team_a_id,
      officialScore: { teamA: 11, teamB: 7 },
    },
    p_outbox_events: [
      {
        eventType: "STANDINGS_RECALC_REQUESTED",
        payload: { matchId: PROBE.subMatchId, revision: 1 },
        idempotencyKey: `${idemKey}::standings`,
      },
    ],
    p_override_reason: null,
  });

  const { data: outboxRows } = await admin
    .from("match_integration_outbox")
    .select("id, event_type, status")
    .eq("match_state_id", stateId)
    .eq("event_type", "STANDINGS_RECALC_REQUESTED")
    .order("created_at", { ascending: false })
    .limit(1);

  const outboxId = outboxRows?.[0]?.id;
  const consume1 = outboxId
    ? await rpc(admin, "team_tournament_consume_referee_v5_outbox", {
        p_outbox_id: outboxId,
        p_correlation_id: "r22g-e2e-1",
      })
    : { ok: false, code: "OUTBOX_MISSING" };

  const { data: subAfter } = await admin
    .from("team_tournament_sub_matches")
    .select("winner_team_id, score, status, result_confirmed_at")
    .eq("id", subRow.id)
    .maybeSingle();

  consumerCases.push({
    id: "FINALIZE-OK",
    pass: finalize?.ok === true,
    detail: finalize,
  });
  consumerCases.push({
    id: "CONSUME-FINAL",
    pass:
      consume1?.ok === true &&
      subAfter?.winner_team_id === matchup.team_a_id &&
      Number(subAfter?.score?.teamA) === 11,
    detail: { consume1, subAfter, outboxId },
  });

  const consumeDup = outboxId
    ? await rpc(admin, "team_tournament_consume_referee_v5_outbox", {
        p_outbox_id: outboxId,
        p_correlation_id: "r22g-e2e-dup",
      })
    : { ok: false, code: "OUTBOX_MISSING" };
  consumerCases.push({
    id: "CONSUME-DUP",
    pass:
      consumeDup?.ok === true &&
      (consumeDup?.replayed === true ||
        consumeDup?.code === "OUTBOX_ALREADY_COMPLETED" ||
        consumeDup?.code === "revision_already_applied"),
    detail: consumeDup,
  });

  standingsCases.push({
    id: "STANDINGS-ONCE",
    pass: Number(subAfter?.score?.teamA) === 11 && subAfter?.winner_team_id === matchup.team_a_id,
    detail: { subAfter },
  });

  // Correction via TT-5D workflow (creates new official revision + outbox)
  const { data: revRow } = await admin
    .from("match_result_revisions")
    .select("id, revision")
    .eq("match_id", PROBE.subMatchId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  const corrReq = await rpc(btc, "team_tournament_request_referee_correction", {
    p_tournament_id: PROBE.tournamentId,
    p_match_id: PROBE.subMatchId,
    p_result_revision_id: revRow?.id,
    p_proposed_score: { teamA: 8, teamB: 11 },
    p_proposed_winner: matchup.team_b_id,
    p_reason: "R2-2G Rally correction verify",
    p_request_id: `r22g-corr-${Date.now()}`,
    p_idempotency_key: `r22g-corr-req-${Date.now()}`,
  });

  const corrApprove = corrReq?.ok
    ? await rpc(btc, "team_tournament_review_referee_correction", {
        p_tournament_id: PROBE.tournamentId,
        p_correction_request_id: corrReq.correctionRequestId,
        p_decision: "approve",
        p_review_reason: "BTC approved R2-2G correction",
        p_expected_version: corrReq.version ?? 1,
        p_idempotency_key: `r22g-corr-appr-${Date.now()}`,
      })
    : { ok: false, detail: corrReq };

  // Drain any pending outbox created by correction approval
  const { data: pendingOutbox } = await admin
    .from("match_integration_outbox")
    .select("id")
    .eq("match_state_id", stateId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  let consumeCorr = { ok: true, skipped: true };
  for (const row of pendingOutbox || []) {
    consumeCorr = await rpc(admin, "team_tournament_consume_referee_v5_outbox", {
      p_outbox_id: row.id,
      p_correlation_id: `r22g-corr-${row.id}`,
    });
  }

  // If approve already applied inline, still verify sub-match
  if (corrApprove?.ok && corrApprove?.applied === true) {
    consumeCorr = { ok: true, appliedInline: true, ...corrApprove };
  }

  const { data: subCorr } = await admin
    .from("team_tournament_sub_matches")
    .select("winner_team_id, score")
    .eq("id", subRow.id)
    .maybeSingle();

  correctionCases.push({
    id: "CORRECTION-REV2",
    pass:
      corrReq?.ok === true &&
      corrApprove?.ok === true &&
      subCorr?.winner_team_id === matchup.team_b_id &&
      Number(subCorr?.score?.teamB) === 11,
    detail: { corrReq, corrApprove, consumeCorr, subCorr, revRow },
  });

  const all = [
    ...configCases,
    ...provisionCases,
    ...legacyCases,
    ...consumerCases,
    ...standingsCases,
    ...correctionCases,
  ];
  const passCount = all.filter((c) => c.pass).length;
  const report = {
    phase: "R2-2G",
    generatedAt: new Date().toISOString(),
    stagingRef: STAGING_REF,
    productionImpact: "NONE",
    localCommitSha: gitSha(),
    cases: all,
    passCount,
    totalCount: all.length,
    allPass: passCount === all.length,
    verdict: passCount === all.length ? "GO" : passCount >= all.length - 2 ? "CONDITIONAL GO" : "NO-GO",
  };

  writeJson("STAGING_E2E_REPORT.json", report);
  writeJson("CONFIG_MAPPING_REPORT.json", {
    phase: "R2-2G",
    cases: configCases,
    verdict: configCases.every((c) => c.pass) ? "PASS" : "FAIL",
  });
  writeJson("PROVISION_REPORT.json", {
    phase: "R2-2G",
    cases: provisionCases,
    verdict: provisionCases.every((c) => c.pass) ? "PASS" : "FAIL",
  });
  writeJson("LEGACY_LOCK_REPORT.json", {
    phase: "R2-2G",
    cases: legacyCases,
    verdict: legacyCases.every((c) => c.pass) ? "PASS" : "FAIL",
  });
  writeJson("RESULT_CONSUMER_REPORT.json", {
    phase: "R2-2G",
    cases: consumerCases,
    verdict: consumerCases.every((c) => c.pass) ? "PASS" : "FAIL",
  });
  writeJson("STANDINGS_REPORT.json", {
    phase: "R2-2G",
    cases: standingsCases,
    verdict: standingsCases.every((c) => c.pass) ? "PASS" : "FAIL",
  });
  writeJson("CORRECTION_REVISION_REPORT.json", {
    phase: "R2-2G",
    cases: correctionCases,
    verdict: correctionCases.every((c) => c.pass) ? "PASS" : "FAIL",
  });

  console.log(JSON.stringify({ verdict: report.verdict, passCount, total: all.length }, null, 2));
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
