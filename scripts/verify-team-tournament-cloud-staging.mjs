/**
 * Phase 23D — Team Tournament RLS/RPC probe (staging only).
 *
 * Probes authenticated JWT clients. KHÔNG dùng service_role để kết luận RLS.
 *
 * Usage:
 *   npm run verify:team-tournament-cloud
 *
 * Prerequisites:
 *   1. docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql applied on staging
 *   2. Seed probe data:
 *        npm run seed:team-tournament-cloud -- --blob-path=tests/fixtures/team-tournament-blob-probe.json
 *   3. Align captain profile player_id (xem docs/v5/PHASE_23D_TEAM_TOURNAMENT_SEED_RLS.md)
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";

const PROBE = {
  tournamentId:
    String(process.env.TEAM_TOURNAMENT_PROBE_TOURNAMENT_ID || "phase23d-probe-tournament").trim(),
  teamA: String(process.env.TEAM_TOURNAMENT_PROBE_TEAM_A || "phase23d-team-a").trim(),
  teamB: String(process.env.TEAM_TOURNAMENT_PROBE_TEAM_B || "phase23d-team-b").trim(),
  matchupId: String(process.env.TEAM_TOURNAMENT_PROBE_MATCHUP_ID || "phase23d-matchup-1").trim(),
  subMatchId: String(process.env.TEAM_TOURNAMENT_PROBE_SUB_MATCH_ID || "phase23d-sub-1").trim(),
};

const TEAM_TABLES = [
  "team_tournaments",
  "team_tournament_teams",
  "team_tournament_team_members",
  "team_tournament_disciplines",
  "team_tournament_matchups",
  "team_tournament_lineups",
  "team_tournament_lineup_entries",
  "team_tournament_sub_matches",
  "team_tournament_standings",
];

const results = [];

function record(id, status, detail) {
  results.push({ id, status, detail });
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function assertStagingUrl(url) {
  if (!String(url || "").includes(STAGING_REF)) {
    fail(`URL không phải staging ${STAGING_REF} — dừng.`);
  }
}

function isRlsBlocked(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("access_denied")
  );
}

function isForbiddenRpc(payload) {
  return payload?.ok === false && (payload?.code === "FORBIDDEN" || payload?.code === "NOT_AUTHENTICATED");
}

function isValidationRpc(payload) {
  return payload?.ok === false && (payload?.code === "VALIDATION" || payload?.code === "LOCKED");
}

async function signIn(url, anonKey, email, password) {
  if (!email || !password) {
    return { client: null, profile: null, error: "missing_credentials" };
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { client: null, profile: null, error: error.message };
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, email, role, venue_id, player_id, status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    return { client, profile: null, error: profileError.message };
  }
  return { client, profile, error: null };
}

async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }
  if (data && typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, data };
}

function lineupKey(matchupId, teamId) {
  return `${matchupId}::${teamId}`;
}

function probeLineupSelections(setup, teamId) {
  const lineups = setup?.tournament?.teamData?.lineups || {};
  const lineup = lineups[lineupKey(PROBE.matchupId, teamId)];
  return lineup?.selections ?? null;
}

async function probeAnonDenied(url, anonKey) {
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of TEAM_TABLES) {
    const { data, error } = await anon.from(table).select("id").limit(1);
    if (error && isRlsBlocked(error)) {
      record(`anon-${table}`, "PASS", "RLS blocked");
      ok(`anon ${table}: blocked`);
    } else if (!error && (data || []).length === 0) {
      record(`anon-${table}`, "PASS", "0 rows");
      ok(`anon ${table}: 0 rows`);
    } else if (!error) {
      record(`anon-${table}`, "FAIL", `read ${data.length} rows`);
      warn(`anon ${table}: FAIL — đọc được ${data.length} rows`);
    } else {
      record(`anon-${table}`, "PARTIAL", error.message);
      warn(`anon ${table}: ${error.message}`);
    }
  }
}

async function probeAdminSetup(client, label) {
  const payload = await rpc(client, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });

  if (payload.ok && payload.tournament?.id === PROBE.tournamentId) {
    record(`${label}-get-setup`, "PASS", "admin sees tournament");
    ok(`${label} get_setup: OK (${(payload.tournament?.teamData?.teams || []).length} teams)`);
    return payload;
  }

  if (isForbiddenRpc(payload)) {
    record(`${label}-get-setup`, "FAIL", payload.code);
    warn(`${label} get_setup: FORBIDDEN — cần team.manage / tournament.update`);
  } else {
    record(`${label}-get-setup`, "PARTIAL", payload.error || payload.code || "unknown");
    warn(`${label} get_setup: ${payload.error || payload.code || "not found"} — chạy seed trước?`);
  }
  return null;
}

async function probeAdminManageTeam(client, label) {
  const payload = await rpc(client, "team_tournament_save_team", {
    p_tournament_id: PROBE.tournamentId,
    p_team: {
      id: PROBE.teamA,
      name: "Probe Team A",
      color: "#1976d2",
      playerIds: [],
      captainPlayerId: "player-staging-a-1",
    },
  });

  if (payload.ok) {
    record(`${label}-save-team`, "PASS", "admin manage team");
    ok(`${label} save_team: OK`);
    return;
  }

  if (isForbiddenRpc(payload)) {
    record(`${label}-save-team`, "FAIL", payload.code);
    warn(`${label} save_team: FORBIDDEN`);
  } else {
    record(`${label}-save-team`, "PARTIAL", payload.error || payload.code);
    warn(`${label} save_team: ${payload.error || payload.code}`);
  }
}

async function probeCaptainOwnLineup(client, label, teamId, selections) {
  const payload = await rpc(client, "team_tournament_save_lineup_draft", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: teamId,
    p_selections: selections,
  });

  if (payload.ok) {
    record(`${label}-save-own-lineup`, "PASS", teamId);
    ok(`${label} save_lineup_draft own team (${teamId}): OK`);
    return true;
  }

  if (isForbiddenRpc(payload)) {
    record(`${label}-save-own-lineup`, "FAIL", `${teamId} FORBIDDEN`);
    warn(`${label} save_lineup_draft own (${teamId}): FORBIDDEN — kiểm tra player_id profile`);
  } else {
    record(`${label}-save-own-lineup`, "PARTIAL", payload.error || payload.code);
    warn(`${label} save_lineup_draft own (${teamId}): ${payload.error || payload.code}`);
  }
  return false;
}

async function probeCaptainOtherLineupBlocked(client, label, otherTeamId, selections) {
  const payload = await rpc(client, "team_tournament_save_lineup_draft", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_team_id: otherTeamId,
    p_selections: selections,
  });

  if (isForbiddenRpc(payload)) {
    record(`${label}-save-other-lineup`, "PASS", "FORBIDDEN");
    ok(`${label} save_lineup_draft other team: blocked`);
    return;
  }

  if (payload.ok) {
    record(`${label}-save-other-lineup`, "FAIL", "unexpected OK");
    warn(`${label} save_lineup_draft other team: FAIL — không bị chặn`);
  } else {
    record(`${label}-save-other-lineup`, "PARTIAL", payload.error || payload.code);
    warn(`${label} save_lineup_draft other team: ${payload.error || payload.code}`);
  }
}

async function probeCaptainHiddenOpponent(client, label, ownTeamId, opponentTeamId) {
  const payload = await rpc(client, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
    p_viewer_team_id: ownTeamId,
  });

  if (!payload.ok) {
    record(`${label}-hidden-opponent`, "PARTIAL", payload.error || payload.code);
    warn(`${label} hidden opponent: setup failed — ${payload.error || payload.code}`);
    return;
  }

  const ownSelections = probeLineupSelections(payload, ownTeamId);
  const opponentSelections = probeLineupSelections(payload, opponentTeamId);
  const matchup = (payload.tournament?.teamData?.matchups || []).find(
    (row) => row.id === PROBE.matchupId
  );
  const isPublished = ["published", "in_progress", "completed"].includes(matchup?.status || "");

  if (ownSelections && typeof ownSelections === "object") {
    record(`${label}-see-own-lineup`, "PASS", "visible");
    ok(`${label} sees own lineup selections`);
  } else {
    record(`${label}-see-own-lineup`, "PARTIAL", "selections null");
    warn(`${label} own lineup selections null`);
  }

  if (!isPublished && opponentSelections === null) {
    record(`${label}-hidden-opponent`, "PASS", "opponent hidden before publish");
    ok(`${label} opponent lineup hidden before publish`);
  } else if (isPublished && opponentSelections) {
    record(`${label}-hidden-opponent`, "PASS", "published — opponent visible");
    ok(`${label} opponent visible after publish (expected)`);
  } else if (!isPublished && opponentSelections) {
    record(`${label}-hidden-opponent`, "FAIL", "leak before publish");
    warn(`${label} opponent lineup LEAK before publish`);
  } else {
    record(`${label}-hidden-opponent`, "PARTIAL", `status=${matchup?.status || "?"}`);
    warn(`${label} hidden opponent: inconclusive (matchup status=${matchup?.status || "?"})`);
  }
}

async function probeRefereeBeforePublish(client, label) {
  const payload = await rpc(client, "team_tournament_save_sub_match_draft", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_score: { teamA: 11, teamB: 5, games: [{ teamA: 11, teamB: 5 }] },
  });

  if (isValidationRpc(payload) || isForbiddenRpc(payload)) {
    record(`${label}-referee-before-publish`, "PASS", payload.code);
    ok(`${label} referee before publish: blocked (${payload.code})`);
    return;
  }

  if (payload.ok) {
    record(`${label}-referee-before-publish`, "FAIL", "unexpected OK");
    warn(`${label} referee before publish: FAIL — không bị chặn`);
  } else {
    record(`${label}-referee-before-publish`, "PARTIAL", payload.error || payload.code);
    warn(`${label} referee before publish: ${payload.error || payload.code}`);
  }
}

async function probeViewerStandings(client, label) {
  const payload = await rpc(client, "team_tournament_get_standings", {
    p_tournament_id: PROBE.tournamentId,
  });

  if (payload.ok) {
    record(`${label}-standings`, "PASS", "readable");
    ok(`${label} get_standings: OK`);
    return;
  }

  if (isForbiddenRpc(payload)) {
    record(`${label}-standings`, "PASS", "FORBIDDEN (expected for restricted viewer)");
    ok(`${label} get_standings: blocked (expected for viewer without permission)`);
    return;
  }

  record(`${label}-standings`, "PARTIAL", payload.error || payload.code);
  warn(`${label} get_standings: ${payload.error || payload.code}`);
}

async function probeCrossTenantSetup(client, label) {
  const payload = await rpc(client, "team_tournament_get_setup", {
    p_tournament_id: PROBE.tournamentId,
  });

  if (isForbiddenRpc(payload)) {
    record(`${label}-cross-setup`, "PASS", payload.code);
    ok(`${label} cross-tenant get_setup: blocked`);
    return;
  }

  if (payload.ok) {
    record(`${label}-cross-setup`, "FAIL", "foreign tenant read");
    warn(`${label} cross-tenant get_setup: FAIL — đọc được giải tenant A`);
    return;
  }

  const message = String(payload.error || "").toLowerCase();
  if (message.includes("cross-tenant") || message.includes("access_denied")) {
    record(`${label}-cross-setup`, "PASS", "cross-tenant error");
    ok(`${label} cross-tenant get_setup: blocked`);
    return;
  }

  record(`${label}-cross-setup`, "PARTIAL", payload.error || payload.code);
  warn(`${label} cross-tenant get_setup: ${payload.error || payload.code}`);
}

async function probeCrossTenantTableRead(client, label, otherTenantId) {
  for (const table of TEAM_TABLES) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("tenant_id", otherTenantId)
      .limit(10);

    if (error && isRlsBlocked(error)) {
      record(`${label}-${table}-cross`, "PASS", "blocked");
      ok(`${label} ${table} filter ${otherTenantId}: blocked`);
      continue;
    }

    if ((data || []).length > 0) {
      record(`${label}-${table}-cross`, "FAIL", `leak ${data.length}`);
      warn(`${label} ${table} filter ${otherTenantId}: LEAK (${data.length})`);
    } else {
      record(`${label}-${table}-cross`, "PASS", "0 rows");
      ok(`${label} ${table} filter ${otherTenantId}: 0 rows`);
    }
  }
}

async function probeAdminLockPublish(client, label) {
  const lockPayload = await rpc(client, "team_tournament_lock_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
  });

  if (lockPayload.ok) {
    record(`${label}-lock-matchup`, "PASS", "locked");
    ok(`${label} lock_matchup: OK`);
  } else if (isForbiddenRpc(lockPayload)) {
    record(`${label}-lock-matchup`, "FAIL", lockPayload.code);
    warn(`${label} lock_matchup: FORBIDDEN`);
  } else {
    record(`${label}-lock-matchup`, "PARTIAL", lockPayload.error || lockPayload.code);
    warn(`${label} lock_matchup: ${lockPayload.error || lockPayload.code}`);
  }

  const publishPayload = await rpc(client, "team_tournament_publish_matchup", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
  });

  if (publishPayload.ok) {
    record(`${label}-publish-matchup`, "PASS", "published");
    ok(`${label} publish_matchup: OK`);
  } else if (isForbiddenRpc(publishPayload)) {
    record(`${label}-publish-matchup`, "FAIL", publishPayload.code);
    warn(`${label} publish_matchup: FORBIDDEN`);
  } else {
    record(`${label}-publish-matchup`, "PARTIAL", publishPayload.error || publishPayload.code);
    warn(`${label} publish_matchup: ${publishPayload.error || publishPayload.code}`);
  }
}

async function probeRefereeAfterPublish(client, label) {
  const payload = await rpc(client, "team_tournament_save_sub_match_draft", {
    p_tournament_id: PROBE.tournamentId,
    p_matchup_id: PROBE.matchupId,
    p_sub_match_id: PROBE.subMatchId,
    p_score: { teamA: 11, teamB: 7, games: [{ teamA: 11, teamB: 7 }] },
  });

  if (payload.ok) {
    record(`${label}-referee-after-publish`, "PASS", "draft saved");
    ok(`${label} referee after publish: OK`);
    return;
  }

  if (isForbiddenRpc(payload)) {
    record(`${label}-referee-after-publish`, "FAIL", payload.code);
    warn(`${label} referee after publish: FORBIDDEN — cần team.match.result.manage`);
  } else {
    record(`${label}-referee-after-publish`, "PARTIAL", payload.error || payload.code);
    warn(`${label} referee after publish: ${payload.error || payload.code}`);
  }
}

const CAPTAIN_A_SELECTIONS = {
  "disc-men": ["player-staging-a-1", "player-staging-a-3"],
  "disc-women": ["player-staging-a-4", "player-staging-a-5"],
  "disc-mixed-1": ["player-staging-a-1", "player-staging-a-4"],
  "disc-mixed-2": ["player-staging-a-6", "player-staging-a-7"],
};

const CAPTAIN_B_SELECTIONS = {
  "disc-men": ["player-staging-b-1", "player-staging-b-3"],
  "disc-women": ["player-staging-b-4", "player-staging-b-5"],
  "disc-mixed-1": ["player-staging-b-1", "player-staging-b-4"],
  "disc-mixed-2": ["player-staging-b-6", "player-staging-b-7"],
};

async function main() {
  console.log("=== Phase 23D — Team Tournament Cloud RLS/RPC Verify ===\n");
  console.log(`Probe tournament: ${PROBE.tournamentId}`);
  console.log(`Probe matchup: ${PROBE.matchupId}\n`);

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    fail("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env.local");
  }
  assertStagingUrl(url);
  loadProjectEnv();

  const tenantA = String(process.env.STAGING_TENANT_A_ID || TENANT_A).trim();
  const tenantB = String(process.env.STAGING_TENANT_B_ID || TENANT_B).trim();

  console.log("--- Anon access (must be denied) ---\n");
  await probeAnonDenied(url, anonKey);

  const ownerA = await signIn(
    url,
    anonKey,
    String(process.env.STAGING_OWNER_A_EMAIL || "owner@staging.local").trim(),
    String(process.env.STAGING_OWNER_A_PASSWORD || "").trim()
  );
  if (ownerA.error) {
    fail(`Owner A login failed: ${ownerA.error}`);
  }
  ok(`Owner A login: ${ownerA.profile.email}`);

  console.log("\n--- BTC / Admin probes (Owner A) ---\n");
  const adminSetup = await probeAdminSetup(ownerA.client, "OwnerA");
  await probeAdminManageTeam(ownerA.client, "OwnerA");

  const captainA = await signIn(
    url,
    anonKey,
    String(process.env.STAGING_CAPTAIN_A_EMAIL || process.env.STAGING_PLAYER_EMAIL || "player@staging.local").trim(),
    String(process.env.STAGING_CAPTAIN_A_PASSWORD || process.env.STAGING_PLAYER_PASSWORD || "").trim()
  );

  if (captainA.error) {
    warn(`Captain A login skipped: ${captainA.error}`);
    record("_setup-captain-a", "BLOCKED", captainA.error);
  } else {
    ok(`Captain A login: ${captainA.profile.email} (player_id=${captainA.profile.player_id || "—"})`);
    console.log("\n--- Captain A probes ---\n");
    await probeCaptainHiddenOpponent(captainA.client, "CaptainA", PROBE.teamA, PROBE.teamB);
    await probeCaptainOwnLineup(captainA.client, "CaptainA", PROBE.teamA, CAPTAIN_A_SELECTIONS);
    await probeCaptainOtherLineupBlocked(
      captainA.client,
      "CaptainA",
      PROBE.teamB,
      CAPTAIN_B_SELECTIONS
    );
    await probeRefereeBeforePublish(captainA.client, "CaptainA");
  }

  const referee = await signIn(
    url,
    anonKey,
    String(process.env.STAGING_REFEREE_EMAIL || process.env.STAGING_MANAGER_EMAIL || "manager@staging.local").trim(),
    String(process.env.STAGING_REFEREE_PASSWORD || process.env.STAGING_MANAGER_PASSWORD || "").trim()
  );

  if (referee.error) {
    warn(`Referee login skipped: ${referee.error}`);
    record("_setup-referee", "BLOCKED", referee.error);
  } else {
    ok(`Referee login: ${referee.profile.email}`);
    console.log("\n--- Referee probes (before publish) ---\n");
    await probeRefereeBeforePublish(referee.client, "Referee");
  }

  const viewer = await signIn(
    url,
    anonKey,
    String(process.env.STAGING_VIEWER_EMAIL || "club@staging.local").trim(),
    String(process.env.STAGING_VIEWER_PASSWORD || process.env.STAGING_CLUB_PASSWORD || "").trim()
  );

  if (viewer.error) {
    warn(`Viewer login skipped: ${viewer.error}`);
    record("_setup-viewer", "BLOCKED", viewer.error);
  } else {
    ok(`Viewer login: ${viewer.profile.email}`);
    console.log("\n--- Viewer probes ---\n");
    await probeViewerStandings(viewer.client, "Viewer");
  }

  const ownerB = await signIn(
    url,
    anonKey,
    String(process.env.STAGING_OWNER_B_EMAIL || "owner-b@staging.local").trim(),
    String(process.env.STAGING_OWNER_B_PASSWORD || "").trim()
  );

  if (ownerB.error) {
    warn(`Owner B login skipped: ${ownerB.error}`);
    record("_setup-owner-b", "BLOCKED", ownerB.error);
  } else {
    ok(`Owner B login: ${ownerB.profile.email}`);
    console.log("\n--- Cross-tenant probes (Owner B) ---\n");
    await probeCrossTenantSetup(ownerB.client, "OwnerB");
    await probeCrossTenantTableRead(ownerB.client, "OwnerB", tenantA);
  }

  if (adminSetup) {
    const matchup = (adminSetup.tournament?.teamData?.matchups || []).find(
      (row) => row.id === PROBE.matchupId
    );
    const isOpen = ["lineup_open", "scheduled"].includes(matchup?.status || "lineup_open");

    if (isOpen) {
      console.log("\n--- Admin lock/publish + referee after publish ---\n");
      await probeAdminLockPublish(ownerA.client, "OwnerA");
      if (referee.client) {
        await probeRefereeAfterPublish(referee.client, "Referee");
      }
    } else {
      warn("Matchup probe không ở trạng thái lineup_open — bỏ qua lock/publish mutate probes");
      record("mutate-lock-publish", "PARTIAL", `status=${matchup?.status || "?"}`);
      if (referee.client && ["published", "in_progress", "completed"].includes(matchup?.status || "")) {
        console.log("\n--- Referee after publish (matchup already published) ---\n");
        await probeRefereeAfterPublish(referee.client, "Referee");
      }
    }
  }

  console.log("\n--- Summary ---\n");
  const counts = { PASS: 0, PARTIAL: 0, FAIL: 0, BLOCKED: 0 };
  for (const row of results) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  console.log(
    `PASS=${counts.PASS || 0} PARTIAL=${counts.PARTIAL || 0} FAIL=${counts.FAIL || 0} BLOCKED=${counts.BLOCKED || 0}`
  );

  const fails = results.filter((row) => row.status === "FAIL");
  if (fails.length > 0) {
    fail(`Team Tournament RLS verify: FAIL (${fails.length} findings)`);
  }

  if ((counts.PARTIAL || 0) > 0 || (counts.BLOCKED || 0) > 0) {
    warn("Team Tournament RLS verify: PARTIAL — kiểm tra seed + profile player_id + passwords staging");
    process.exit(0);
  }

  ok("Team Tournament RLS verify: PASS");
}

main().catch((error) => {
  fail(error?.message || String(error));
});
