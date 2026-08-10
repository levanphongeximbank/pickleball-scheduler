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
import { normalizeTeamData } from "../src/features/team-tournament/models/index.js";
import { createEmptyTeamData } from "../src/features/team-tournament/models/index.js";
import {
  CAPTAIN_ACCESS_RPC_DEPLOYED,
  CAPTAIN_ACCESS_SET_COMMAND,
  CAPTAIN_ACCESS_SET_RPC,
  CAPTAIN_PORTAL_GET_RPC,
  isCaptainAccessCloudWriterDeployed,
  setCaptainAccess,
} from "../src/features/team-tournament/services/captainAccessService.js";
import { buildCaptainPortalPath } from "../src/components/tournament/team/copyPortalLink.js";
import { SCHEDULE_PUBLISH_STATUS } from "../src/features/team-tournament/engines/publishScheduleEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("A — new tournament default captainAccessEnabled=false", () => {
  assert.equal(DEFAULT_TEAM_TOURNAMENT_SETTINGS.captainAccessEnabled, false);
  const empty = createEmptyTeamData();
  assert.equal(empty.settings.captainAccessEnabled, false);
  assert.equal(isCaptainAccessEnabled(empty), false);
});

test("B — missing captainAccessEnabled does not become true on client", () => {
  assert.equal(isCaptainAccessEnabled({}), false);
  assert.equal(isCaptainAccessEnabled({ settings: {} }), false);
  assert.equal(isCaptainAccessEnabled({ settings: { captainAccessEnabled: null } }), false);
  assert.equal(isCaptainAccessEnabled({ settings: { captainAccessEnabled: undefined } }), false);
  assert.equal(isCaptainAccessEnabled({ settings: { captainAccessEnabled: false } }), false);

  const normalizedMissing = normalizeTeamData({ settings: {} });
  assert.notEqual(normalizedMissing.settings.captainAccessEnabled, true);
  assert.equal(isCaptainAccessEnabled(normalizedMissing), false);
});

test("C/D — first-team fallback removed; unproven identity fails closed", () => {
  const teamData = {
    settings: { captainAccessEnabled: true },
    teams: [
      { id: "team-a", captainPlayerId: "p-captain", deputyPlayerIds: [] },
      { id: "team-b", captainPlayerId: "p-other", deputyPlayerIds: [] },
    ],
  };

  const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
  assert.equal(portalSrc.includes("teams?.[0]"), false);
  assert.equal(portalSrc.includes("teams[0]"), false);
  assert.match(portalSrc, /evaluateCaptainPortalAccess/);

  const noPlayer = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1", tenantId: "t1" },
    teamData,
    viewerPlayerId: null,
    findTeamForCaptain,
  });
  assert.equal(noPlayer.allowed, false);
  assert.equal(noPlayer.code, "IDENTITY_UNPROVEN");

  const nonCaptain = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1", tenantId: "t1" },
    teamData,
    viewerPlayerId: "p-stranger",
    findTeamForCaptain,
  });
  assert.equal(nonCaptain.allowed, false);
  assert.equal(nonCaptain.code, "captain_scope_denied");
});

test("portal closed when captainAccessEnabled is not explicit true", () => {
  const denied = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1" },
    teamData: {
      settings: { captainAccessEnabled: false },
      teams: [{ id: "team-a", captainPlayerId: "p1", deputyPlayerIds: [] }],
    },
    viewerPlayerId: "p1",
    findTeamForCaptain,
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "captain_portal_closed");

  const allowed = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1" },
    teamData: {
      settings: { captainAccessEnabled: true },
      teams: [{ id: "team-a", captainPlayerId: "p1", deputyPlayerIds: ["p2"] }],
    },
    viewerPlayerId: "p2",
    findTeamForCaptain,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.captainTeam.id, "team-a");
});

test("E — toggle visible only canManage", () => {
  const toggleSrc = readSrc("src/components/tournament/team/CaptainAccessToggle.jsx");
  assert.match(toggleSrc, /if \(!canManage\)/);
  assert.match(toggleSrc, /return null/);
  assert.match(toggleSrc, /Mở Portal đội trưởng/);
  assert.match(toggleSrc, /Đội trưởng chưa thể truy cập/);
  assert.match(toggleSrc, /Đội trưởng có thể xem lịch của đội và xếp đội hình/);

  const setupSrc = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
  assert.match(setupSrc, /CaptainAccessToggle/);
  assert.match(setupSrc, /canManage=\{access\.canManage\}/);
});

test("F — toggle does not use localStorage", async () => {
  const toggleSrc = readSrc("src/components/tournament/team/CaptainAccessToggle.jsx");
  const serviceSrc = readSrc("src/features/team-tournament/services/captainAccessService.js");
  assert.equal(/\blocalStorage\b/.test(toggleSrc), false);
  assert.equal(/\blocalStorage\b/.test(serviceSrc), false);
  assert.equal(CAPTAIN_ACCESS_RPC_DEPLOYED, true);
  assert.equal(isCaptainAccessCloudWriterDeployed(), true);

  // Writer path is live; contract still rejects missing tournamentId.
  const result = await setCaptainAccess({ tournamentId: "", enabled: true });
  assert.equal(result.ok, false);
  assert.equal(result.code, "VALIDATION_ERROR");
});

test("G — public / schedule publication logic unchanged (independent)", () => {
  const publishSrc = readSrc("src/features/team-tournament/engines/publishScheduleEngine.js");
  assert.equal(publishSrc.includes("captainAccessEnabled"), false);
  assert.equal(SCHEDULE_PUBLISH_STATUS.PUBLISHED, "published");
  assert.equal(SCHEDULE_PUBLISH_STATUS.DRAFT, "draft");

  const policySrc = readSrc("src/features/team-tournament/engines/captainAccessPolicy.js");
  assert.equal(policySrc.includes("schedulePublish"), false);
  assert.equal(policySrc.includes("publication_state"), false);
});

test("H — captain portal route unchanged", () => {
  assert.equal(buildCaptainPortalPath("team-tournament-abc"), "/team-portal/team-tournament-abc");
  const routerSrc = readSrc("src/router.jsx");
  assert.match(routerSrc, /path="\/team-portal\/:tournamentId"/);
});

test("I — organizer path / contracts remain functional", () => {
  assert.equal(CAPTAIN_ACCESS_SET_COMMAND, "captainAccess.set");
  assert.equal(CAPTAIN_ACCESS_SET_RPC, "team_tournament_set_captain_access");
  assert.equal(CAPTAIN_PORTAL_GET_RPC, "team_tournament_get_captain_portal");

  const rpcSrc = readSrc("src/features/team-tournament/services/teamTournamentRpcService.js");
  assert.match(rpcSrc, /rpcTeamTournamentGetSetup/);
  assert.match(rpcSrc, /rpcTeamTournamentSetCaptainAccess/);
  assert.match(rpcSrc, /rpcTeamTournamentGetCaptainPortal/);

  const packageReadme = readSrc(
    "docs/v5/migrations/team-tournament-captain-access-control-01/README.md"
  );
  assert.match(packageReadme, /DO NOT APPLY/);
  assert.match(packageReadme, /team_tournament_get_setup/);
  assert.match(packageReadme, /unchanged/);
});
