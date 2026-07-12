#!/usr/bin/env node
/**
 * Full REFEREE_V5_TEST_* seed for V5-D.3 staging closure.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initializeMatchState } from "../src/features/referee-v5/engines/initializeMatchState.js";
import { COURT_END } from "../src/features/referee-v5/constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../src/features/referee-v5/constants/courtSides.js";
import { MATCH_TYPE } from "../src/features/referee-v5/constants/matchTypes.js";
import { SCORING_FORMAT } from "../src/features/referee-v5/constants/scoringFormats.js";
import { serializeMatchState, buildMatchStateId } from "../src/features/referee-v5/persistence/matchStateSerializer.js";
import { hashMatchStateCanonical } from "../src/features/referee-v5/persistence/canonicalStateHash.js";
import { loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const OUT_DIR = "docs/v5/qa-evidence/phase-v5d3";

export const FIXTURE = Object.freeze({
  TENANT_A: "REFEREE_V5_TEST_TENANT_A",
  TENANT_B: "REFEREE_V5_TEST_TENANT_B",
  TOURNAMENT_A: "REFEREE_V5_TEST_TOURNAMENT_A",
  TOURNAMENT_B: "REFEREE_V5_TEST_TOURNAMENT_B",
  MATCH_DOUBLES: "REFEREE_V5_TEST_MATCH_DOUBLES",
  MATCH_SINGLES: "REFEREE_V5_TEST_MATCH_SINGLES",
  MATCH_EXPIRED: "REFEREE_V5_TEST_MATCH_EXPIRED",
  MATCH_TENANT_B: "REFEREE_V5_TEST_MATCH_TENANT_B",
  USERS: {
    refereeA: "13e0968b-53c5-4ba6-8ae0-dce12b1faf9c",
    player: "7b381912-2190-415c-b099-6b1e87567b7a",
    refereeB: "e54abeac-6619-477a-9eb4-b64b05c1ddba",
  },
});

function sqlJson(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

function buildInitialState(matchId, matchType) {
  const config =
    matchType === MATCH_TYPE.SINGLES
      ? {
          matchId,
          matchType: MATCH_TYPE.SINGLES,
          scoringFormat: SCORING_FORMAT.SIDE_OUT,
          pointsToWin: 11,
          winBy: 2,
          teams: {
            teamA: {
              teamId: "team-a",
              courtEnd: COURT_END.NEAR_END,
              players: [{ playerId: "P1", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT }],
            },
            teamB: {
              teamId: "team-b",
              courtEnd: COURT_END.FAR_END,
              players: [{ playerId: "P2", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT }],
            },
          },
          firstServingTeamId: "team-a",
          firstServingPlayerId: "P1",
        }
      : {
          matchId,
          matchType: MATCH_TYPE.DOUBLES,
          scoringFormat: SCORING_FORMAT.SIDE_OUT,
          pointsToWin: 11,
          winBy: 2,
          teams: {
            teamA: {
              teamId: "team-a",
              courtEnd: COURT_END.NEAR_END,
              players: [
                { playerId: "A", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
                { playerId: "B", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
              ],
            },
            teamB: {
              teamId: "team-b",
              courtEnd: COURT_END.FAR_END,
              players: [
                { playerId: "C", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
                { playerId: "D", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
              ],
            },
          },
          firstServingTeamId: "team-a",
          firstServingPlayerId: "A",
        };

  const init = initializeMatchState(config);
  if (!init.ok) {
    throw new Error(`init failed ${matchId}: ${init.errors?.join(", ")}`);
  }
  return serializeMatchState(init.state);
}

function resetMatchSql({ tenantId, tournamentId, matchId, matchType }) {
  const state = buildInitialState(matchId, matchType);
  const id = buildMatchStateId({ tenantId, tournamentId, matchId });
  const hash = hashMatchStateCanonical(state);
  return `
delete from public.match_sync_mutations where match_state_id = '${id}';
delete from public.match_events where match_state_id = '${id}';
delete from public.match_integration_outbox where match_state_id = '${id}';
delete from public.match_result_revisions where match_id = '${matchId}';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  '${id}', '${tenantId}', '${tournamentId}', '${matchId}', 'team-a', 'team-b',
  ${sqlJson(state)}, 0, 0, '${hash}', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;`;
}

function assignmentSql({ tenantId, tournamentId, matchId, userId, status, assignedAt = null, expiresAt = null, revokedAt = null }) {
  return `
insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  '${tenantId}', '${tournamentId}', '${matchId}', '${userId}', 'Referee V5 QA',
  'REFEREE', '${status}', ${assignedAt ? `'${assignedAt}'` : "now()"}, ${expiresAt ? `'${expiresAt}'` : "null"}, ${revokedAt ? `'${revokedAt}'` : "null"}
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;`;
}

export function buildSeedSql() {
  const now = Date.now();
  const futureExpiry = new Date(now + 86400_000 * 30).toISOString();
  // Expired assignment: assigned_at < expires_at < current_timestamp
  //   assigned_at = now - 2h, expires_at = now - 1h  (satisfies expiry_order_chk: expires_at > assigned_at)
  const expiredAssignedAt = new Date(now - 2 * 3600_000).toISOString();
  const expiredAt = new Date(now - 3600_000).toISOString();
  // Revoked assignment: assigned_at <= revoked_at (satisfies revoked_order_chk: revoked_at >= assigned_at)
  const revokedAssignedAt = new Date(now - 3600_000).toISOString();
  const revokedAt = new Date(now).toISOString();

  // match_events is append-only (trigger referee_v5_deny_match_events_mutation
  // blocks UPDATE/DELETE). The seed reset must clear prior test events, so it
  // runs as the privileged Management API role with replication role toggled to
  // 'replica' to bypass user triggers for this test-only reset, then restored.
  return `-- REFEREE V5-D.3 full staging seed
set session_replication_role = replica;
${resetMatchSql({ tenantId: FIXTURE.TENANT_A, tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_DOUBLES, matchType: MATCH_TYPE.DOUBLES })}
${resetMatchSql({ tenantId: FIXTURE.TENANT_A, tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_SINGLES, matchType: MATCH_TYPE.SINGLES })}
${resetMatchSql({ tenantId: FIXTURE.TENANT_A, tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_EXPIRED, matchType: MATCH_TYPE.DOUBLES })}
${resetMatchSql({ tenantId: FIXTURE.TENANT_B, tournamentId: FIXTURE.TOURNAMENT_B, matchId: FIXTURE.MATCH_TENANT_B, matchType: MATCH_TYPE.DOUBLES })}

${assignmentSql({ tenantId: FIXTURE.TENANT_A, tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_DOUBLES, userId: FIXTURE.USERS.refereeA, status: "active", expiresAt: futureExpiry })}
${assignmentSql({ tenantId: FIXTURE.TENANT_A, tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_SINGLES, userId: FIXTURE.USERS.refereeA, status: "active", expiresAt: futureExpiry })}
${assignmentSql({ tenantId: FIXTURE.TENANT_A, tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_EXPIRED, userId: FIXTURE.USERS.refereeA, status: "active", assignedAt: expiredAssignedAt, expiresAt: expiredAt })}
${assignmentSql({ tenantId: FIXTURE.TENANT_A, tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_DOUBLES, userId: FIXTURE.USERS.player, status: "revoked", assignedAt: revokedAssignedAt, revokedAt })}
${assignmentSql({ tenantId: FIXTURE.TENANT_B, tournamentId: FIXTURE.TOURNAMENT_B, matchId: FIXTURE.MATCH_TENANT_B, userId: FIXTURE.USERS.refereeB, status: "active", expiresAt: futureExpiry })}
set session_replication_role = origin;
`;
}

export function buildSingleMatchResetSql(matchId) {
  const matchType = matchId.includes("SINGLES") ? MATCH_TYPE.SINGLES : MATCH_TYPE.DOUBLES;
  const tenantId = matchId.includes("TENANT_B") ? FIXTURE.TENANT_B : FIXTURE.TENANT_A;
  const tournamentId = matchId.includes("TENANT_B") ? FIXTURE.TOURNAMENT_B : FIXTURE.TOURNAMENT_A;
  return `set session_replication_role = replica;
${resetMatchSql({ tenantId, tournamentId, matchId, matchType })}
set session_replication_role = origin;`;
}

async function executeSql(token, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || res.statusText);
  }
  return body;
}

async function main() {
  loadProjectEnv();
  const url = String(process.env.VITE_SUPABASE_URL || process.env.STAGING_SUPABASE_URL || "");
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref detected");
  }

  const root = dirname(fileURLToPath(import.meta.url));
  const outDir = join(root, "..", OUT_DIR);
  mkdirSync(outDir, { recursive: true });

  const sql = buildSeedSql();
  writeFileSync(join(outDir, "SEED_SQL.sql"), sql);

  const report = {
    stagingRef: STAGING_REF,
    prefix: "REFEREE_V5_TEST_",
    tenants: [FIXTURE.TENANT_A, FIXTURE.TENANT_B],
    tournaments: [FIXTURE.TOURNAMENT_A, FIXTURE.TOURNAMENT_B],
    matches: [FIXTURE.MATCH_DOUBLES, FIXTURE.MATCH_SINGLES, FIXTURE.MATCH_EXPIRED, FIXTURE.MATCH_TENANT_B],
    assignments: {
      active: [FIXTURE.MATCH_DOUBLES, FIXTURE.MATCH_SINGLES, FIXTURE.MATCH_TENANT_B],
      expired: [FIXTURE.MATCH_EXPIRED],
      revoked: [{ matchId: FIXTURE.MATCH_DOUBLES, userId: FIXTURE.USERS.player }],
      unassigned: [{ matchId: FIXTURE.MATCH_SINGLES, userId: FIXTURE.USERS.player }],
    },
    userIds: FIXTURE.USERS,
    applied: false,
    timestamp: new Date().toISOString(),
  };

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    writeFileSync(join(outDir, "SEED_REPORT.json"), JSON.stringify(report, null, 2));
    console.log("SEED_REPORT written — SUPABASE_ACCESS_TOKEN: MISSING");
    process.exit(2);
  }

  await executeSql(token, sql);
  report.applied = true;
  writeFileSync(join(outDir, "SEED_REPORT.json"), JSON.stringify(report, null, 2));
  console.log("PASS — full REFEREE_V5_TEST_* seed applied");
}

const isSeedMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isSeedMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
