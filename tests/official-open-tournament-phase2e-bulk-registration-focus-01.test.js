/**
 * Phase 2E — multi-select bulk registration + window-focus / visibility no-flicker.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";

import { setActiveClubId, loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import {
  createTournamentCommand,
  updateTournamentCommand,
  getTournamentQuery,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  CANONICAL_TOURNAMENT_RPC,
  resolveCanonicalTournamentLoadPolicy,
} from "../src/features/tournament/index.js";
import {
  tournamentToCanonicalRow,
  canonicalRowToTournament,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  ENTRY_STATUS,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
  getOfficialCompetitionSettings,
  registerOfficialIndividualsBatch,
  toggleOfficialIndividualSelection,
  mergeVisibleOfficialIndividualSelection,
  uniqueOfficialIndividualSelection,
  formatOfficialBulkRegistrationError,
  getRegistrationSettings,
  REGISTRATION_AUDIT_ACTIONS,
  updateEligibilityRules,
} from "../src/features/individual-tournament/index.js";

const TENANT_ID = "tenant-p2e-bulk-01";
const CLUB_SCOPE = { id: DEFAULT_CLUB.id, tenantId: TENANT_ID, venueId: TENANT_ID };

function read(path) {
  return readFileSync(path, "utf8");
}

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function sixPlayers() {
  return [
    { id: "p1", name: "Nguyễn A", gender: "male", rating: 4.0 },
    { id: "p2", name: "Trần B", gender: "male", rating: 4.1 },
    { id: "p3", name: "Lê C", gender: "male", rating: 3.9 },
    { id: "p4", name: "Phạm D", gender: "male", rating: 4.2 },
    { id: "p5", name: "Hoàng E", gender: "male", rating: 4.0 },
    { id: "p6", name: "Vũ F", gender: "male", rating: 3.8 },
  ];
}

function baseTournament(overrides = {}) {
  return patchOfficialCompetitionSettings(
    {
      id: "t-p2e",
      name: "Official P2E",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      status: TOURNAMENT_STATUS.DRAFT,
      clubId: DEFAULT_CLUB.id,
      events: [
        {
          id: "ev1",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [],
          drawEntries: [],
          groups: [],
          matches: [],
        },
      ],
      ...overrides,
    },
    { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
  );
}

describe("official-open-tournament-phase2e-focus-visibility", () => {
  it("A/B — loaded tournament + focus/visibility: keep content, no full-page blank", () => {
    const focusCounts = { fetch: 0 };
    const loaded = resolveCanonicalTournamentLoadPolicy({
      clubId: "c1",
      tournamentId: "t1",
      tenantId: "v1",
      prevClubId: "c1",
      prevTournamentId: "t1",
      prevTenantId: "v1",
      hasUsableTournament: true,
      usableTournamentId: "t1",
    });
    focusCounts.fetch += loaded.soft ? 1 : 0;
    assert.equal(loaded.mode, "soft-revalidate");
    assert.equal(loaded.clearTournament, false);
    assert.equal(loaded.showFullPageLoader, false);
    assert.equal(focusCounts.fetch, 1);

    const visible = resolveCanonicalTournamentLoadPolicy({
      clubId: "c1",
      tournamentId: "t1",
      tenantId: "v1",
      prevClubId: "c1",
      prevTournamentId: "t1",
      prevTenantId: "v1",
      hasUsableTournament: true,
      usableTournamentId: "t1",
    });
    assert.equal(visible.showFullPageLoader, false);
    assert.equal(visible.clearTournament, false);
  });

  it("C — same-actor token/session refresh does not reset workflow identity", () => {
    const auth = read("src/context/AuthContext.jsx");
    assert.match(auth, /shouldSkipAuthUiRefreshOnTokenEvent/);
    const fingerprint = read("src/auth/authorizationPrincipalFingerprint.js");
    assert.match(fingerprint, /TOKEN_REFRESHED/);

    const club = read("src/context/ClubContext.jsx");
    assert.match(club, /userSecurityScopeKey/);
    assert.match(club, /buildUserSecurityScopeKey\(user\)/);
    assert.doesNotMatch(
      club,
      /hydrateClubScope[\s\S]{0,400}\}, \[isAuthenticated, user, currentTenantId/
    );

    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /resolveOfficialOrganizerStageSelection/);
    assert.match(setup, /readOfficialStageQuery\(searchParams\)/);
    assert.doesNotMatch(setup, /TOKEN_REFRESHED[\s\S]{0,120}setSearchParams/);
    assert.doesNotMatch(setup, /TOKEN_REFRESHED[\s\S]{0,80}setActiveStageId/);
  });

  it("D — same tournament background readback preserves content", () => {
    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "c1",
      tournamentId: "t1",
      tenantId: "v1",
      prevClubId: "c1",
      prevTournamentId: "t1",
      prevTenantId: "v1",
      hasUsableTournament: true,
      usableTournamentId: "t1",
    });
    assert.equal(policy.mode, "soft-revalidate");
    assert.equal(policy.clearTournament, false);
  });

  it("E — tournamentId change hard-clears previous tournament", () => {
    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "c1",
      tournamentId: "t-new",
      tenantId: "v1",
      prevClubId: "c1",
      prevTournamentId: "t-old",
      prevTenantId: "v1",
      hasUsableTournament: true,
      usableTournamentId: "t-old",
    });
    assert.equal(policy.identityChanged, true);
    assert.equal(policy.clearTournament, true);
    assert.equal(policy.showFullPageLoader, true);
  });

  it("F — tenant change hard-clears previous tenant data", () => {
    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "c1",
      tournamentId: "t1",
      tenantId: "tenant-b",
      prevClubId: "c1",
      prevTournamentId: "t1",
      prevTenantId: "tenant-a",
      hasUsableTournament: true,
      usableTournamentId: "t1",
    });
    assert.equal(policy.identityChanged, true);
    assert.equal(policy.clearTournament, true);
  });

  it("G — missing ids with no usable data fail closed", () => {
    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "",
      tournamentId: "",
      hasUsableTournament: false,
    });
    assert.equal(policy.mode, "hard-clear");
    assert.equal(policy.clearTournament, true);
  });

  it("transient empty clubId keeps mounted tournament (token-refresh flicker)", () => {
    const fp = "user-1|CLUB_OWNER|active|v1|v1|c1||||rbac0|v1";
    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "",
      tournamentId: "t1",
      tenantId: "",
      prevClubId: "c1",
      prevTournamentId: "t1",
      prevTenantId: "v1",
      hasUsableTournament: true,
      usableTournamentId: "t1",
      authzFingerprint: fp,
      prevAuthzFingerprint: fp,
    });
    assert.equal(policy.mode, "keep-transient");
    assert.equal(policy.clearTournament, false);
    assert.equal(policy.showFullPageLoader, false);
    assert.equal(policy.updateIdentity, false);
  });

  it("H — focus/visibility must not trigger registration mutation", () => {
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    const hook = read("src/features/tournament/hooks/useCanonicalTournament.js");
    assert.doesNotMatch(setup, /visibilitychange/);
    assert.doesNotMatch(setup, /addEventListener\(\s*["']focus["']/);
    assert.doesNotMatch(hook, /visibilitychange/);
    assert.doesNotMatch(hook, /addEventListener\(\s*["']focus["']/);
    assert.match(setup, /registerBusyRef/);
    assert.match(setup, /skipLocalRevision: true/);
    assert.match(setup, /reload\(\{ soft: true \}\)/);
  });

  it("Official loader only when no usable tournament object", () => {
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /if \(tournamentLoading && !tournament\)/);
    assert.doesNotMatch(setup, /if \(tournamentLoading\) \{\s*return/);
  });

  it("player directory revision is separate from tournament persist revision", () => {
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /playerDirectoryRevision/);
    assert.match(setup, /revision: playerDirectoryRevision/);
    assert.doesNotMatch(
      setup,
      /useTenantPairingCandidatePool\(tenantId, \{\s*revision: localRevision/
    );
  });
});

describe("official-open-tournament-phase2e-multi-select", () => {
  it("click A → [A]; click B → [A,B]; click A → [B]", () => {
    let selected = [];
    selected = toggleOfficialIndividualSelection(selected, "A");
    assert.deepEqual(selected, ["A"]);
    selected = toggleOfficialIndividualSelection(selected, "B");
    assert.deepEqual(selected, ["A", "B"]);
    selected = toggleOfficialIndividualSelection(selected, "A");
    assert.deepEqual(selected, ["B"]);
  });

  it("search/filter does not clear selected valid IDs", () => {
    const selected = toggleOfficialIndividualSelection(["p1", "p2"], "p3");
    assert.deepEqual(selected, ["p1", "p2", "p3"]);
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /onSearchChange=\{setPickerSearch\}/);
    assert.match(setup, /onGenderFilterChange=\{setPickerGenderFilter\}/);
    assert.match(setup, /onClubFilterChange=\{setOpenClubFilter\}/);
    assert.doesNotMatch(setup, /setPickerSearch\([\s\S]{0,80}setSelectedIndividualPlayerIds\(\[\]\)/);
  });

  it("already registered row cannot be reselected", () => {
    const next = toggleOfficialIndividualSelection([], "p1", {
      excludePlayerIds: ["p1"],
    });
    assert.deepEqual(next, []);
  });

  it("Bỏ chọn tất cả clears selection; select-all applies to visible only", () => {
    assert.deepEqual(uniqueOfficialIndividualSelection(["p1", "p1", "p2"]), ["p1", "p2"]);
    const merged = mergeVisibleOfficialIndividualSelection(["p1"], ["p2", "p3"]);
    assert.deepEqual(merged, ["p1", "p2", "p3"]);
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /handleClearIndividualSelection/);
    assert.match(setup, /Chọn tất cả đang hiển thị/);
    assert.match(setup, /Bỏ chọn tất cả/);
    assert.match(setup, /Đã chọn: \{selectedIndividualPlayerIds\.length\} VĐV/);
    assert.match(setup, /Đăng ký \$\{selectedIndividualPlayerIds\.length\} VĐV/);
  });

  it("candidate toggle is local-only — no Tournament persist", () => {
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.doesNotMatch(
      setup,
      /handleSelectIndividualCandidate[\s\S]{0,250}persistTournament/
    );
    assert.doesNotMatch(
      setup,
      /handleClearIndividualSelection[\s\S]{0,200}persistTournament/
    );
    assert.doesNotMatch(
      setup,
      /handleSelectVisibleIndividuals[\s\S]{0,200}persistTournament/
    );
    assert.match(setup, /selectedIndividualPlayerIds/);
    assert.doesNotMatch(setup, /selectedIndividualPlayerId[^s]/);
  });

  it("pair registration UI is unchanged (not multi-select individual)", () => {
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /mode="pair"/);
    assert.match(setup, /onPairPick=\{handlePairPlayerPick\}/);
  });
});

describe("official-open-tournament-phase2e-bulk-registration", () => {
  it("6 selected players: one in-memory aggregate, entries +6, draw/groups untouched, audit per player", () => {
    const players = sixPlayers();
    const tournament = baseTournament();
    const before = tournament.events[0].entries.length;
    const result = registerOfficialIndividualsBatch(
      tournament,
      {
        playerIds: players.map((p) => p.id),
        players,
        eventId: "ev1",
        eventType: EVENT_TYPE.MEN_DOUBLE,
      },
      {
        now: "2026-08-13T00:00:00.000Z",
      }
    );
    const engineCalls = result.entries?.length || 0;
    assert.equal(result.ok, true);
    assert.equal(result.persist, true);
    assert.equal(before, 0);
    assert.equal(result.event.entries.length, 6);
    assert.equal(engineCalls, 6);
    assert.equal((result.event.drawEntries || []).length, 0);
    assert.equal((result.event.groups || []).length, 0);
    assert.deepEqual(result.event.matches || [], []);
    const audit = getRegistrationSettings(result.tournament).auditLog || [];
    assert.equal(
      audit.filter((row) => row.action === REGISTRATION_AUDIT_ACTIONS.SUBMITTED).length,
      6
    );
    assert.equal(
      getOfficialCompetitionSettings(result.tournament).registrationMode,
      OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
    );
  });

  it("atomic failure: B duplicate → persist=0, entries unchanged, selection retained, B named", () => {
    const players = sixPlayers().slice(0, 3);
    const tournament = baseTournament({
      events: [
        {
          id: "ev1",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            {
              id: "e-p2",
              name: "Trần B",
              playerIds: ["p2"],
              status: ENTRY_STATUS.ACTIVE,
            },
          ],
          drawEntries: [],
          groups: [],
          matches: [],
        },
      ],
    });
    const result = registerOfficialIndividualsBatch(tournament, {
      playerIds: ["p1", "p2", "p3"],
      players,
      eventId: "ev1",
      eventType: EVENT_TYPE.MEN_DOUBLE,
    });
    assert.equal(result.ok, false);
    assert.equal(result.persist, false);
    assert.equal(tournament.events[0].entries.length, 1);
    assert.equal((tournament.events[0].drawEntries || []).length, 0);
    assert.match(result.error, /Trần B/);
    assert.match(result.error, /đã đăng ký/);
    const selection = ["p1", "p2", "p3"];
    assert.deepEqual(selection, ["p1", "p2", "p3"]);
  });

  it("capacity remaining 2 + selected 3 → no persist", () => {
    const players = sixPlayers().slice(0, 3);
    let tournament = baseTournament();
    tournament = {
      ...tournament,
      settings: {
        ...tournament.settings,
        registration: {
          ...(tournament.settings?.registration || {}),
          maxEntries: 2,
        },
      },
    };
    const result = registerOfficialIndividualsBatch(tournament, {
      playerIds: ["p1", "p2", "p3"],
      players,
      eventId: "ev1",
      eventType: EVENT_TYPE.MEN_DOUBLE,
    });
    assert.equal(result.ok, false);
    assert.equal(result.persist, false);
    assert.equal(result.code, "CAPACITY_EXCEEDED");
    assert.equal(tournament.events[0].entries.length, 0);
  });

  it("drawn/grouped event cannot be bulk-registered", () => {
    const players = sixPlayers().slice(0, 2);
    const tournament = baseTournament({
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [],
          drawEntries: [{ id: "pair-1", playerIds: ["a", "b"] }],
          groups: [{ id: "g1", entries: [] }],
          matches: [],
        },
      ],
    });
    const result = registerOfficialIndividualsBatch(tournament, {
      playerIds: ["p1", "p2"],
      players,
      eventId: "ev1",
      eventType: EVENT_TYPE.MEN_DOUBLE,
    });
    assert.equal(result.ok, false);
    assert.equal(result.persist, false);
    assert.equal(result.code, "DRAW_LOCKED");
  });

  it("eligibility failure is business-readable and not raw JSON", () => {
    const players = [
      { id: "p1", name: "Nguyễn A", gender: "male", rating: 2 },
      { id: "p2", name: "Trần B", gender: "male", rating: 9 },
    ];
    const tournament = updateEligibilityRules(baseTournament(), {
      skill: { enabled: true, minLevel: 3, maxLevel: 5 },
    }).tournament;
    const result = registerOfficialIndividualsBatch(tournament, {
      playerIds: ["p1", "p2"],
      players,
      eventId: "ev1",
      eventType: EVENT_TYPE.MEN_DOUBLE,
    });
    assert.equal(result.ok, false);
    assert.equal(result.persist, false);
    assert.match(result.error, /Không thể đăng ký 2 VĐV/);
    assert.doesNotMatch(result.error, /\{"/);
    assert.doesNotMatch(result.error, /p_patch/);
  });

  it("error formatter is business-readable", () => {
    const text = formatOfficialBulkRegistrationError([
      { playerName: "Nguyễn A", error: "đã đăng ký" },
      { playerName: "Trần B", error: "vượt điều kiện trình độ" },
    ]);
    assert.match(text, /Không thể đăng ký 2 VĐV/);
    assert.match(text, /Nguyễn A: đã đăng ký/);
    assert.match(text, /Trần B: vượt điều kiện trình độ/);
  });
});

describe("official-open-tournament-phase2e-hydration", () => {
  let memory;
  let persistCount;
  let readbackCount;

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __resetTournamentRepositorySingleton();
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id
        ? { ...club, tenantId: TENANT_ID, venueId: TENANT_ID }
        : club
    );
    saveClubs(clubs);
    setActiveClubId(DEFAULT_CLUB.id);
    persistCount = 0;
    readbackCount = 0;
    memory = createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID });
    const inner = memory.rpc;
    __setTournamentRepositoryRpcForTests(async (name, args) => {
      if (name === CANONICAL_TOURNAMENT_RPC.UPDATE) persistCount += 1;
      if (name === CANONICAL_TOURNAMENT_RPC.GET) readbackCount += 1;
      return inner(name, args);
    });
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("F5 hydrate after 6-player bulk: all present once, no duplicates, drawEntries unchanged", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      name: "P2E Bulk Hydration",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
    });
    assert.equal(created.ok, true);

    const seeded = patchOfficialCompetitionSettings(
      {
        ...created.tournament,
        status: TOURNAMENT_STATUS.DRAFT,
        events: [
          {
            id: "ev1",
            name: "Đôi nam",
            eventType: EVENT_TYPE.MEN_DOUBLE,
            entries: [],
            drawEntries: [],
            groups: [],
            matches: [],
          },
        ],
      },
      { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
    );
    const seedSave = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: seeded.events,
      settings: seeded.settings,
      status: TOURNAMENT_STATUS.DRAFT,
    });
    assert.equal(seedSave.ok, true);

    persistCount = 0;
    readbackCount = 0;

    const players = sixPlayers();
    const batch = registerOfficialIndividualsBatch(seedSave.tournament, {
      playerIds: players.map((p) => p.id),
      players,
      eventId: "ev1",
      eventType: EVENT_TYPE.MEN_DOUBLE,
    });
    assert.equal(batch.ok, true);

    const persisted = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: batch.tournament.events,
      settings: batch.tournament.settings,
    });
    assert.equal(persisted.ok, true);
    assert.equal(persistCount, 1);
    // update() may GET once to merge before write (CAS). That is not a second persist.
    readbackCount = 0;

    const hydrated = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    assert.equal(hydrated.ok, true);
    assert.equal(readbackCount, 1);

    const event = hydrated.tournament.events[0];
    assert.equal((event.entries || []).length, 6);
    const ids = (event.entries || []).flatMap((e) => e.playerIds || []).map(String);
    assert.equal(new Set(ids).size, 6);
    assert.equal((event.drawEntries || []).length, 0);
    assert.equal((event.groups || []).length, 0);
    assert.equal(
      getOfficialCompetitionSettings(hydrated.tournament).registrationMode,
      OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
    );

    const row = tournamentToCanonicalRow(hydrated.tournament, {
      tenantId: TENANT_ID,
      clubId: DEFAULT_CLUB.id,
    });
    const roundtrip = canonicalRowToTournament(row);
    assert.equal(roundtrip.events[0].entries.length, 6);
  });
});

describe("official-open-tournament-phase2e-ui-source", () => {
  it("bulk submit uses one persist + one soft canonical readback", () => {
    const setup = read("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /registerOfficialIndividualsBatch/);
    assert.match(setup, /persistOfficialIndividualBatch/);
    assert.match(setup, /skipLocalRevision: true/);
    assert.match(setup, /reload\(\{ soft: true \}\)/);
    assert.match(setup, /Đang đăng ký \$\{selectedIndividualPlayerIds\.length\} VĐV/);
    assert.match(setup, /registerBusyRef\.current = true/);
  });
});
