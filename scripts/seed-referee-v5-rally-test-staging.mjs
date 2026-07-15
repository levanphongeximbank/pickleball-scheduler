#!/usr/bin/env node
/**
 * Isolated REFEREE_V5_RALLY_TEST_* staging fixture seed (R2-2F).
 * Staging project only — never Production.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initializeMatchState } from "../src/features/referee-v5/engines/initializeMatchState.js";
import { COURT_END } from "../src/features/referee-v5/constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../src/features/referee-v5/constants/courtSides.js";
import { MATCH_TYPE } from "../src/features/referee-v5/constants/matchTypes.js";
import { SCORING_FORMAT } from "../src/features/referee-v5/constants/scoringFormats.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../src/features/referee-v5/constants/scoringStrategy.js";
import {
  serializeMatchState,
  buildMatchStateId,
} from "../src/features/referee-v5/persistence/matchStateSerializer.js";
import { hashMatchStateCanonical } from "../src/features/referee-v5/persistence/canonicalStateHash.js";
import { loadProjectEnv } from "./load-env.mjs";
import { FIXTURE as SIDEOUT_FIXTURE } from "./seed-referee-v5-test-staging.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const OUT_DIR = "docs/v5/qa-evidence/referee-v5-rally/r2-2f";

export const RALLY_FIXTURE = Object.freeze({
  TENANT: "REFEREE_V5_RALLY_TEST_TENANT",
  TOURNAMENT: "REFEREE_V5_RALLY_TEST_TOURNAMENT",
  MATCH_DOUBLES: "REFEREE_V5_RALLY_TEST_MATCH_DOUBLES",
  MATCH_MISSING_FORMAT: "REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT",
  MATCH_BAD_VARIANT: "REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT",
  MATCH_SINGLES: "REFEREE_V5_RALLY_TEST_MATCH_SINGLES",
  MATCH_EXPIRED: "REFEREE_V5_RALLY_TEST_MATCH_EXPIRED",
  MATCH_REVOKED_HOST: "REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST",
  MATCH_UNASSIGNED: "REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED",
  USERS: SIDEOUT_FIXTURE.USERS,
});

function sqlJson(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

function doublesTeams() {
  return {
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
  };
}

function buildRallyConfig(overrides = {}) {
  return {
    matchId: RALLY_FIXTURE.MATCH_DOUBLES,
    matchType: MATCH_TYPE.DOUBLES,
    scoringFormat: SCORING_FORMAT.RALLY,
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    ruleSetId: RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1,
    pointsToWin: 11,
    winBy: 2,
    freezeRule: "NONE",
    serverNumberRule: "NONE",
    teams: doublesTeams(),
    firstServingTeamId: "team-a",
    firstServingPlayerId: "A",
    ...overrides,
  };
}

function buildInitialState(config) {
  const init = initializeMatchState(config);
  if (!init.ok) {
    throw new Error(`init failed ${config.matchId}: ${init.errors?.join(", ")}`);
  }
  return serializeMatchState(init.state);
}

function resetMatchSql({ matchId, config }) {
  const state = buildInitialState(config);
  const id = buildMatchStateId({
    tenantId: RALLY_FIXTURE.TENANT,
    tournamentId: RALLY_FIXTURE.TOURNAMENT,
    matchId,
  });
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
  '${id}', '${RALLY_FIXTURE.TENANT}', '${RALLY_FIXTURE.TOURNAMENT}', '${matchId}', 'team-a', 'team-b',
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

function assignmentSql({ matchId, userId, status, assignedAt = null, expiresAt = null, revokedAt = null }) {
  return `
insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  '${RALLY_FIXTURE.TENANT}', '${RALLY_FIXTURE.TOURNAMENT}', '${matchId}', '${userId}', 'Rally V5 QA',
  'REFEREE', '${status}', ${assignedAt ? `'${assignedAt}'` : "now()"}, ${expiresAt ? `'${expiresAt}'` : "null"}, ${revokedAt ? `'${revokedAt}'` : "null"}
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;`;
}

export function buildRallySeedSql() {
  const now = Date.now();
  const futureExpiry = new Date(now + 86400_000 * 30).toISOString();
  const expiredAssignedAt = new Date(now - 2 * 3600_000).toISOString();
  const expiredAt = new Date(now - 3600_000).toISOString();
  const revokedAssignedAt = new Date(now - 3600_000).toISOString();
  const revokedAt = new Date(now).toISOString();

  const missingConfig = buildRallyConfig({
    matchId: RALLY_FIXTURE.MATCH_MISSING_FORMAT,
    scoringVariant: undefined,
    ruleSetId: undefined,
  });
  delete missingConfig.scoringVariant;
  delete missingConfig.ruleSetId;

  const badVariantConfig = buildRallyConfig({
    matchId: RALLY_FIXTURE.MATCH_BAD_VARIANT,
    scoringVariant: "DREAMBREAKER_V1",
    ruleSetId: undefined,
  });
  delete badVariantConfig.ruleSetId;

  const singlesConfig = {
    matchId: RALLY_FIXTURE.MATCH_SINGLES,
    matchType: MATCH_TYPE.SINGLES,
    scoringFormat: SCORING_FORMAT.RALLY,
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    pointsToWin: 11,
    winBy: 2,
    freezeRule: "NONE",
    serverNumberRule: "NONE",
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
  };

  return `-- REFEREE_V5_RALLY_TEST_* R2-2F seed
set session_replication_role = replica;
${resetMatchSql({
  matchId: RALLY_FIXTURE.MATCH_DOUBLES,
  config: buildRallyConfig({ matchId: RALLY_FIXTURE.MATCH_DOUBLES }),
})}
${resetMatchSql({ matchId: RALLY_FIXTURE.MATCH_MISSING_FORMAT, config: missingConfig })}
${resetMatchSql({ matchId: RALLY_FIXTURE.MATCH_BAD_VARIANT, config: badVariantConfig })}
${resetMatchSql({ matchId: RALLY_FIXTURE.MATCH_SINGLES, config: singlesConfig })}
${resetMatchSql({
  matchId: RALLY_FIXTURE.MATCH_EXPIRED,
  config: buildRallyConfig({ matchId: RALLY_FIXTURE.MATCH_EXPIRED }),
})}
${resetMatchSql({
  matchId: RALLY_FIXTURE.MATCH_REVOKED_HOST,
  config: buildRallyConfig({ matchId: RALLY_FIXTURE.MATCH_REVOKED_HOST }),
})}
${resetMatchSql({
  matchId: RALLY_FIXTURE.MATCH_UNASSIGNED,
  config: buildRallyConfig({ matchId: RALLY_FIXTURE.MATCH_UNASSIGNED }),
})}

${assignmentSql({
  matchId: RALLY_FIXTURE.MATCH_DOUBLES,
  userId: RALLY_FIXTURE.USERS.refereeA,
  status: "active",
  expiresAt: futureExpiry,
})}
${assignmentSql({
  matchId: RALLY_FIXTURE.MATCH_MISSING_FORMAT,
  userId: RALLY_FIXTURE.USERS.refereeA,
  status: "active",
  expiresAt: futureExpiry,
})}
${assignmentSql({
  matchId: RALLY_FIXTURE.MATCH_BAD_VARIANT,
  userId: RALLY_FIXTURE.USERS.refereeA,
  status: "active",
  expiresAt: futureExpiry,
})}
${assignmentSql({
  matchId: RALLY_FIXTURE.MATCH_SINGLES,
  userId: RALLY_FIXTURE.USERS.refereeA,
  status: "active",
  expiresAt: futureExpiry,
})}
${assignmentSql({
  matchId: RALLY_FIXTURE.MATCH_EXPIRED,
  userId: RALLY_FIXTURE.USERS.refereeA,
  status: "active",
  assignedAt: expiredAssignedAt,
  expiresAt: expiredAt,
})}
${assignmentSql({
  matchId: RALLY_FIXTURE.MATCH_REVOKED_HOST,
  userId: RALLY_FIXTURE.USERS.refereeA,
  status: "revoked",
  assignedAt: revokedAssignedAt,
  revokedAt,
})}
${assignmentSql({
  matchId: RALLY_FIXTURE.MATCH_DOUBLES,
  userId: RALLY_FIXTURE.USERS.player,
  status: "revoked",
  assignedAt: revokedAssignedAt,
  revokedAt,
})}
set session_replication_role = origin;
`;
}

export function buildRallyMatchResetSql(matchId = RALLY_FIXTURE.MATCH_DOUBLES) {
  return `set session_replication_role = replica;
${resetMatchSql({
  matchId,
  config: buildRallyConfig({ matchId }),
})}
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

export async function applyRallySeed() {
  loadProjectEnv();
  const url = String(process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref detected");
  }
  if (!url.includes(STAGING_REF)) {
    throw new Error(`STOP — expected staging ref ${STAGING_REF}`);
  }

  const root = dirname(fileURLToPath(import.meta.url));
  const outDir = join(root, "..", OUT_DIR);
  mkdirSync(outDir, { recursive: true });

  const sql = buildRallySeedSql();
  writeFileSync(join(outDir, "RALLY_SEED.sql"), sql);

  const report = {
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    prefix: "REFEREE_V5_RALLY_TEST_",
    tenant: RALLY_FIXTURE.TENANT,
    tournament: RALLY_FIXTURE.TOURNAMENT,
    matches: [
      RALLY_FIXTURE.MATCH_DOUBLES,
      RALLY_FIXTURE.MATCH_MISSING_FORMAT,
      RALLY_FIXTURE.MATCH_BAD_VARIANT,
      RALLY_FIXTURE.MATCH_SINGLES,
      RALLY_FIXTURE.MATCH_EXPIRED,
      RALLY_FIXTURE.MATCH_REVOKED_HOST,
      RALLY_FIXTURE.MATCH_UNASSIGNED,
    ],
    format: {
      scoringSystem: SCORING_SYSTEM.RALLY,
      scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
      matchType: MATCH_TYPE.DOUBLES,
      pointsToWin: 11,
      winBy: 2,
      freezeRule: "NONE",
      serverNumberRule: "NONE",
    },
    linkedToRealTournament: false,
    applied: false,
    timestamp: new Date().toISOString(),
  };

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!token) {
    writeFileSync(join(outDir, "RALLY_FIXTURE_REPORT.json"), JSON.stringify(report, null, 2));
    throw new Error("SUPABASE_ACCESS_TOKEN missing");
  }

  await executeSql(token, sql);
  report.applied = true;
  writeFileSync(join(outDir, "RALLY_FIXTURE_REPORT.json"), JSON.stringify(report, null, 2));
  return report;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  applyRallySeed()
    .then(() => console.log("PASS — REFEREE_V5_RALLY_TEST_* seed applied"))
    .catch((err) => {
      console.error(`FAIL — ${err.message}`);
      process.exit(1);
    });
}
