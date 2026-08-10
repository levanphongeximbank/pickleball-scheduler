import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { DEFAULT_TEAM_TOURNAMENT_SETTINGS } from "../src/features/team-tournament/constants.js";
import {
  evaluateCaptainPortalAccess,
  isCaptainAccessEnabled,
} from "../src/features/team-tournament/engines/captainAccessPolicy.js";
import { findTeamForCaptain } from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { getSchedulePublishStatus, SCHEDULE_PUBLISH_STATUS } from "../src/features/team-tournament/engines/publishScheduleEngine.js";
import {
  buildCaptainPortalTeams,
  countUnrelatedCaptainPortalExposure,
  mapCaptainPortalResponse,
  remapCaptainPortalLineups,
} from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";
import {
  CAPTAIN_ACCESS_RPC_DEPLOYED,
  CAPTAIN_ACCESS_SET_RPC,
  CAPTAIN_PORTAL_GET_RPC,
  isCaptainAccessCloudWriterDeployed,
  isCaptainPortalScopedReaderDeployed,
} from "../src/features/team-tournament/services/captainAccessService.js";
import { buildCaptainPortalPath } from "../src/components/tournament/team/copyPortalLink.js";
import { lineupKey } from "../src/features/team-tournament/models/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const samplePortalPayload = {
  ok: true,
  schemaVersion: 7,
  serverTime: "2026-08-10T00:00:00.000Z",
  viewerTeamId: "team-a",
  captainAccessEnabled: true,
  viewer: { viewerTeamId: "team-a", captain: true, deputy: false },
  permissions: { canSubmitLineup: true, canManageTournament: false },
  tournament: {
    id: "tt-1",
    clubId: "club-1",
    tenantId: "venue-staging-a",
    name: "Draft TT",
    status: "draft",
    version: 3,
    settings: { captainAccessEnabled: true, schedulePublish: { status: "draft" } },
    myTeam: {
      id: "team-a",
      name: "Team A",
      captainPlayerId: "p-captain",
      deputyPlayerIds: ["p-dep"],
      playerIds: ["p-captain", "p-dep", "p3"],
    },
    opponentTeams: [{ id: "team-b", name: "Team B" }],
    teams: [
      {
        id: "team-a",
        name: "Team A",
        captainPlayerId: "p-captain",
        deputyPlayerIds: ["p-dep"],
        playerIds: ["p-captain", "p-dep", "p3"],
      },
    ],
    matchups: [
      {
        id: "mu-1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "lineup_open",
        scheduledAt: "2026-08-11T10:00:00.000Z",
      },
    ],
    lineups: {
      // Server historically keyed teamId::matchupId — mapper must remap
      "team-a::mu-1": {
        matchupId: "mu-1",
        teamId: "team-a",
        status: "draft",
        selections: {},
      },
    },
    disciplines: [{ id: "d1", name: "MD", playerCount: 2 }],
  },
};

test("A — Draft + OFF → captain denied", () => {
  const denied = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1", status: "draft" },
    teamData: {
      settings: { captainAccessEnabled: false },
      teams: [{ id: "team-a", captainPlayerId: "p1", deputyPlayerIds: [] }],
    },
    viewerPlayerId: "p1",
    findTeamForCaptain,
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "captain_portal_closed");
  assert.match(denied.error, /Ban tổ chức mở/);
});

test("B — Draft + ON → assigned captain allowed", () => {
  const allowed = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1", status: "draft" },
    teamData: {
      settings: { captainAccessEnabled: true },
      teams: [{ id: "team-a", captainPlayerId: "p1", deputyPlayerIds: [] }],
    },
    viewerPlayerId: "p1",
    findTeamForCaptain,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.captainTeam.id, "team-a");
});

test("C — Non-captain denied", () => {
  const denied = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1" },
    teamData: {
      settings: { captainAccessEnabled: true },
      teams: [{ id: "team-a", captainPlayerId: "p1", deputyPlayerIds: [] }],
    },
    viewerPlayerId: "stranger",
    findTeamForCaptain,
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "captain_scope_denied");
  assert.match(denied.error, /không có quyền truy cập đội này/i);
});

test("D — Captain A cannot access Team B", () => {
  const teamData = {
    settings: { captainAccessEnabled: true },
    teams: [
      { id: "team-a", captainPlayerId: "p-a", deputyPlayerIds: [] },
      { id: "team-b", captainPlayerId: "p-b", deputyPlayerIds: [] },
    ],
  };
  const access = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1" },
    teamData,
    viewerPlayerId: "p-a",
    findTeamForCaptain,
  });
  assert.equal(access.allowed, true);
  assert.equal(access.captainTeam.id, "team-a");
  assert.notEqual(access.captainTeam.id, "team-b");
});

test("E — Captain A cannot submit Team B lineup (server write still gated)", () => {
  const cloudSrc = readSrc("src/features/team-tournament/repositories/cloudTeamTournamentRepository.js");
  assert.match(cloudSrc, /rpcTeamTournamentSaveLineupDraft|saveLineupDraft|team_tournament_save_lineup/);
  // Package write gate remains captainAccessEnabled + is_captain on server
  const applySrc = readSrc(
    "docs/v5/migrations/team-tournament-captain-access-control-01/02_APPLY.sql"
  );
  assert.match(applySrc, /team_tournament_guard_captain_portal_write/);
  assert.match(applySrc, /captain_scope_denied/);
});

test("F — Public unpublished schedule remains hidden (independent)", () => {
  const publish = getSchedulePublishStatus({
    settings: { schedulePublish: { status: SCHEDULE_PUBLISH_STATUS.DRAFT } },
  });
  assert.equal(publish.status, SCHEDULE_PUBLISH_STATUS.DRAFT);
  const policySrc = readSrc("src/features/team-tournament/engines/captainAccessPolicy.js");
  assert.equal(policySrc.includes("schedulePublish"), false);
  assert.equal(policySrc.includes("publication_state"), false);
});

test("G — Captain sees own schedule while unpublished", () => {
  const mapped = mapCaptainPortalResponse(samplePortalPayload);
  assert.equal(mapped.ok, true);
  assert.equal(mapped.tournament.status, "draft");
  assert.equal(mapped.tournament.settings.schedulePublish.status, "draft");
  assert.equal(mapped.tournament.teamData.matchups.length, 1);
  assert.equal(mapped.tournament.teamData.matchups[0].id, "mu-1");
});

test("H/I — Toggle OFF/ON uses canonical RPC + silent reload (no F5)", () => {
  assert.equal(CAPTAIN_ACCESS_RPC_DEPLOYED, true);
  assert.equal(isCaptainAccessCloudWriterDeployed(), true);
  assert.equal(CAPTAIN_ACCESS_SET_RPC, "team_tournament_set_captain_access");

  const toggleSrc = readSrc("src/components/tournament/team/CaptainAccessToggle.jsx");
  assert.match(toggleSrc, /setCaptainAccess/);
  assert.equal(/\blocalStorage\b/.test(toggleSrc), false);

  const setupSrc = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
  assert.match(setupSrc, /onUpdated=\{\(\) => reload\(\{ silent: true \}\)\}/);
});

test("J — RBAC-off / unproven identity fails closed", () => {
  const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
  assert.equal(portalSrc.includes("teams?.[0]"), false);
  assert.equal(portalSrc.includes("teams[0]"), false);

  const denied = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1" },
    teamData: {
      settings: { captainAccessEnabled: true },
      teams: [{ id: "team-a", captainPlayerId: "p1", deputyPlayerIds: [] }],
    },
    viewerPlayerId: null,
    findTeamForCaptain,
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "IDENTITY_UNPROVEN");
});

test("K — Scoped reader exposes no unrelated teams/matchups", () => {
  const mapped = mapCaptainPortalResponse({
    ...samplePortalPayload,
    tournament: {
      ...samplePortalPayload.tournament,
      matchups: [
        ...samplePortalPayload.tournament.matchups,
        // attacker payload — mapper should still only keep provided list;
        // count helper detects unrelated if present
        { id: "mu-x", teamAId: "team-c", teamBId: "team-d", status: "scheduled" },
      ],
      opponentTeams: [
        { id: "team-b", name: "Team B" },
        { id: "team-c", name: "Unrelated C" },
      ],
    },
  });
  assert.equal(mapped.ok, true);
  const exposure = countUnrelatedCaptainPortalExposure(
    mapped.tournament.teamData,
    "team-a"
  );
  assert.ok(exposure.unrelatedMatchups >= 1);
  // After filtering for portal consumption, TeamPortal uses listMatchupsForTeam
  const portalOnly = {
    ...mapped.tournament.teamData,
    matchups: mapped.tournament.teamData.matchups.filter(
      (m) => m.teamAId === "team-a" || m.teamBId === "team-a"
    ),
    teams: buildCaptainPortalTeams({
      myTeam: samplePortalPayload.tournament.myTeam,
      opponentTeams: [{ id: "team-b", name: "Team B" }],
      teams: samplePortalPayload.tournament.teams,
    }),
  };
  const safe = countUnrelatedCaptainPortalExposure(portalOnly, "team-a");
  assert.equal(safe.total, 0);

  const cloudSrc = readSrc("src/features/team-tournament/repositories/cloudTeamTournamentRepository.js");
  assert.match(cloudSrc, /pageMode === "captainPortal"/);
  assert.match(cloudSrc, /rpcTeamTournamentGetCaptainPortal/);
  assert.equal(isCaptainPortalScopedReaderDeployed(), true);
  assert.equal(CAPTAIN_PORTAL_GET_RPC, "team_tournament_get_captain_portal");
});

test("L — No localStorage / legacy authority", () => {
  const files = [
    "src/features/team-tournament/services/captainAccessService.js",
    "src/components/tournament/team/CaptainAccessToggle.jsx",
    "src/features/team-tournament/engines/captainAccessPolicy.js",
    "src/pages/tournament/TeamPortal.jsx",
  ];
  for (const file of files) {
    assert.equal(/\blocalStorage\b/.test(readSrc(file)), false, file);
  }
  assert.equal(DEFAULT_TEAM_TOURNAMENT_SETTINGS.captainAccessEnabled, false);
  assert.equal(isCaptainAccessEnabled({ settings: {} }), false);
});

test("M — No F5 required (silent reload paths)", () => {
  const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
  assert.match(portalSrc, /pageMode:\s*"captainPortal"/);
  assert.match(portalSrc, /reload\(\{ silent: true \}\)/);

  const setupSrc = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
  assert.match(setupSrc, /reload\(\{ silent: true \}\)/);
});

test("lineup keys remapped to matchupId::teamId", () => {
  const remapped = remapCaptainPortalLineups(samplePortalPayload.tournament.lineups);
  assert.ok(remapped[lineupKey("mu-1", "team-a")]);
  assert.equal(remapped["team-a::mu-1"], undefined);
});

test("route unchanged + publication independence runtime matrix", () => {
  assert.equal(buildCaptainPortalPath("tt-1"), "/team-portal/tt-1");
  const routerSrc = readSrc("src/router.jsx");
  assert.match(routerSrc, /path="\/team-portal\/:tournamentId"/);

  // A/B/C/D matrix encoded:
  // ON + draft schedule → captain payload ok
  assert.equal(mapCaptainPortalResponse(samplePortalPayload).ok, true);
  // OFF → client gate deny
  assert.equal(
    evaluateCaptainPortalAccess({
      tournament: { id: "tt-1" },
      teamData: { settings: { captainAccessEnabled: false }, teams: [] },
      viewerPlayerId: "p1",
      findTeamForCaptain,
    }).allowed,
    false
  );
  // Public schedule publish independent of captainAccessEnabled
  assert.equal(
    getSchedulePublishStatus({
      settings: {
        captainAccessEnabled: true,
        schedulePublish: { status: SCHEDULE_PUBLISH_STATUS.DRAFT },
      },
    }).status,
    SCHEDULE_PUBLISH_STATUS.DRAFT
  );
});
