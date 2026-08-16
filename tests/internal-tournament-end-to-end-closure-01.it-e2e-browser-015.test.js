/**
 * IT-E2E-BROWSER-015 — /referee/:token must render without ClubProvider.
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
import { REFEREE_LINK_LOCKED_MESSAGE } from "../src/models/tournament/scoreLog.js";
import {
  addCanonicalRefereeToRoster,
} from "../src/models/tournament/refereeRoster.js";
import { assignInternalMatchReferee } from "../src/features/tournament/internal/index.js";
import {
  findInternalMatchByRefereeToken,
  loadRefereeTokenScoreboard,
  projectInternalRefereeTokenScoreboardRow,
  resolveRefereeTokenScoreboardScope,
} from "../src/features/tournament/internal/internalRefereeTokenScoreboard.js";
import {
  guardRefereeMatchAction,
  REFEREE_MATCH_ACTIONS,
} from "../src/features/mobile/services/refereeMatchGuard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERNAL_ID = "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3";
const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";
const AUTH_UID = "ca78575b-c5bf-4d32-bd7c-cc3027fea2a5";
const AUTH_EMAIL = "tt418.referee01@staging.local";
const TOKEN = "b0d87cb541da47acb71e059a5ace4901";

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
    ...tournament,
    events: [
      {
        ...assigned.event,
        matches: assigned.event.matches.map((match) =>
          String(match.id) === "GA-R1-M1"
            ? {
                ...match,
                referee: { ...match.referee, token: TOKEN },
              }
            : match
        ),
      },
    ],
  };
}

describe("IT-E2E-BROWSER-015 referee token scoring without ClubProvider", () => {
  it("production /referee/:token tree is outside MainLayout ClubProvider", () => {
    const router = readSrc("src/router.jsx");
    const scoreboard = readSrc("src/pages/referee/RefereeScoreboard.jsx");
    const layout = readSrc("src/layouts/MainLayout.jsx");
    const tokenIdx = router.indexOf('path="/referee/:token"');
    const mainIdx = router.indexOf("element={<MainLayout />}");
    assert.ok(tokenIdx > 0 && mainIdx > tokenIdx);
    assert.match(router, /RefereeTokenRouteErrorBoundary/);
    assert.match(scoreboard, /loadRefereeTokenScoreboard/);
    assert.equal(scoreboard.includes("useClub"), false);
    assert.equal(scoreboard.includes("ClubContext"), false);
    assert.match(layout, /ClubProvider/);
    assert.match(scoreboard, /data-testid="referee-token-scoreboard"/);
  });

  it("legacy /referee/:token remains compatibility-only; hub Chấm trận is canonical", () => {
    const aggregator = readSrc(
      "src/features/tournament/my-tournaments/aggregateMyTournamentDashboards.js"
    );
    const discovery = readSrc(
      "src/features/tournament/internal/internalRefereeDiscovery.js"
    );
    const router = readSrc("src/router.jsx");
    assert.match(discovery, /buildInternalRefereeCanonicalHref/);
    assert.match(discovery, /buildInternalRefereeLegacyTokenHref/);
    assert.match(aggregator, /listInternalRefereeHubAssignments/);
    assert.match(router, /path="\/referee\/:token"/);
  });

  it("token scope comes from authorized match, not activeClub", () => {
    const scope = resolveRefereeTokenScoreboardScope(
      { clubId: CLUB_ID, venueId: TENANT_ID, tournamentId: INTERNAL_ID },
      refereeUser
    );
    assert.equal(scope.clubId, CLUB_ID);
    assert.equal(scope.venueId, TENANT_ID);
    assert.equal(scope.tournamentId, INTERNAL_ID);
    assert.equal(Object.prototype.hasOwnProperty.call(scope, "activeClubId"), false);
  });

  it("valid assigned Internal token renders canonical scoreboard row", async () => {
    const assigned = makeAssignedInternal();
    const result = await loadRefereeTokenScoreboard({
      token: TOKEN,
      user: refereeUser,
      fetchLiveByToken: async () => ({ ok: false, error: REFEREE_LINK_LOCKED_MESSAGE }),
      listClubScopes: async () => [{ clubId: CLUB_ID, tenantId: TENANT_ID }],
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.row.matchId, "GA-R1-M1");
    assert.equal(result.row.tournamentName, "Giải nội bộ 14/8/2026");
    assert.equal(result.row.courtLabel.includes("Sân"), true);
    assert.equal(result.row.scheduledStart, "2026-08-14T08:00:00");
    assert.equal(result.row.status, MATCH_LIVE_STATUS.PLAYING);
    assert.match(result.row.entryALabel, /IT421 Nam 01/);
  });

  it("live RPC row still wins over canonical fallback", async () => {
    const result = await loadRefereeTokenScoreboard({
      token: TOKEN,
      user: refereeUser,
      fetchLiveByToken: async () => ({
        ok: true,
        row: {
          matchId: "GA-R1-M1",
          tournamentName: "live",
          refereeToken: TOKEN,
          status: MATCH_LIVE_STATUS.PLAYING,
        },
      }),
      listCanonicalTournaments: async () => {
        throw new Error("canonical should not run");
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.source, "match_live");
    assert.equal(result.row.tournamentName, "live");
  });

  it("invalid token is denied", async () => {
    const result = await loadRefereeTokenScoreboard({
      token: "short",
      user: refereeUser,
      fetchLiveByToken: async () => ({ ok: false, error: REFEREE_LINK_LOCKED_MESSAGE }),
      listClubScopes: async () => [{ clubId: CLUB_ID, tenantId: TENANT_ID }],
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [makeAssignedInternal()] }),
    });
    assert.equal(result.ok, false);
  });

  it("unassigned referee does not see the Internal match", async () => {
    const assigned = makeAssignedInternal();
    const result = await loadRefereeTokenScoreboard({
      token: TOKEN,
      user: { ...refereeUser, id: "other-uid", email: "other@staging.local" },
      fetchLiveByToken: async () => ({ ok: false, error: REFEREE_LINK_LOCKED_MESSAGE }),
      listClubScopes: async () => [{ clubId: CLUB_ID, tenantId: TENANT_ID }],
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_ASSIGNED");
  });

  it("cross-tenant Internal token is denied", async () => {
    const assigned = makeAssignedInternal();
    assigned.tenantId = "other-tenant";
    const result = await loadRefereeTokenScoreboard({
      token: TOKEN,
      user: refereeUser,
      fetchLiveByToken: async () => ({ ok: false, error: REFEREE_LINK_LOCKED_MESSAGE }),
      listClubScopes: async () => [{ clubId: CLUB_ID, tenantId: TENANT_ID }],
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "CROSS_TENANT");
  });

  it("anonymous token flow stays on live RPC and does not scan Internal clubs", async () => {
    let scanned = false;
    const result = await loadRefereeTokenScoreboard({
      token: TOKEN,
      user: null,
      fetchLiveByToken: async () => ({ ok: false, error: REFEREE_LINK_LOCKED_MESSAGE }),
      listClubScopes: async () => {
        scanned = true;
        return [{ clubId: CLUB_ID, tenantId: TENANT_ID }];
      },
    });
    assert.equal(scanned, false);
    assert.equal(result.ok, false);
    assert.equal(result.error, REFEREE_LINK_LOCKED_MESSAGE);
  });

  it("F5/fresh load returns the same Internal token row", async () => {
    const assigned = makeAssignedInternal();
    const deps = {
      token: TOKEN,
      user: refereeUser,
      fetchLiveByToken: async () => ({ ok: false, error: REFEREE_LINK_LOCKED_MESSAGE }),
      listClubScopes: async () => [{ clubId: CLUB_ID, tenantId: TENANT_ID }],
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    };
    const first = await loadRefereeTokenScoreboard(deps);
    const second = await loadRefereeTokenScoreboard(deps);
    assert.equal(first.row.matchId, second.row.matchId);
    assert.equal(first.row.refereeToken, second.row.refereeToken);
  });

  it("token access mode does not require ClubProvider user for valid token row", () => {
    const assigned = makeAssignedInternal();
    const found = findInternalMatchByRefereeToken([assigned], TOKEN);
    const row = projectInternalRefereeTokenScoreboardRow(found);
    const guard = guardRefereeMatchAction({
      user: null,
      matchRow: row,
      action: REFEREE_MATCH_ACTIONS.VIEW,
      accessMode: "token",
    });
    assert.equal(guard.ok, true);
  });

  it("session Team token guard remains unchanged", () => {
    const guard = guardRefereeMatchAction({
      user: {
        id: "ref-team",
        role: ROLES.REFEREE,
        displayName: "Trọng tài A",
        clubId: "c1",
        venueId: "venue-a",
      },
      matchRow: {
        matchId: "m1",
        refereeName: "Trọng tài A",
        refereeToken: "token-abc-team-015xx",
        status: MATCH_LIVE_STATUS.PLAYING,
        scoreA: 1,
        scoreB: 0,
      },
      action: REFEREE_MATCH_ACTIONS.SCORE_INCREMENT,
      scope: { clubId: "c1", venueId: "venue-a" },
      sessionToken: "token-abc-team-015xx",
    });
    assert.equal(guard.ok, true);
  });

  it("route error boundary copy is operator-facing, not a white screen", () => {
    const boundary = readSrc("src/pages/referee/RefereeTokenRouteErrorBoundary.jsx");
    assert.match(boundary, /Không thể mở màn hình chấm trận/);
    assert.match(boundary, /referee-token-route-error/);
  });
});
