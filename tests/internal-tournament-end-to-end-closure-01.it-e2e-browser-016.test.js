/**
 * IT-E2E-BROWSER-016 — Internal referee scoring runtime ensure RPC.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import { MATCH_LIVE_STATUS } from "../src/domain/matchLiveSync.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { addCanonicalRefereeToRoster } from "../src/models/tournament/refereeRoster.js";
import { assignInternalMatchReferee } from "../src/features/tournament/internal/index.js";
import {
  CANONICAL_ENSURE_INTERNAL_REFEREE_MATCH_LIVE,
  ensureInternalRefereeMatchLive,
} from "../src/features/tournament/internal/internalRefereeRuntimeEnsure.js";
import { loadRefereeTokenScoreboard } from "../src/features/tournament/internal/internalRefereeTokenScoreboard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERNAL_ID = "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3";
const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";
const AUTH_UID = "ca78575b-c5bf-4d32-bd7c-cc3027fea2a5";
const AUTH_EMAIL = "tt418.referee01@staging.local";
const TOKEN = "b0d87cb541da47acb71e059a5ace4901";
const APPLY = path.join(
  root,
  "docs/v5/migrations/internal-tournament-end-to-end-closure-01/06_REFEREE_RUNTIME_APPLY.sql"
);
const PRECHECK = path.join(
  root,
  "docs/v5/migrations/internal-tournament-end-to-end-closure-01/05_REFEREE_RUNTIME_PRECHECK.sql"
);
const VERIFY = path.join(
  root,
  "docs/v5/migrations/internal-tournament-end-to-end-closure-01/07_REFEREE_RUNTIME_VERIFY.sql"
);
const ROLLBACK = path.join(
  root,
  "docs/v5/migrations/internal-tournament-end-to-end-closure-01/08_REFEREE_RUNTIME_ROLLBACK.sql"
);

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
    settings: { refereeRoster: rosterAdd.roster },
    events: [
      {
        id: "event-1",
        type: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          { id: "e1", name: "IT421 Nam 01 / IT421 Nam 02" },
          { id: "e2", name: "IT421 Nam 03 / IT421 Nam 04" },
        ],
        matches: [
          {
            id: "GA-R1-M1",
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
    tournament: {
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
    },
    token: TOKEN,
  };
}

describe("IT-E2E-BROWSER-016 Internal referee runtime ensure SQL", () => {
  it("additive follow-up does not rewrite 01-04 history", () => {
    const apply01 = readSrc(
      "docs/v5/migrations/internal-tournament-end-to-end-closure-01/02_APPLY.sql"
    );
    const apply06 = readFileSync(APPLY, "utf8");
    assert.match(apply01, /canonical_tournament_assert_internal_status_transition/);
    assert.doesNotMatch(apply01, /canonical_ensure_internal_referee_match_live/);
    assert.match(apply06, /canonical_ensure_internal_referee_match_live/);
  });

  it("APPLY is security definer, authenticated-only, idempotent reuse", () => {
    const apply = readFileSync(APPLY, "utf8");
    assert.match(apply, /SECURITY DEFINER/);
    assert.match(apply, /GRANT EXECUTE ON FUNCTION public\.canonical_ensure_internal_referee_match_live\(text\) TO authenticated/);
    assert.match(apply, /REVOKE ALL ON FUNCTION public\.canonical_ensure_internal_referee_match_live\(text\) FROM anon/);
    assert.match(apply, /referee_token = v_token/);
    assert.match(apply, /unique_violation/);
    assert.match(apply, /user_has_permission\('tournament\.update'\)/);
    assert.doesNotMatch(apply, /user_has_permission\('tournament\.create'\)/);
    assert.doesNotMatch(apply, /GRANT EXECUTE[^\n]+TO anon/);
    assert.doesNotMatch(apply, /team_tournament_ensure_referee_runtime_for_matchup/);
  });

  it("PRECHECK / VERIFY / ROLLBACK cover required proofs", () => {
    const precheck = readFileSync(PRECHECK, "utf8");
    const verify = readFileSync(VERIFY, "utf8");
    const rollback = readFileSync(ROLLBACK, "utf8");
    assert.match(precheck, /STAGING_PROJECT=qyewbxjsiiyufanzcjcq/);
    assert.match(precheck, /TARGET_IS_PRODUCTION=NO/);
    assert.match(precheck, /canonical_ensure_internal_referee_match_live/);
    assert.match(verify, /REFEREE_TOKEN_INVALID/);
    assert.match(verify, /TOURNAMENT_FORBIDDEN/);
    assert.match(verify, /GA-R1-M1/);
    assert.match(verify, /SCORE_PRESERVED_ON_REENSURE/);
    assert.match(verify, /referee_get_match_by_token/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.canonical_ensure_internal_referee_match_live/);
  });
});

describe("IT-E2E-BROWSER-016 client wiring", () => {
  it("Internal assignment and scoreboard call ensure RPC instead of live upsert", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const scoreboard = readSrc("src/features/tournament/internal/internalRefereeTokenScoreboard.js");
    const ensure = readSrc("src/features/tournament/internal/internalRefereeRuntimeEnsure.js");
    assert.match(setup, /ensureInternalRefereeMatchLive/);
    assert.doesNotMatch(setup, /upsertMatchLive/);
    assert.match(scoreboard, /ensureRuntime/);
    assert.match(scoreboard, /ensureInternalRefereeMatchLive/);
    assert.match(ensure, /canonical_ensure_internal_referee_match_live/);
    assert.doesNotMatch(ensure, /from\("tournament_match_live"\)/);
  });

  it("hard-cutover still forbids direct Internal live writes", () => {
    const policy = readSrc("src/features/platform-hard-cutover/legacyAuthorityPolicy.js");
    const sync = readSrc("src/domain/matchLiveSync.js");
    assert.match(policy, /MATCH_LIVE_DIRECT_WRITE_FORBIDDEN/);
    assert.match(sync, /assertMatchLiveDirectWriteAllowed/);
    assert.match(sync, /upsertMatchLive/);
  });

  it("Team ensure RPC name is unchanged", () => {
    const apply = readFileSync(APPLY, "utf8");
    const team = readSrc(
      "docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01/02_APPLY.sql"
    );
    assert.doesNotMatch(apply, /CREATE OR REPLACE FUNCTION public\.team_tournament_ensure_referee_runtime_for_matchup/);
    assert.match(team, /team_tournament_ensure_referee_runtime_for_matchup/);
  });

  it("assignment → ensure → runtime row → token parity → scorer resolves", async () => {
    const { token } = makeAssignedInternal();
    const liveRows = [];
    const ensure = async (ensureToken) => {
      const existing = liveRows.find((row) => row.refereeToken === ensureToken);
      if (existing) return { ok: true, matchId: existing.matchId, refereeToken: existing.refereeToken };
      liveRows.push({
        matchId: "GA-R1-M1",
        refereeToken: ensureToken,
        status: MATCH_LIVE_STATUS.PLAYING,
        tournamentName: "Giải nội bộ 14/8/2026",
      });
      return { ok: true, matchId: "GA-R1-M1", refereeToken: ensureToken };
    };
    const first = await loadRefereeTokenScoreboard({
      token,
      user: refereeUser,
      ensureRuntime: ensure,
      fetchLiveByToken: async (wanted) => {
        const row = liveRows.find((item) => item.refereeToken === wanted);
        return row ? { ok: true, row } : { ok: false };
      },
      listCanonicalTournaments: async () => {
        throw new Error("live should resolve after ensure");
      },
    });
    assert.equal(first.ok, true);
    assert.equal(first.source, "match_live");
    assert.equal(first.row.matchId, "GA-R1-M1");
    assert.equal(first.row.refereeToken, token);
    assert.equal(liveRows.length, 1);

    const second = await loadRefereeTokenScoreboard({
      token,
      user: refereeUser,
      ensureRuntime: ensure,
      fetchLiveByToken: async (wanted) => {
        const row = liveRows.find((item) => item.refereeToken === wanted);
        return row ? { ok: true, row } : { ok: false };
      },
    });
    assert.equal(second.row.matchId, first.row.matchId);
    assert.equal(second.row.refereeToken, first.row.refereeToken);
    assert.equal(liveRows.length, 1);
  });

  it("invalid token is denied by ensure helper", async () => {
    const result = await ensureInternalRefereeMatchLive("short", {
      rpc: async () => {
        throw new Error("should not call rpc");
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "INVALID_TOKEN");
  });

  it("cross-tenant / forbidden ensure is denied", async () => {
    const result = await ensureInternalRefereeMatchLive(TOKEN, {
      rpc: async () => ({
        data: null,
        error: { message: "TOURNAMENT_FORBIDDEN", code: "42501" },
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "FORBIDDEN");
  });

  it("ensure RPC name is the Internal contract, not a second token authority", () => {
    assert.equal(
      CANONICAL_ENSURE_INTERNAL_REFEREE_MATCH_LIVE,
      "canonical_ensure_internal_referee_match_live"
    );
    const scoreboard = readSrc("src/features/tournament/internal/internalRefereeTokenScoreboard.js");
    assert.match(scoreboard, /fetchMatchLiveByToken/);
    assert.doesNotMatch(scoreboard, /canonical_ensure_internal_referee_match_live_get/);
  });
});
