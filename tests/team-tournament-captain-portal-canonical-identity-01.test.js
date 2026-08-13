/**
 * PR #418 IT421 captain portal canonical identity.
 * athletes.id is Team Tournament captain authority; profiles.player_id is not.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  evaluateCaptainPortalAccess,
} from "../src/features/team-tournament/engines/captainAccessPolicy.js";
import {
  extractServerCaptainViewerPlayerId,
  lookupCanonicalCaptainAthleteId,
  resolveCanonicalCaptainAthleteIdFromUser,
  resolveUniqueCaptainTeam,
  selectCanonicalAthleteIdForUser,
} from "../src/features/team-tournament/engines/captainIdentityResolver.js";
import {
  findTeamForCaptain,
  resolveCaptainViewerPlayerId,
} from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { resolveDashboardCapabilities } from "../src/features/team-tournament/dashboard/teamTournamentDashboardModel.js";
import { rejectClientViewerTeamIdForCloud } from "../src/features/team-tournament/repositories/teamTournamentRepositoryValidation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const TT412_AUTH = "c412a001-7e57-4000-8000-000000000002";
const TT412_ATHLETE = "c412a101-7e57-4000-8000-000000000002";
const IT421_AUTH = "c421a001-7e57-4000-8000-000000000003";
const IT421_ATHLETE = "c421a101-7e57-4000-8000-000000000003";
const IT421_PROFILE_PLAYER_ID = "qa-it421-nam-03";

function enabledTeamData(teams) {
  return {
    settings: { captainAccessEnabled: true },
    teams,
    matchups: [],
  };
}

function portalAccess(viewerPlayerId, teams) {
  return evaluateCaptainPortalAccess({
    tournament: { id: "89d8ffed-70f1-4bd1-9294-abdf0016bbad", tenantId: "venue-staging-a" },
    teamData: enabledTeamData(teams),
    viewerPlayerId,
    findTeamForCaptain,
  });
}

test("1. TT412 captain resolves via athletes.id even when profile.player_id matches", () => {
  const user = {
    id: TT412_AUTH,
    playerId: TT412_ATHLETE,
    player_id: TT412_ATHLETE,
    athleteId: TT412_ATHLETE,
  };
  assert.equal(resolveCanonicalCaptainAthleteIdFromUser(user), TT412_ATHLETE);
  const access = portalAccess(TT412_ATHLETE, [
    { id: "team-1", name: "Đội 1", captainPlayerId: TT412_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, true);
  assert.equal(access.captainTeam.id, "team-1");
});

test("2. IT421 captain resolves via athletes.id while profiles.player_id is a legacy alias", async () => {
  const user = {
    id: IT421_AUTH,
    playerId: IT421_PROFILE_PLAYER_ID,
    player_id: IT421_PROFILE_PLAYER_ID,
  };
  assert.equal(resolveCanonicalCaptainAthleteIdFromUser(user), null);
  assert.equal(resolveCaptainViewerPlayerId(user), null);

  const lookedUp = await lookupCanonicalCaptainAthleteId({
    userId: IT421_AUTH,
    fetchCanonicalAthleteIdViaRpc: async () => ({
      ok: true,
      athleteId: IT421_ATHLETE,
    }),
    fetchAthletesByUserId: async () => ({
      ok: true,
      rows: [{ id: "should-not-win", user_id: IT421_AUTH, status: "active" }],
    }),
  });
  assert.equal(lookedUp.ok, true);
  assert.equal(lookedUp.athleteId, IT421_ATHLETE);

  const deniedByAlias = portalAccess(IT421_PROFILE_PLAYER_ID, [
    { id: "team-4", name: "Đội 4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(deniedByAlias.allowed, false);
  assert.equal(deniedByAlias.code, "NOT_CAPTAIN");

  const allowed = portalAccess(IT421_ATHLETE, [
    { id: "team-4", name: "Đội 4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.captainTeam.id, "team-4");
});

test("3. auth.uid → athletes.user_id → athletes.id", () => {
  const selected = selectCanonicalAthleteIdForUser(
    [{ id: IT421_ATHLETE, user_id: IT421_AUTH, status: "active" }],
    IT421_AUTH
  );
  assert.equal(selected.ok, true);
  assert.equal(selected.athleteId, IT421_ATHLETE);
});

test("4. profiles.player_id absent/irrelevant still works", () => {
  const user = { id: IT421_AUTH, athleteId: IT421_ATHLETE };
  assert.equal(resolveCanonicalCaptainAthleteIdFromUser(user), IT421_ATHLETE);
  const access = portalAccess(IT421_ATHLETE, [
    { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, true);
});

test("5. auth user id != athlete id still works", () => {
  assert.notEqual(IT421_AUTH, IT421_ATHLETE);
  assert.equal(
    resolveCanonicalCaptainAthleteIdFromUser({ id: IT421_AUTH, athleteId: IT421_AUTH }),
    null
  );
  const access = portalAccess(IT421_ATHLETE, [
    { id: "team-8", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, true);
});

test("6. non-captain denied", () => {
  const access = portalAccess("stranger-athlete", [
    { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, false);
  assert.equal(access.code, "NOT_CAPTAIN");
});

test("7. cross-tenant denied", () => {
  const access = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1", tenantId: "venue-staging-a" },
    teamData: enabledTeamData([
      { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
    ]),
    viewerPlayerId: IT421_ATHLETE,
    tenantCheck: { ok: false, error: "Không có quyền tenant.", code: "TENANT_DENIED" },
    findTeamForCaptain,
  });
  assert.equal(access.allowed, false);
  assert.equal(access.code, "TENANT_DENIED");
});

test("8. persisted captain can enter portal", () => {
  const access = portalAccess(IT421_ATHLETE, [
    { id: "team-4", name: "Đội 4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, true);
});

test("9. captain with no current matchup is allowed, not unauthorized", () => {
  const access = portalAccess(IT421_ATHLETE, [
    { id: "team-4", name: "Đội 4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, true);
  assert.notEqual(access.code, "NOT_CAPTAIN");
  assert.equal(access.error, null);
});

test("10. lineup_open captain still has ownership", () => {
  const access = evaluateCaptainPortalAccess({
    tournament: { id: "tt-1", tenantId: "venue-staging-a" },
    teamData: {
      settings: { captainAccessEnabled: true },
      teams: [{ id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] }],
      matchups: [{ id: "m1", teamAId: "team-4", teamBId: "team-1", status: "scheduled" }],
    },
    viewerPlayerId: IT421_ATHLETE,
    findTeamForCaptain,
  });
  assert.equal(access.allowed, true);
});

test("11. wrong captain cannot access another team", () => {
  const access = portalAccess(TT412_ATHLETE, [
    { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
    { id: "team-1", captainPlayerId: TT412_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, true);
  assert.equal(access.captainTeam.id, "team-1");
  assert.notEqual(access.captainTeam.id, "team-4");
});

test("12-15. F5 / fresh tab / account switch / no localStorage team authority", () => {
  const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
  const identitySrc = readSrc("src/features/team-tournament/engines/captainIdentityResolver.js");
  const permissionSrc = readSrc("src/features/team-tournament/engines/teamPermissionEngine.js");
  const hookSrc = readSrc("src/features/team-tournament/ui/useCanonicalCaptainAthleteId.js");

  assert.match(portalSrc, /useCanonicalCaptainAthleteId/);
  assert.equal(portalSrc.includes("fetchProfileByUserId"), false);
  assert.equal(portalSrc.includes("profile?.player_id"), false);
  assert.equal(portalSrc.includes("localStorage.getItem"), false);
  assert.equal(portalSrc.includes("loadAthleteClubLink"), false);
  assert.equal(permissionSrc.includes("loadAthleteClubLink"), false);
  assert.equal(permissionSrc.includes("user.playerId || user.player_id"), false);
  assert.match(hookSrc, /user\?\.id/);
  assert.equal(identitySrc.includes("localStorage.getItem"), false);
  assert.match(identitySrc, /athletes\.id/);

  const rejected = rejectClientViewerTeamIdForCloud(
    { viewerTeamId: "team-stale-from-previous-user" },
    "cloud"
  );
  assert.ok(rejected);
  assert.equal(rejected.ok, false);
});

test("16-18. TT412-shaped, IT421-shaped, UUID athlete id distinct from auth uid", () => {
  assert.equal(
    resolveCanonicalCaptainAthleteIdFromUser({
      id: TT412_AUTH,
      athleteId: TT412_ATHLETE,
      playerId: TT412_ATHLETE,
    }),
    TT412_ATHLETE
  );
  assert.equal(
    resolveCanonicalCaptainAthleteIdFromUser({
      id: IT421_AUTH,
      playerId: IT421_PROFILE_PLAYER_ID,
    }),
    null
  );
  assert.notEqual(IT421_ATHLETE, IT421_AUTH);
});

test("19. exactly one captain team resolves deterministically", () => {
  const resolved = resolveUniqueCaptainTeam(
    enabledTeamData([
      { id: "team-2", captainPlayerId: "a2", deputyPlayerIds: [] },
      { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
    ]),
    IT421_ATHLETE
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.team.id, "team-4");
});

test("20. zero captain teams → structured NOT_CAPTAIN", () => {
  const resolved = resolveUniqueCaptainTeam(
    enabledTeamData([{ id: "team-1", captainPlayerId: TT412_ATHLETE, deputyPlayerIds: [] }]),
    IT421_ATHLETE
  );
  assert.equal(resolved.ok, false);
  assert.equal(resolved.code, "NOT_CAPTAIN");
});

test("21. multiple captain teams → structured ambiguity / fail closed", () => {
  const resolved = resolveUniqueCaptainTeam(
    enabledTeamData([
      { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
      { id: "team-8", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
    ]),
    IT421_ATHLETE
  );
  assert.equal(resolved.ok, false);
  assert.equal(resolved.code, "CAPTAIN_TEAM_AMBIGUOUS");
  const access = portalAccess(IT421_ATHLETE, [
    { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
    { id: "team-8", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [] },
  ]);
  assert.equal(access.allowed, false);
  assert.equal(access.code, "CAPTAIN_TEAM_AMBIGUOUS");
});

test("dashboard does not treat profile player_id as captain when athlete id is canonical", () => {
  const teams = [
    { id: "team-4", captainPlayerId: IT421_ATHLETE, deputyPlayerIds: [], playerIds: [IT421_ATHLETE] },
  ];
  const wrong = resolveDashboardCapabilities({
    teamData: { teams },
    playerId: IT421_PROFILE_PLAYER_ID,
    userId: IT421_AUTH,
  });
  assert.equal(wrong.isCaptain, false);
  const right = resolveDashboardCapabilities({
    teamData: { teams },
    playerId: IT421_ATHLETE,
    userId: IT421_AUTH,
  });
  assert.equal(right.isCaptain, true);
  assert.equal(right.captainTeamId, "team-4");
});

test("cloud page access ignores profiles.player_id", () => {
  const cloudSrc = readSrc("src/features/team-tournament/ui/teamTournamentCloudAccess.js");
  assert.match(cloudSrc, /resolveCanonicalCaptainAthleteIdFromUser/);
  assert.equal(cloudSrc.includes("user?.playerId"), false);
  assert.equal(cloudSrc.includes("user.playerId"), false);
  assert.equal(
    resolveCanonicalCaptainAthleteIdFromUser({
      id: IT421_AUTH,
      playerId: IT421_PROFILE_PLAYER_ID,
      role: "PLAYER",
    }),
    null
  );
  assert.equal(
    resolveCanonicalCaptainAthleteIdFromUser({
      id: IT421_AUTH,
      athleteId: IT421_ATHLETE,
      role: "PLAYER",
    }),
    IT421_ATHLETE
  );
});

test("server viewerPlayerId is athletes.id, not profiles.player_id alias", () => {
  assert.equal(
    extractServerCaptainViewerPlayerId({ viewerPlayerId: IT421_ATHLETE }),
    IT421_ATHLETE
  );
  assert.equal(
    extractServerCaptainViewerPlayerId({
      viewerPlayerId: IT421_AUTH,
      userId: IT421_AUTH,
    }),
    null
  );
});

test("source lock: portal identity path has no profiles.player_id authority", () => {
  const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
  const resolverSrc = readSrc("src/features/team-tournament/engines/captainIdentityResolver.js");
  const dashboardSrc = readSrc("src/pages/tournament/TournamentDashboardPage.jsx");
  const listSrc = readSrc("src/features/tournament/pages/CanonicalTournamentListPage.jsx");
  const homeSrc = readSrc("src/pages/tournament/TournamentHome.jsx");
  const permissionSrc = readSrc("src/features/team-tournament/engines/teamPermissionEngine.js");
  const serviceSrc = readSrc("src/features/team-tournament/services/teamTournamentService.js");
  assert.match(dashboardSrc, /useCanonicalCaptainAthleteId/);
  assert.equal(dashboardSrc.includes("user?.playerId || user?.linkedPlayerId"), false);
  assert.match(resolverSrc, /auth\.uid\(\) → athletes\.user_id → athletes\.id/);
  assert.equal(portalSrc.includes("useResolvedCaptainPlayerId"), false);
  assert.equal(listSrc.includes("user?.playerId"), false);
  assert.equal(homeSrc.includes("user?.playerId"), false);
  assert.equal(permissionSrc.includes("loadAthleteClubLink"), false);
  assert.equal(serviceSrc.includes("user?.playerId ? String(user.playerId)"), false);
});
