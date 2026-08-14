/**
 * IT-E2E-BROWSER-017 — Internal referee canonical scoring cutover.
 * Authenticated path uses /referee/match/:matchId?mode=internal.
 * Legacy /referee/:token remains compatibility-only.
 * Commit RPC is Staging SQL GO (09–12); client fails closed until applied.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { addCanonicalRefereeToRoster } from "../src/models/tournament/refereeRoster.js";
import {
  assignInternalMatchReferee,
  buildInternalRefereeCanonicalHref,
  buildInternalRefereeLegacyTokenHref,
  CANONICAL_COMMIT_INTERNAL_REFEREE_MATCH_RESULT,
  CANONICAL_ENSURE_INTERNAL_REFEREE_MATCH_LIVE,
  commitInternalRefereeMatchResult,
  INTERNAL_REFEREE_CANONICAL_MODE,
  INTERNAL_REFEREE_COMMIT_SQL_REQUIRED,
  isInternalRefereeCanonicalRequest,
  listInternalRefereeHubAssignments,
  projectInternalRefereeCanonicalEventResult,
  projectInternalRefereeCanonicalMatchResult,
  standingsFromInternalEvent,
} from "../src/features/tournament/internal/index.js";
import { aggregateMyTournamentDashboards } from "../src/features/tournament/my-tournaments/aggregateMyTournamentDashboards.js";
import { canonicalRowToTournament, tournamentToCanonicalRow } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERNAL_ID = "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3";
const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";
const AUTH_UID = "ca78575b-c5bf-4d32-bd7c-cc3027fea2a5";
const AUTH_EMAIL = "tt418.referee01@staging.local";
const TOKEN = "b0d87cb541da47acb71e059a5ace4901";
const WRONG_UID = "7b381912-2190-415c-b099-6b1e87567b7a";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const refereeUser = {
  id: AUTH_UID,
  email: AUTH_EMAIL,
  role: ROLES.REFEREE,
  venueId: TENANT_ID,
};

function makeAssignedInternal() {
  const rosterAdd = addCanonicalRefereeToRoster([], {
    userId: AUTH_UID,
    email: AUTH_EMAIL,
    displayName: "Trọng tài 01",
  });
  const tournament = {
    id: INTERNAL_ID,
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.READY,
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
    version: 19,
    settings: { refereeRoster: rosterAdd.roster },
    events: [
      {
        id: "event-1",
        type: EVENT_TYPE.MEN_DOUBLE,
        groups: [
          { id: "G1", name: "Bảng A", entryIds: ["e1", "e2"] },
          { id: "G2", name: "Bảng B", entryIds: [] },
        ],
        entries: [
          { id: "e1", name: "IT421 Nam 01 / IT421 Nam 02" },
          { id: "e2", name: "IT421 Nam 03 / IT421 Nam 04" },
        ],
        matches: [
          {
            id: "GA-R1-M1",
            groupId: "G1",
            round: 1,
            stage: "group",
            entryAId: "e1",
            entryBId: "e2",
            courtId: "tt412-court-01",
            courtName: "TT412 Sân 1",
            scheduledStart: "2026-08-14T08:00:00",
          },
        ],
      },
    ],
  };
  const assigned = assignInternalMatchReferee({
    tournament,
    event: tournament.events[0],
    matchId: "GA-R1-M1",
    rosterId: rosterAdd.entry.id,
  });
  assert.equal(assigned.ok, true);
  return {
    ...tournament,
    events: [
      {
        ...assigned.event,
        matches: assigned.event.matches.map((match) =>
          String(match.id) === "GA-R1-M1"
            ? { ...match, referee: { ...match.referee, token: TOKEN } }
            : match
        ),
      },
    ],
  };
}

function roundTrip(tournament) {
  const row = tournamentToCanonicalRow(tournament, {
    tenantId: tournament.tenantId,
    clubId: tournament.clubId,
  });
  row.version = tournament.version ?? 19;
  row.created_at = "2026-08-14T00:00:00.000Z";
  row.updated_at = "2026-08-14T00:00:00.000Z";
  return canonicalRowToTournament(row);
}

describe("IT-E2E-BROWSER-017 Internal referee canonical cutover", () => {
  it("A. authenticated hub Chấm trận opens canonical session, not token warning route", async () => {
    const assigned = makeAssignedInternal();
    const href = buildInternalRefereeCanonicalHref({
      tournamentId: INTERNAL_ID,
      matchId: "GA-R1-M1",
      clubId: CLUB_ID,
    });
    assert.equal(href.includes("/referee/match/GA-R1-M1"), true);
    assert.equal(href.includes(`mode=${INTERNAL_REFEREE_CANONICAL_MODE}`), true);
    assert.equal(href.includes(TOKEN), false);

    const result = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    const card = result.tournaments[0];
    assert.equal(card.refereeHref, href);
    assert.doesNotMatch(card.refereeHref, /^\/referee\/[^/?]+$/);

    const page = readSrc("src/pages/referee/InternalRefereeMatchPage.jsx");
    const scoreboard = readSrc("src/pages/referee/RefereeScoreboard.jsx");
    const teamPage = readSrc("src/pages/referee/RefereeV5TeamMatchPage.jsx");
    assert.match(page, /data-testid="internal-referee-canonical-session"/);
    assert.equal(page.includes("useClub"), false);
    assert.equal(page.includes("Link token legacy"), false);
    assert.match(page, /canonicalCommit/);
    assert.match(scoreboard, /usesCanonicalCommit/);
    assert.match(scoreboard, /if \(usesCanonicalCommit\) \{/);
    assert.match(scoreboard, /await runCanonicalCommit\(\)/);
    assert.match(scoreboard, /requestMatchLiveFinalize\(token, scoreA, scoreB/);
    assert.match(teamPage, /isInternalCanonical/);
    assert.match(teamPage, /InternalRefereeMatchPage/);
  });

  it("B. runtime ensure remains the Internal live adapter", () => {
    const ensure = readSrc("src/features/tournament/internal/internalRefereeRuntimeEnsure.js");
    const scoreboard = readSrc("src/features/tournament/internal/internalRefereeTokenScoreboard.js");
    const apply10 = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/10_REFEREE_COMMIT_APPLY.sql"
    );
    assert.equal(
      CANONICAL_ENSURE_INTERNAL_REFEREE_MATCH_LIVE,
      "canonical_ensure_internal_referee_match_live"
    );
    assert.match(ensure, /canonical_ensure_internal_referee_match_live/);
    assert.match(scoreboard, /ensureInternalRefereeMatchLive/);
    assert.doesNotMatch(apply10, /CREATE OR REPLACE FUNCTION public\.canonical_ensure_internal_referee_match_live/);
  });

  it("C. save score once projects canonical match result", () => {
    const assigned = makeAssignedInternal();
    const match = assigned.events[0].matches[0];
    const scored = projectInternalRefereeCanonicalMatchResult(match, { scoreA: 11, scoreB: 5 });
    assert.equal(scored.ok, true);
    assert.equal(scored.match.status, MATCH_STATUS.COMPLETED);
    assert.equal(scored.match.scoreA, 11);
    assert.equal(scored.match.scoreB, 5);
    assert.equal(scored.match.winnerId, "e1");
  });

  it("D. standings read the same canonical result; no BTC re-entry", () => {
    const assigned = makeAssignedInternal();
    const projected = projectInternalRefereeCanonicalEventResult(
      assigned.events[0],
      "GA-R1-M1",
      { scoreA: 11, scoreB: 5 }
    );
    assert.equal(projected.ok, true);
    const standings = standingsFromInternalEvent(projected.event);
    const group = standings.find((item) => item.group === "Bảng A") || standings[0];
    const list = group?.standing || [];
    const winner = list.find((row) => String(row.id) === "e1");
    assert.equal(Boolean(winner), true);
    assert.equal(winner.won >= 1, true);
    const page = readSrc("src/pages/referee/RefereeScoreboard.jsx");
    assert.match(page, /Ghi vào bảng điểm giải/);
    assert.match(page, /!usesCanonicalCommit/);
  });

  it("E. F5 mapper remount keeps canonical href and projected score", () => {
    const assigned = makeAssignedInternal();
    const projected = projectInternalRefereeCanonicalEventResult(
      assigned.events[0],
      "GA-R1-M1",
      { scoreA: 11, scoreB: 5 }
    );
    const first = roundTrip({ ...assigned, events: [projected.event] });
    const second = roundTrip(first);
    const href1 = buildInternalRefereeCanonicalHref({
      tournamentId: first.id,
      matchId: "GA-R1-M1",
      clubId: first.clubId,
    });
    const href2 = buildInternalRefereeCanonicalHref({
      tournamentId: second.id,
      matchId: "GA-R1-M1",
      clubId: second.clubId,
    });
    assert.equal(href1, href2);
    assert.equal(second.events[0].matches[0].scoreA, 11);
    assert.equal(second.events[0].matches[0].scoreB, 5);
    const standings1 = standingsFromInternalEvent(first.events[0]);
    const standings2 = standingsFromInternalEvent(second.events[0]);
    assert.deepEqual(standings1, standings2);
  });

  it("F. client commit is fail-closed until Staging SQL GO", async () => {
    const missing = await commitInternalRefereeMatchResult(
      { token: TOKEN, scoreA: 11, scoreB: 5, expectedVersion: 19 },
      {
        rpc: async () => ({
          data: null,
          error: { message: "function canonical_commit_internal_referee_match_result does not exist", code: "PGRST202" },
        }),
      }
    );
    assert.equal(missing.ok, false);
    assert.equal(missing.code, INTERNAL_REFEREE_COMMIT_SQL_REQUIRED);
    assert.match(missing.error, /Owner GO SQL/);

    const ok = await commitInternalRefereeMatchResult(
      { token: TOKEN, scoreA: 11, scoreB: 5, expectedVersion: 19 },
      {
        rpc: async (name, args) => {
          assert.equal(name, CANONICAL_COMMIT_INTERNAL_REFEREE_MATCH_RESULT);
          assert.equal(args.p_token, TOKEN);
          assert.equal(args.p_score_a, 11);
          assert.equal(args.p_score_b, 5);
          assert.equal(args.p_expected_version, 19);
          return {
            data: { ok: true, match_id: "GA-R1-M1", score_a: 11, score_b: 5, status: "completed", version: 20 },
          };
        },
      }
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.matchId, "GA-R1-M1");
    assert.equal(ok.version, 20);
  });

  it("G. wrong user is denied on discovery and commit", async () => {
    const assigned = makeAssignedInternal();
    const other = { id: WRONG_UID, email: "other@staging.local", role: ROLES.REFEREE, venueId: TENANT_ID };
    const discovered = listInternalRefereeHubAssignments({
      tournaments: [assigned],
      user: other,
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
    });
    assert.equal(discovered.matches.length, 0);
    const denied = await commitInternalRefereeMatchResult(
      { token: TOKEN, scoreA: 11, scoreB: 5, expectedVersion: 19 },
      { rpc: async () => ({ error: { message: "TOURNAMENT_FORBIDDEN", code: "42501" } }) }
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "FORBIDDEN");
  });

  it("H. Team referee lifecycle is not copied into Internal commit SQL", () => {
    const apply10 = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/10_REFEREE_COMMIT_APPLY.sql"
    );
    const teamPage = readSrc("src/pages/referee/RefereeV5TeamMatchPage.jsx");
    assert.doesNotMatch(apply10, /team_tournament_ensure_referee_runtime_for_matchup/);
    assert.doesNotMatch(apply10, /dreambreaker/i);
    assert.doesNotMatch(apply10, /parent_matchup/i);
    assert.doesNotMatch(apply10, /\bmlp\b/i);
    assert.match(teamPage, /rpcTeamTournamentRefereeMatchAccessOps/);
    assert.match(teamPage, /isInternalCanonical \|\| !isRefereeV5Enabled/);
  });

  it("I. legacy public token route remains compatibility-only", () => {
    const router = readSrc("src/router.jsx");
    const pathMod = readSrc("src/features/tournament/internal/internalRefereeCanonicalPath.js");
    assert.match(router, /path="\/referee\/:token"/);
    assert.equal(
      buildInternalRefereeLegacyTokenHref(TOKEN),
      `/referee/${TOKEN}`
    );
    assert.equal(
      isInternalRefereeCanonicalRequest({
        searchParams: new URLSearchParams("mode=internal&tournamentId=" + INTERNAL_ID),
      }),
      true
    );
    assert.equal(
      isInternalRefereeCanonicalRequest({
        searchParams: new URLSearchParams("tournamentId=" + INTERNAL_ID),
      }),
      false
    );
    assert.match(pathMod, /compatibility-only/);
  });

  it("09-12 SQL is additive, authenticated-only, CAS guarded, Owner fixture not mutated", () => {
    const precheck = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/09_REFEREE_COMMIT_PRECHECK.sql"
    );
    const apply = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/10_REFEREE_COMMIT_APPLY.sql"
    );
    const verify = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/11_REFEREE_COMMIT_VERIFY.sql"
    );
    const rollback = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/12_REFEREE_COMMIT_ROLLBACK.sql"
    );
    const apply02 = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/02_APPLY.sql"
    );
    assert.match(precheck, /STAGING_PROJECT=qyewbxjsiiyufanzcjcq/);
    assert.match(precheck, /TARGET_IS_PRODUCTION=NO/);
    assert.match(apply, /SECURITY DEFINER/);
    assert.match(apply, /p_expected_version/);
    assert.match(apply, /VERSION_CONFLICT/);
    assert.match(apply, /GRANT EXECUTE ON FUNCTION public\.canonical_commit_internal_referee_match_result\(text, integer, integer, bigint\) TO authenticated/);
    assert.match(apply, /REVOKE ALL ON FUNCTION public\.canonical_commit_internal_referee_match_result\(text, integer, integer, bigint\) FROM anon/);
    assert.doesNotMatch(apply, /GRANT EXECUTE[^\n]+TO anon/);
    assert.doesNotMatch(apply, /canonical_tournament_update\(/);
    assert.doesNotMatch(apply02, /canonical_commit_internal_referee_match_result/);
    assert.match(verify, /OWNER_FIXTURE_LIVE_MUTATED/);
    assert.match(verify, /a0170000-0000-4000-8000-000000000017/);
    assert.doesNotMatch(verify, /canonical_commit_internal_referee_match_result\(v_token/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.canonical_commit_internal_referee_match_result/);
  });
});
