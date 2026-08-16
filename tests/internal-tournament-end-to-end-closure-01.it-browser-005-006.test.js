/**
 * IT-BROWSER-004/005/006 — referee lifecycle surface, tab-return stability,
 * AI canonical context, optional Elo banner.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import { canonicalRowToTournament } from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { updateTournamentCommand } from "../src/features/tournament/services/tournamentCommands.js";
import { __resetTournamentRepositorySingleton } from "../src/features/tournament/repositories/tournamentRepositoryFactory.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import {
  INTERNAL_NO_REFEREE_ROSTER_MESSAGE,
  INTERNAL_OPTIONAL_ELO_SEASON_NOTICE,
  INTERNAL_WORKSPACE_SECTIONS,
  assignInternalMatchReferee,
  classifyCanonicalMatchLifecycleResult,
  formatInternalMatchRefereeLabel,
  listEligibleInternalReferees,
  mapLifecycleStepToWorkspaceSection,
  resolveCanonicalIdentityChangePolicy,
  resolveCanonicalScopeGapPolicy,
  resolveInternalPageLoadingGate,
  resolveTournamentManageGatePresentation,
  summarizeInternalRefereeCoverage,
} from "../src/features/tournament/internal/index.js";
import { INTERNAL_LIFECYCLE_STEPS } from "../src/features/tournament/internal/internalTournamentLifecycleResolver.js";
import {
  isSameAuthIdentity,
  shouldRefreshUiOnAuthEvent,
} from "../src/auth/authService.js";
import { shouldBlockRouteForAuthLoading } from "../src/auth/authGuard.js";
import {
  CLUB_READ_STATE,
  resolveCanonicalClubRefreshPolicy,
} from "../src/features/club/context/clubCanonicalReadModel.js";
import { guardAiAccess } from "../src/features/ai-assistant/guards/aiAccessGuard.js";
import { getAiTournamentSummary } from "../src/features/ai-assistant/services/aiEngineService.js";
import { createRefereeRosterEntry } from "../src/models/tournament/refereeRoster.js";
import { buildRefereeSettingsPatch } from "../src/tournament/engines/refereeEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_VERSION = 8;
const TOURNAMENT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const REFEREE_ID = "ref-roster-internal-2";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeRow(overrides = {}) {
  return {
    id: TOURNAMENT_ID,
    tenant_id: "tenant-a",
    club_id: "club-a",
    external_key: TOURNAMENT_ID,
    name: "Internal Browser Context",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.READY,
    season_id: null,
    league_id: null,
    payload: {
      settings: {
        refereeRoster: [{ id: REFEREE_ID, name: "Trọng tài B", active: true }],
      },
      events: [
        {
          id: "event-1",
          eventType: EVENT_TYPE.MIXED_DOUBLE,
          groups: [{ id: "G1", label: "A", name: "Bảng A" }],
          entries: [
            { id: "e1", name: "Đội 1" },
            { id: "e2", name: "Đội 2" },
          ],
          matches: [
            {
              id: "m-group-1",
              groupId: "G1",
              entryAId: "e1",
              entryBId: "e2",
              status: MATCH_STATUS.PENDING,
            },
            {
              id: "m-ko-1",
              bracketMatchId: "R1-M1",
              entryAId: "e1",
              entryBId: "e2",
              status: MATCH_STATUS.PENDING,
            },
          ],
        },
      ],
    },
    engine_v4: {},
    version: SERVER_VERSION,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createBrowserCasStore(initialRow) {
  let store = { ...initialRow, version: Number(initialRow.version || 1) };
  const patches = [];

  const rpc = async (name, args) => {
    if (name === "canonical_tournament_get") {
      return { ok: true, tournament: store };
    }
    if (name === "canonical_tournament_update") {
      const patch = args.p_patch || {};
      patches.push(patch);
      if (patch.expected_version == null || String(patch.expected_version).trim() === "") {
        throw new Error("expected_version is required for internal_tournament updates.");
      }
      if (Number(patch.expected_version) !== Number(store.version)) {
        return {
          ok: false,
          code: "VERSION_CONFLICT",
          error: "VERSION_CONFLICT",
        };
      }
      store = {
        ...store,
        payload: patch.payload ?? store.payload,
        engine_v4: patch.engine_v4 ?? store.engine_v4,
        version: Number(store.version) + 1,
        updated_at: new Date().toISOString(),
      };
      return { ok: true, tournament: store };
    }
    return { ok: false, code: "UNEXPECTED", error: name };
  };

  return { rpc, getStore: () => store, getPatches: () => patches };
}

describe("IT-BROWSER-005 — tab return does not reset initial loading", () => {
  const sameUser = { id: "user-1", role: "CLUB_OWNER" };
  const sameUserNewToken = { id: "user-1", role: "CLUB_OWNER", accessToken: "next" };
  const otherUser = { id: "user-2", role: "CLUB_OWNER" };

  it("TOKEN_REFRESHED and same-user SIGNED_IN do not rebuild Auth UI", () => {
    assert.equal(shouldRefreshUiOnAuthEvent("TOKEN_REFRESHED", sameUser, sameUserNewToken), false);
    assert.equal(shouldRefreshUiOnAuthEvent("SIGNED_IN", sameUser, sameUserNewToken), false);
    assert.equal(shouldRefreshUiOnAuthEvent("INITIAL_SESSION", sameUser, sameUserNewToken), false);
    assert.equal(shouldRefreshUiOnAuthEvent("USER_UPDATED", sameUser, sameUserNewToken), false);
    assert.equal(isSameAuthIdentity(sameUser, sameUserNewToken), true);
    assert.equal(shouldRefreshUiOnAuthEvent("SIGNED_IN"), true);
    assert.equal(shouldRefreshUiOnAuthEvent("SIGNED_IN", null, sameUser), true);
    assert.equal(shouldRefreshUiOnAuthEvent("SIGNED_IN", sameUser, otherUser), true);
    assert.equal(shouldRefreshUiOnAuthEvent("SIGNED_OUT", sameUser, null), true);
    assert.equal(isSameAuthIdentity(sameUser, otherUser), false);
    const auth = readSrc("src/context/AuthContext.jsx");
    assert.match(auth, /selectStableAuthState/);
    assert.match(auth, /subscribeToSupabaseAuth\(\(\) => \{/);
  });

  it("ClubContext retains last clubs on same-identity refresh and clears on user change", () => {
    const identity = "1::user-1::CLUB_OWNER::tenant-a::1";
    const same = resolveCanonicalClubRefreshPolicy({
      previousIdentityKey: identity,
      nextIdentityKey: identity,
      clubReadState: CLUB_READ_STATE.READY,
      clubCount: 2,
    });
    assert.equal(same.clearClubs, false);
    assert.equal(same.emitLoading, false);
    assert.equal(same.staleWhileRevalidate, true);

    const switched = resolveCanonicalClubRefreshPolicy({
      previousIdentityKey: identity,
      nextIdentityKey: "1::user-2::CLUB_OWNER::tenant-a::1",
      clubReadState: CLUB_READ_STATE.READY,
      clubCount: 2,
    });
    assert.equal(switched.clearClubs, true);
    assert.equal(switched.emitLoading, true);
    assert.equal(switched.staleWhileRevalidate, false);

    const signedOut = resolveCanonicalClubRefreshPolicy({
      previousIdentityKey: identity,
      nextIdentityKey: "0::::0",
      clubReadState: CLUB_READ_STATE.READY,
      clubCount: 2,
    });
    assert.equal(signedOut.clearClubs, true);
    assert.equal(signedOut.idle, true);

    const club = readSrc("src/context/ClubContext.jsx");
    assert.match(club, /resolveCanonicalClubRefreshPolicy/);
    assert.match(club, /clubRehydrateScopeKey/);
    assert.match(club, /staleWhileRevalidate/);
  });

  it("known authenticated user does not get a route-guard full-page spinner", () => {
    assert.equal(
      shouldBlockRouteForAuthLoading({
        authLoading: true,
        isAuthenticated: true,
        user: { id: "u1" },
        pathname: "/tournament/internal/abc",
      }),
      false
    );
    assert.equal(
      shouldBlockRouteForAuthLoading({
        authLoading: true,
        isAuthenticated: false,
        pathname: "/tournament/internal/abc",
      }),
      true
    );
    assert.equal(
      shouldBlockRouteForAuthLoading({
        authLoading: true,
        isAuthenticated: false,
        pathname: "/login",
      }),
      false
    );
    const gate = readSrc("src/components/auth/RouteAccessGate.jsx");
    assert.match(gate, /shouldBlockRouteForAuthLoading/);
  });

  it("scope gap after load keeps tournament and does not toggle initial loading", () => {
    const keep = resolveCanonicalScopeGapPolicy({
      hasTournament: true,
      tournamentId: TOURNAMENT_ID,
    });
    assert.equal(keep.keepRenderedTournament, true);
    assert.equal(keep.clearTournament, false);
    assert.equal(keep.initialLoading, false);

    const first = resolveCanonicalScopeGapPolicy({
      hasTournament: false,
      tournamentId: TOURNAMENT_ID,
    });
    assert.equal(first.clearTournament, true);
    assert.equal(first.initialLoading, true);

    const gap = resolveCanonicalIdentityChangePolicy({
      previousClubId: "club-a",
      nextClubId: "",
      previousTenantId: "tenant-a",
      nextTenantId: "",
      previousTournamentId: TOURNAMENT_ID,
      nextTournamentId: TOURNAMENT_ID,
    });
    assert.equal(gap.clearTournament, false);
    assert.equal(gap.reason, "club-scope-gap");

    const otherClub = resolveCanonicalIdentityChangePolicy({
      previousClubId: "club-a",
      nextClubId: "club-b",
      previousTenantId: "tenant-a",
      nextTenantId: "tenant-a",
      previousTournamentId: TOURNAMENT_ID,
      nextTournamentId: TOURNAMENT_ID,
    });
    assert.equal(otherClub.clearTournament, true);

    const pageKeep = resolveInternalPageLoadingGate({
      clubScopeOk: false,
      tournamentLoading: true,
      tournament: { id: TOURNAMENT_ID },
    });
    assert.equal(pageKeep.showFullPageLoading, false);
    assert.equal(pageKeep.keepWorkspace, true);

    const pageInitial = resolveInternalPageLoadingGate({
      clubScopeOk: true,
      tournamentLoading: true,
      tournament: null,
    });
    assert.equal(pageInitial.showFullPageLoading, true);
    assert.equal(pageInitial.reason, "initial-load");

    const manageKeep = resolveTournamentManageGatePresentation({
      tournamentId: TOURNAMENT_ID,
      loading: true,
      tournament: { id: TOURNAMENT_ID },
      activeClubId: "",
    });
    assert.equal(manageKeep.showFullPageLoading, false);
    assert.equal(manageKeep.keepChildren, true);
    assert.equal(manageKeep.assertAccess, false);

    const manageSpin = resolveTournamentManageGatePresentation({
      tournamentId: TOURNAMENT_ID,
      loading: true,
      tournament: null,
      activeClubId: "club-a",
    });
    assert.equal(manageSpin.showFullPageLoading, true);

    const hook = readSrc("src/features/tournament/hooks/useCanonicalTournament.js");
    assert.match(hook, /resolveCanonicalScopeGapPolicy/);
    assert.match(hook, /resolveCanonicalIdentityChangePolicy/);
    assert.match(hook, /lastAuthoritativeRef/);
    assert.match(hook, /sameScopeRestored/);

    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /resolveInternalPageLoadingGate/);
    assert.match(setup, /tournament=\{tournament\}/);
    assert.equal(/if \(!clubScope\.ok\) \{/.test(setup), false);

    const manage = readSrc("src/components/tournament/TournamentManageGate.jsx");
    assert.match(manage, /resolveTournamentManageGatePresentation/);
    assert.match(manage, /loadedTournament/);
  });
});

describe("IT-BROWSER-004 — Internal referee lifecycle section", () => {
  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("Trọng tài is an operational workspace section", () => {
    assert.equal(INTERNAL_WORKSPACE_SECTIONS.REFEREE, "referee");
    assert.equal(
      mapLifecycleStepToWorkspaceSection(INTERNAL_LIFECYCLE_STEPS.REFEREE),
      INTERNAL_WORKSPACE_SECTIONS.REFEREE
    );
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /InternalRefereeStage/);
    assert.match(setup, /INTERNAL_WORKSPACE_SECTIONS\.REFEREE/);
    const stage = readSrc("src/components/tournament/internal/InternalRefereeStage.jsx");
    assert.match(stage, /Danh sách trọng tài/);
    assert.match(stage, /Phân công theo trận/);
    assert.match(stage, /Tổng số trận/);
    const schedule = readSrc("src/components/tournament/internal/InternalScheduleStage.jsx");
    assert.match(schedule, /Trọng tài/);
    assert.match(schedule, /formatInternalMatchRefereeLabel/);
  });

  it("coverage and schedule label use canonical referee identity", () => {
    const tournament = canonicalRowToTournament(makeRow());
    const event = tournament.events[0];
    const empty = summarizeInternalRefereeCoverage(event);
    assert.equal(empty.total, 2);
    assert.equal(empty.assigned, 0);
    assert.equal(empty.unassigned, 2);
    assert.equal(formatInternalMatchRefereeLabel(event.matches[0]), "Chưa phân công");

    const assigned = assignInternalMatchReferee({
      tournament,
      event,
      matchId: "m-group-1",
      rosterId: REFEREE_ID,
    });
    assert.equal(assigned.ok, true);
    const coverage = summarizeInternalRefereeCoverage(assigned.event);
    assert.equal(coverage.assigned, 1);
    assert.equal(coverage.unassigned, 1);
    assert.equal(
      formatInternalMatchRefereeLabel(assigned.event.matches[0]),
      "Trọng tài B"
    );
  });

  it("roster add and group/KO assignment persist with CAS and survive fresh get", async () => {
    const row = makeRow({
      payload: {
        settings: { refereeRoster: [] },
        events: makeRow().payload.events,
      },
    });
    const store = createBrowserCasStore(row);
    const repo = createCloudTournamentRepository({ rpc: store.rpc });
    let tournament = canonicalRowToTournament(row);
    const entry = createRefereeRosterEntry({ name: "Trọng tài B" });
    const rosterPatch = buildRefereeSettingsPatch(tournament, { roster: [entry] });

    const rosterResult = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      TOURNAMENT_ID,
      rosterPatch,
      {
        repository: repo,
        tenantId: "tenant-a",
        currentTournament: tournament,
        expectedVersion: tournament.version,
      }
    );
    assert.equal(rosterResult.ok, true, rosterResult.error);
    tournament = rosterResult.tournament;
    const rosterId = listEligibleInternalReferees(tournament)[0].id;
    assert.equal(Boolean(rosterId), true);

    const groupAssigned = assignInternalMatchReferee({
      tournament,
      event: tournament.events[0],
      matchId: "m-group-1",
      rosterId,
    });
    const groupResult = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      TOURNAMENT_ID,
      { events: [groupAssigned.event] },
      {
        repository: repo,
        tenantId: "tenant-a",
        currentTournament: tournament,
        expectedVersion: tournament.version,
      }
    );
    assert.equal(groupResult.ok, true, groupResult.error);
    tournament = groupResult.tournament;

    const koAssigned = assignInternalMatchReferee({
      tournament,
      event: tournament.events[0],
      matchId: "m-ko-1",
      rosterId,
    });
    const koResult = await updateTournamentCommand(
      { id: "club-a", tenantId: "tenant-a" },
      TOURNAMENT_ID,
      { events: [koAssigned.event] },
      {
        repository: repo,
        tenantId: "tenant-a",
        currentTournament: tournament,
        expectedVersion: tournament.version,
      }
    );
    assert.equal(koResult.ok, true, koResult.error);
    assert.equal(Number(store.getPatches().at(-1).expected_version), SERVER_VERSION + 2);

    const fresh = canonicalRowToTournament(store.getStore());
    const matches = fresh.events[0].matches;
    assert.equal(matches.find((item) => item.id === "m-group-1")?.referee?.rosterId, rosterId);
    assert.equal(matches.find((item) => item.id === "m-ko-1")?.referee?.rosterId, rosterId);
    assert.equal(summarizeInternalRefereeCoverage(fresh.events[0]).assigned, 2);
  });

  it("explains empty roster and rejects foreign referee", () => {
    const tournament = canonicalRowToTournament(
      makeRow({
        payload: { settings: { refereeRoster: [] }, events: makeRow().payload.events },
      })
    );
    const empty = assignInternalMatchReferee({
      tournament,
      event: tournament.events[0],
      matchId: "m-group-1",
      rosterId: REFEREE_ID,
    });
    assert.equal(empty.ok, false);
    assert.equal(empty.error, INTERNAL_NO_REFEREE_ROSTER_MESSAGE);
  });
});

describe("IT-BROWSER-006 — AI canonical context and optional Elo", () => {
  it("loaded Internal tournament does not produce Không tìm thấy giải", () => {
    const tournament = canonicalRowToTournament(makeRow());
    const guardSrc = readSrc("src/features/ai-assistant/guards/aiAccessGuard.js");
    assert.match(guardSrc, /assertLoadedTournamentAccess/);
    const panel = readSrc("src/components/tournament/ai/TournamentAiAssistantPanel.jsx");
    assert.match(panel, /tournament = null/);
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /tournament=\{tournament\}/);

    const canonical = guardAiAccess({
      clubId: "club-a",
      tournamentId: TOURNAMENT_ID,
      tenantId: "tenant-a",
      tournament,
    });
    assert.notEqual(canonical.code, "NOT_FOUND");
    assert.notEqual(canonical.error, "Không tìm thấy giải.");

    return getAiTournamentSummary(TOURNAMENT_ID, "tenant-a", {
      clubId: "club-a",
      tournament,
      players: [],
      courts: [],
    }).then((result) => {
      assert.notEqual(result.code, "NOT_FOUND");
      assert.notEqual(result.error, "Không tìm thấy giải.");
    });
  });

  it("optional Elo/season failure is not a blocking global banner", () => {
    const classified = classifyCanonicalMatchLifecycleResult({
      ok: true,
      lifecycleOk: false,
      lifecycleError: "Lifecycle Elo/điểm mùa thất bại.",
    });
    assert.equal(classified.class, "OPTIONAL_ENRICHMENT");
    assert.equal(classified.banner, "local-warning");
    assert.equal(classified.message, INTERNAL_OPTIONAL_ELO_SEASON_NOTICE);

    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /classifyCanonicalMatchLifecycleResult/);
    assert.match(setup, /setLifecycleNotice/);
    assert.equal(/Lifecycle Elo\/điểm mùa thất bại/.test(setup), false);
    assert.match(setup, /get\("debug"\) === "1"/);
    assert.match(setup, /import\.meta\.env\?\.DEV/);
  });
});
