/**
 * Phase 2H — content delete + eligibility zero/unset semantics.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  ENTRY_STATUS,
  EVENT_TYPE,
  normalizeTournament,
} from "../src/models/tournament/index.js";
import {
  ELIGIBILITY_VIOLATION,
  getEligibilityRules,
  updateEligibilityRules,
  checkPlayerEligibility,
  parseOfficialDecimalLevelInput,
  OFFICIAL_REGISTRATION_MODE,
  resolveOfficialPairingDispatch,
  resolveOfficialGroupDrawDispatch,
  OFFICIAL_PAIRING_AUTHORITY,
  OFFICIAL_GROUP_DRAW_AUTHORITY,
} from "../src/features/individual-tournament/index.js";
import {
  assessOfficialEventDeleteAllowed,
  deleteOfficialEventIfEmpty,
  createOfficialEventRecord,
  suggestOpenRandomEntriesFromPlayers,
} from "../src/tournament/engines/index.js";
import { registerOfficialIndividualsBatch } from "../src/features/individual-tournament/engines/officialRegistrationBatchEngine.js";

function src(path) {
  return readFileSync(path, "utf8");
}

function makeRng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pairKeys(entries = []) {
  return (entries || [])
    .map((entry) =>
      [...(entry.playerIds || [])]
        .map(String)
        .sort()
        .join("|")
    )
    .sort();
}

function baseTournament(events, eligibilityRules = {}) {
  return {
    id: "t-p2h",
    name: "Official P2H",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    settings: {
      officialCompetition: {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      },
      eligibilityRules,
    },
    events,
  };
}

function emptyEvent(id, name) {
  return {
    id,
    name,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    entries: [],
    drawEntries: [],
    groups: [],
    matches: [],
    standings: [],
    bracket: null,
  };
}

describe("official-open-tournament-phase2h-eligibility-zero-unset-01", () => {
  it("A. blank maxSkill → canonical unset → player 3.8 passes", () => {
    const tournament = updateEligibilityRules(baseTournament([emptyEvent("ev1", "A")]), {
      skill: { enabled: false, maxLevel: null },
    }).tournament;
    const rules = getEligibilityRules(tournament);
    assert.equal(rules.skill.maxLevel, null);
    assert.equal(rules.skill.enabled, false);

    const player = { id: "p1", name: "A", gender: "male", level: 3.8, rating: 3.8 };
    const result = checkPlayerEligibility(player, rules);
    assert.equal(result.ok, true);
    assert.equal(
      result.violations.some((item) => item.message?.includes("tối đa 0")),
      false
    );
  });

  it("B. blank maxRating → unset; missing player rating does not fail", () => {
    const tournament = updateEligibilityRules(baseTournament([emptyEvent("ev1", "A")]), {
      rating: { enabled: false, maxRating: null },
    }).tournament;
    const rules = getEligibilityRules(tournament);
    assert.equal(rules.rating.maxRating, null);
    const player = { id: "p1", name: "A", gender: "male", level: 3.5 };
    const result = checkPlayerEligibility(player, rules);
    assert.equal(result.ok, true);
  });

  it("C. maxSkill=3.5 player=3.8 → fail", () => {
    const tournament = updateEligibilityRules(baseTournament([emptyEvent("ev1", "A")]), {
      skill: { enabled: true, maxLevel: 3.5 },
    }).tournament;
    const result = checkPlayerEligibility(
      { id: "p1", name: "A", gender: "male", level: 3.8 },
      getEligibilityRules(tournament)
    );
    assert.equal(result.ok, false);
    assert.equal(result.violations[0].code, ELIGIBILITY_VIOLATION.SKILL_TOO_HIGH);
    assert.match(result.violations[0].message, /3\.8/);
    assert.match(result.violations[0].message, /3\.5/);
  });

  it("D. maxRating=8 + missing player rating → fail closed", () => {
    const tournament = updateEligibilityRules(baseTournament([emptyEvent("ev1", "A")]), {
      rating: { enabled: true, maxRating: 8 },
    }).tournament;
    const result = checkPlayerEligibility(
      { id: "p1", name: "A", gender: "male", level: 3.5 },
      getEligibilityRules(tournament)
    );
    assert.equal(result.ok, false);
    assert.equal(result.violations[0].code, ELIGIBILITY_VIOLATION.RATING_UNKNOWN);
    assert.equal(result.violations[0].message, "Thiếu rating để kiểm tra điều kiện rating.");
  });

  it("E. decimal 4,5 → 4.5", () => {
    const parsed = parseOfficialDecimalLevelInput("4,5");
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value, 4.5);
    assert.equal(parsed.empty, false);
  });

  it("F. empty string must NOT normalize to 0", () => {
    const empty = parseOfficialDecimalLevelInput("");
    assert.equal(empty.ok, true);
    assert.equal(empty.value, null);
    assert.equal(empty.empty, true);

    const whitespace = parseOfficialDecimalLevelInput("   ");
    assert.equal(whitespace.value, null);

    const fromNull = updateEligibilityRules(baseTournament([emptyEvent("ev1", "A")]), {
      skill: { enabled: true, maxLevel: null },
      rating: { enabled: true, maxRating: "" },
    }).tournament;
    const rules = getEligibilityRules(fromNull);
    assert.equal(rules.skill.maxLevel, null);
    assert.equal(rules.rating.maxRating, null);
    assert.notEqual(rules.skill.maxLevel, 0);
    assert.notEqual(rules.rating.maxRating, 0);
  });

  it("G. F5 roundtrip preserves unset; legacy max=0 becomes unset", () => {
    const saved = updateEligibilityRules(baseTournament([emptyEvent("ev1", "A")]), {
      skill: { enabled: false, maxLevel: null },
      rating: { enabled: false, maxRating: null },
    }).tournament;
    const hydrated = normalizeTournament(JSON.parse(JSON.stringify(saved)));
    const rules = getEligibilityRules(hydrated);
    assert.equal(rules.skill.maxLevel, null);
    assert.equal(rules.rating.maxRating, null);

    const legacyZero = getEligibilityRules(
      baseTournament([emptyEvent("ev1", "A")], {
        skill: { enabled: true, maxLevel: 0 },
        rating: { enabled: true, maxRating: 0 },
      })
    );
    assert.equal(legacyZero.skill.maxLevel, null);
    assert.equal(legacyZero.rating.maxRating, null);
    assert.equal(legacyZero.skill.enabled, false);
    assert.equal(legacyZero.rating.enabled, false);

    const player = { id: "p1", name: "A", gender: "male", level: 3.6, rating: 3.6 };
    assert.equal(checkPlayerEligibility(player, legacyZero).ok, true);
  });

  it("H. Open pairing/group draw remain rating-neutral after eligibility fix", () => {
    const dispatch = resolveOfficialPairingDispatch({
      officialMode: OFFICIAL_MODE.OPEN,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(dispatch.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM);
    assert.equal(dispatch.usesRating, false);
    const groups = resolveOfficialGroupDrawDispatch({ officialMode: OFFICIAL_MODE.OPEN });
    assert.equal(groups.groupDrawAuthority, OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM);
    assert.equal(groups.usesRating, false);

    const low = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `P${index + 1}`,
      gender: "male",
      rating: 2,
      level: 2,
    }));
    const high = low.map((player, index) => ({
      ...player,
      rating: 5 - index * 0.1,
      level: 5 - index * 0.1,
    }));
    const a = suggestOpenRandomEntriesFromPlayers(low, EVENT_TYPE.MEN_DOUBLE, {
      randomFn: makeRng(19),
    });
    const b = suggestOpenRandomEntriesFromPlayers(high, EVENT_TYPE.MEN_DOUBLE, {
      randomFn: makeRng(19),
    });
    assert.deepEqual(pairKeys(a), pairKeys(b));
  });

  it("configured 4.5 / 5.0 roundtrip", () => {
    const saved = updateEligibilityRules(baseTournament([emptyEvent("ev1", "A")]), {
      skill: { enabled: true, maxLevel: 4.5 },
      rating: { enabled: true, maxRating: 5.0 },
    }).tournament;
    const rules = getEligibilityRules(normalizeTournament(JSON.parse(JSON.stringify(saved))));
    assert.equal(rules.skill.maxLevel, 4.5);
    assert.equal(rules.rating.maxRating, 5);
  });

  it("bulk registration no longer fails on unset coerced to 0", () => {
    const tournament = updateEligibilityRules(
      baseTournament([
        {
          ...emptyEvent("ev1", "Đôi nam"),
          entries: [],
        },
      ]),
      { skill: { enabled: true, maxLevel: 0 }, rating: { enabled: false, maxRating: null } }
    ).tournament;
    const players = [
      { id: "p1", name: "A", gender: "male", level: 3.2 },
      { id: "p2", name: "B", gender: "male", level: 3.8 },
    ];
    const batch = registerOfficialIndividualsBatch(
      tournament,
      {
        eventId: "ev1",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        playerIds: ["p1", "p2"],
        players,
      },
      { clubId: "club-1" }
    );
    assert.equal(batch.ok, true, batch.error);
    assert.equal(batch.persist !== false, true);
  });

  it("settings UI does not prefill 0; helper says unlimited", () => {
    const settings = src(
      "src/components/tournament/official/OfficialTournamentSettingsScreen.jsx"
    );
    assert.match(settings, /Để trống nếu không giới hạn/);
    assert.match(settings, /parseOfficialDecimalLevelInput/);
    const engine = src("src/features/individual-tournament/engines/eligibilityEngine.js");
    assert.match(engine, /Number\(null\)/);
    assert.match(engine, /toNullableMaxBound/);
  });
});

describe("official-open-tournament-phase2h-content-delete-01", () => {
  it("A. A/B/C empty → delete B → A/C remain", () => {
    const tournament = baseTournament([
      emptyEvent("evA", "A"),
      emptyEvent("evB", "B"),
      emptyEvent("evC", "C"),
    ]);
    const result = deleteOfficialEventIfEmpty(tournament, "evB");
    assert.equal(result.ok, true);
    assert.equal(result.mutationCount, 1);
    assert.deepEqual(
      result.events.map((event) => event.id),
      ["evA", "evC"]
    );
  });

  it("B. delete selected content: deterministic next selection", () => {
    const tournament = baseTournament([
      emptyEvent("evA", "A"),
      emptyEvent("evB", "B"),
      emptyEvent("evC", "C"),
    ]);
    const result = deleteOfficialEventIfEmpty(tournament, "evB");
    assert.equal(result.nextEventId, "evA");
    const first = deleteOfficialEventIfEmpty(tournament, "evA");
    assert.equal(first.nextEventId, "evB");
  });

  it("C. delete last empty event → events=[]", () => {
    const tournament = baseTournament([emptyEvent("evA", "A")]);
    const result = deleteOfficialEventIfEmpty(tournament, "evA");
    assert.equal(result.ok, true);
    assert.deepEqual(result.events, []);
    assert.equal(result.nextEventId, "");
  });

  it("D. content with registrations blocked; mutation=0", () => {
    const tournament = baseTournament([
      {
        ...emptyEvent("evA", "A"),
        entries: [{ id: "e1", playerIds: ["p1"], status: ENTRY_STATUS.ACTIVE }],
      },
    ]);
    const result = deleteOfficialEventIfEmpty(tournament, "evA");
    assert.equal(result.ok, false);
    assert.equal(result.mutationCount, 0);
    assert.equal(result.code, "EVENT_DELETE_BLOCKED_DOWNSTREAM");
    assert.equal(tournament.events.length, 1);
  });

  it("E. content with drawEntries blocked", () => {
    const tournament = baseTournament([
      {
        ...emptyEvent("evA", "A"),
        drawEntries: [{ id: "d1", playerIds: ["p1", "p2"] }],
      },
    ]);
    assert.equal(assessOfficialEventDeleteAllowed(tournament, "evA").allowed, false);
  });

  it("F. groups/matches/standings/bracket blocked", () => {
    const withGroups = baseTournament([{ ...emptyEvent("evA", "A"), groups: [{ id: "gA" }] }]);
    const withMatches = baseTournament([{ ...emptyEvent("evA", "A"), matches: [{ id: "m1" }] }]);
    const withStandings = baseTournament([
      { ...emptyEvent("evA", "A"), standings: [{ id: "s1" }] },
    ]);
    const withBracket = baseTournament([
      { ...emptyEvent("evA", "A"), bracket: { rounds: [{ name: "Final" }] } },
    ]);
    assert.equal(deleteOfficialEventIfEmpty(withGroups, "evA").ok, false);
    assert.equal(deleteOfficialEventIfEmpty(withMatches, "evA").ok, false);
    assert.equal(deleteOfficialEventIfEmpty(withStandings, "evA").ok, false);
    assert.equal(deleteOfficialEventIfEmpty(withBracket, "evA").ok, false);
  });

  it("G. F5: deleted content does not return after normalize", () => {
    const tournament = baseTournament([
      emptyEvent("evA", "A"),
      emptyEvent("evB", "B"),
    ]);
    const deleted = deleteOfficialEventIfEmpty(tournament, "evB");
    const hydrated = normalizeTournament(JSON.parse(JSON.stringify(deleted.tournament)));
    assert.deepEqual(
      (hydrated.events || []).map((event) => event.id),
      ["evA"]
    );
  });

  it("UI wires confirm dialog and does not auto-navigate", () => {
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /Xóa nội dung thi đấu\?/);
    assert.match(setup, /Xóa nội dung/);
    assert.match(setup, /Thêm nội dung/);
    assert.match(setup, /handleConfirmDeleteEvent/);
    assert.match(setup, /deleteOfficialEventIfEmpty/);
    assert.match(setup, /persistTournament\(\{ events: result\.events \}\)/);
    const confirm = setup.slice(
      setup.indexOf("const handleConfirmDeleteEvent"),
      setup.indexOf("const handleConfirmDeleteEvent") + 900
    );
    assert.doesNotMatch(confirm, /selectStage/);
    assert.doesNotMatch(confirm, /setSearchParams/);
  });

  it("createOfficialEventRecord stays empty-safe to delete", () => {
    const created = createOfficialEventRecord({ id: "t-p2h" }, { eventType: EVENT_TYPE.MEN_DOUBLE });
    const tournament = baseTournament([created]);
    assert.equal(assessOfficialEventDeleteAllowed(tournament, created.id).allowed, true);
  });
});
