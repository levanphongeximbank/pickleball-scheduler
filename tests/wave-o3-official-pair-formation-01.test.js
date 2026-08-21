import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  ENTRY_STATUS,
} from "../src/models/tournament/constants.js";
import {
  resolveTournamentExperienceAdapter,
} from "../src/features/tournament/experience-a1/experienceModeResolver.js";
import { deriveFormationModel } from "../src/features/tournament/experience-a1/batchB/deriveFormation.js";
import {
  PAIR_FORMATION_MODE,
  resolveOfficialPairFormationMode,
  buildOfficialFormPairsPatch,
  OFFICIAL_EXPERIENCE_AUTHORITY,
  resolveOfficialCanonicalOpenPath,
  officialLegacySetupPath,
} from "../src/features/tournament/official-tournament-experience/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { OFFICIAL_PAIRING_AUTHORITY } from "../src/features/individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  suggestOpenRandomEntriesFromPlayers,
  suggestBalancedEntriesFromIndividuals,
} from "../src/tournament/engines/teamPairingEngine.js";
import {
  ratingMayInfluenceOpenPairingOrDraw,
} from "../src/features/tournament/official-open-adapter-b/activation.js";
import { formOfficialIndividualPairs } from "../src/features/individual-tournament/engines/officialDrawOrchestrationEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makePlayers(ids) {
  return ids.map((id, index) => ({
    id,
    name: `Player ${id}`,
    gender: "male",
    level: 3 + (index % 3) * 0.5,
    rating: 1000 + index * 50,
  }));
}

function officialBase(overrides = {}) {
  return {
    id: "off-o3",
    name: "Official O3",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.READY,
    tenantId: "tenant-a",
    clubId: "club-a",
    events: [
      {
        id: "ev-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          { id: "e1", name: "P1", status: ENTRY_STATUS.APPROVED, playerIds: ["p1"] },
          { id: "e2", name: "P2", status: ENTRY_STATUS.APPROVED, playerIds: ["p2"] },
          { id: "e3", name: "P3", status: ENTRY_STATUS.APPROVED, playerIds: ["p3"] },
          { id: "e4", name: "P4", status: ENTRY_STATUS.APPROVED, playerIds: ["p4"] },
        ],
        drawEntries: [],
        groups: [],
        matches: [],
      },
      {
        id: "ev-b",
        name: "Đôi nữ",
        eventType: EVENT_TYPE.WOMEN_DOUBLE,
        entries: [],
        drawEntries: [],
        groups: [],
        matches: [],
      },
    ],
    settings: {
      officialCompetition: {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
        matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
        groupCount: 2,
      },
    },
    ...overrides,
  };
}

describe("wave-o3-official-pair-formation-01", () => {
  it("1-4 Screen 06 route + event scoping", () => {
    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualPairFormationPage.jsx"),
      "utf8"
    );
    assert.ok(page.includes('TEST_ID = "tournament-pairs-page"'));
    assert.ok(page.includes("formPairs"));
    assert.ok(page.includes("official-form-pairs-action"));
    assert.equal(page.includes("events[0]"), false);

    const multi = officialBase();
    const needs = deriveFormationModel(multi, { selectedEventId: "" });
    assert.equal(needs.needsEventChoice, true);
    assert.equal(needs.formPairsEnabled, false);

    const scoped = deriveFormationModel(multi, { selectedEventId: "ev-a" });
    assert.equal(scoped.eventId, "ev-a");
    assert.equal(scoped.official, true);
  });

  it("5-15 OPEN INDIVIDUAL random pairing", () => {
    const tournament = officialBase({ officialMode: OFFICIAL_MODE.OPEN });
    const resolved = resolveOfficialPairFormationMode(tournament);
    assert.equal(resolved.mode, PAIR_FORMATION_MODE.RANDOM_PAIRING);
    assert.equal(resolved.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM);
    assert.equal(resolved.usesRating, false);
    assert.equal(ratingMayInfluenceOpenPairingOrDraw(), false);

    const model = deriveFormationModel(tournament, { selectedEventId: "ev-a" });
    assert.equal(model.pairFormationMode, PAIR_FORMATION_MODE.RANDOM_PAIRING);
    assert.equal(model.formPairsEnabled, true);
    assert.equal(model.formed.length, 0);
    assert.ok(model.unpaired.length >= 4);

    // No mutation merely by deriving / reading
    assert.deepEqual(tournament.events[0].drawEntries, []);

    const players = makePlayers(["p1", "p2", "p3", "p4"]);
    const built = buildOfficialFormPairsPatch(tournament, {
      selectedEventId: "ev-a",
      players,
    });
    assert.equal(built.ok, true);
    assert.equal(built.mode, PAIR_FORMATION_MODE.RANDOM_PAIRING);
    assert.equal(built.usesRating, false);
    assert.equal(built.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM);
    assert.equal(built.authority, OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING);
    const event = built.patch.events.find((item) => item.id === "ev-a");
    assert.ok(Array.isArray(event.drawEntries) && event.drawEntries.length >= 2);
    assert.equal(event.entries.length, 4);
    event.drawEntries.forEach((pair) => {
      assert.ok(Array.isArray(pair.playerIds) && pair.playerIds.length === 2);
      assert.equal(pair.origin, "official_draw_materialization");
    });

    // Rehydrate read model from persisted drawEntries
    const after = {
      ...tournament,
      events: built.patch.events,
    };
    const rehydrated = deriveFormationModel(after, { selectedEventId: "ev-a" });
    assert.equal(rehydrated.formed.length, event.drawEntries.length);
    assert.deepEqual(
      rehydrated.formed.map((pair) => [...pair.playerIds].sort().join("+")).sort(),
      event.drawEntries.map((pair) => [...pair.playerIds].sort().join("+")).sort()
    );

    // AI Balance writer must not be used for Open
    const openFn = suggestOpenRandomEntriesFromPlayers;
    const aiFn = suggestBalancedEntriesFromIndividuals;
    assert.notEqual(openFn, aiFn);

    // Direct engine path uses open mode
    const direct = formOfficialIndividualPairs({
      tournament,
      eventId: "ev-a",
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: suggestOpenRandomEntriesFromPlayers,
    });
    assert.equal(direct.ok, true);
  });

  it("16-20 OPEN PAIR preserves registered pairs", () => {
    const tournament = officialBase({
      officialMode: OFFICIAL_MODE.OPEN,
      events: [
        {
          id: "ev-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            {
              id: "pair-1",
              name: "A / B",
              status: ENTRY_STATUS.ACTIVE,
              playerIds: ["p1", "p2"],
            },
            {
              id: "pair-2",
              name: "C / D",
              status: ENTRY_STATUS.ACTIVE,
              playerIds: ["p3", "p4"],
            },
          ],
          drawEntries: [],
          groups: [],
          matches: [],
        },
      ],
      settings: {
        officialCompetition: {
          registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
          scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
          matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
          groupCount: 2,
        },
      },
    });
    const resolved = resolveOfficialPairFormationMode(tournament);
    assert.equal(resolved.mode, PAIR_FORMATION_MODE.REGISTERED_PAIRS);
    assert.equal(resolved.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.NONE);

    const model = deriveFormationModel(tournament, { selectedEventId: "ev-a" });
    assert.equal(model.formPairsEnabled, false);
    assert.equal(model.formed.length, 2);
    assert.deepEqual(model.formed[0].playerIds, ["p1", "p2"]);

    const blocked = buildOfficialFormPairsPatch(tournament, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4"]),
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "OPEN_PAIR_NO_REPAIR");
  });

  it("21-25 AI Balance delegates existing engine", () => {
    const tournament = officialBase({ officialMode: OFFICIAL_MODE.AI_BALANCE });
    const resolved = resolveOfficialPairFormationMode(tournament);
    assert.equal(resolved.mode, PAIR_FORMATION_MODE.AI_BALANCE_PAIRING);
    assert.equal(resolved.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE);
    assert.equal(resolved.usesRating, true);

    const model = deriveFormationModel(tournament, { selectedEventId: "ev-a" });
    assert.equal(model.formPairsEnabled, true);
    assert.equal(model.formed.length, 0);

    const built = buildOfficialFormPairsPatch(tournament, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4"]),
    });
    assert.equal(built.ok, true);
    assert.equal(built.mode, PAIR_FORMATION_MODE.AI_BALANCE_PAIRING);
    assert.equal(built.usesRating, true);
    assert.ok(built.patch.events.find((event) => event.id === "ev-a").drawEntries.length >= 2);

    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualPairFormationPage.jsx"),
      "utf8"
    );
    assert.equal(page.includes("createTeamsFromPlayers"), false);
    assert.ok(page.includes("formPairs"));
  });

  it("26-30 downstream safety + no draw/schedule/match mutation", () => {
    const withGroups = officialBase({
      events: [
        {
          ...officialBase().events[0],
          groups: [{ id: "g1", name: "Bảng A" }],
        },
      ],
    });
    const blocked = buildOfficialFormPairsPatch(withGroups, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4"]),
    });
    assert.equal(blocked.ok, false);
    assert.ok(
      blocked.code === "GROUPS_BLOCK_REPAIR" ||
        String(blocked.error || "").includes("bảng")
    );

    const ok = buildOfficialFormPairsPatch(officialBase(), {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4"]),
    });
    assert.equal(ok.ok, true);
    const event = ok.patch.events.find((item) => item.id === "ev-a");
    assert.deepEqual(event.groups, []);
    assert.deepEqual(event.matches, []);
    assert.equal(Object.keys(ok.patch).join(","), "events");
  });

  it("31-52 identity / authority / regression locks", () => {
    assert.equal(resolveOfficialCanonicalOpenPath({ id: "off-o3" }), "/tournament/off-o3/overview");
    assert.ok(officialLegacySetupPath("off-o3").includes("experience=legacy"));

    const adapter = resolveTournamentExperienceAdapter(officialBase(), {
      selectedEventId: "ev-a",
    });
    assert.equal(adapter.wave, "O5");
    assert.equal(typeof adapter.commands.formPairs, "function");
    assert.equal(typeof adapter.commands.runGroupDraw, "function");
    assert.equal(adapter.commands.assignReferee, null);
    assert.equal(adapter.commands.scoreMatch, null);
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.COURT, "canonical-court-authority");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING, "official-open-pairing-engines");

    const missingEvent = buildOfficialFormPairsPatch(officialBase(), {
      selectedEventId: "",
      players: makePlayers(["p1", "p2", "p3", "p4"]),
    });
    assert.equal(missingEvent.ok, false);
    assert.equal(missingEvent.code, "EVENT_REQUIRED");

    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualPairFormationPage.jsx"),
      "utf8"
    );
    assert.ok(page.includes("TournamentExperienceWorkspace"));
    assert.equal(page.includes("OfficialTournamentTheme"), false);
    assert.equal(page.includes("OfficialTournamentExperienceShell"), false);
    assert.equal(page.includes("loadPlayersForClub"), true);
    assert.ok(page.includes("Không ghép trên page load"));

    const internal = deriveFormationModel(
      {
        id: "i1",
        mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
        name: "Internal",
        events: [{ id: "only", name: "Đôi", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [] }],
      },
      { selectedEventId: "only" }
    );
    assert.equal(internal.official, false);
    assert.equal(internal.formPairsEnabled, false);
  });
});
