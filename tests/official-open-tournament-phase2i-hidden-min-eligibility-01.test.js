/**
 * Phase 2I — hidden min=0 eligibility sentinel + missing skill/rating policy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  normalizeTournament,
} from "../src/models/tournament/index.js";
import {
  ELIGIBILITY_VIOLATION,
  getEligibilityRules,
  updateEligibilityRules,
  patchOfficialVisibleEligibilityLimits,
  checkPlayerEligibility,
  OFFICIAL_REGISTRATION_MODE,
  resolveOfficialPairingDispatch,
  resolveOfficialGroupDrawDispatch,
  OFFICIAL_PAIRING_AUTHORITY,
  OFFICIAL_GROUP_DRAW_AUTHORITY,
} from "../src/features/individual-tournament/index.js";
import { registerOfficialIndividualsBatch } from "../src/features/individual-tournament/engines/officialRegistrationBatchEngine.js";
import { suggestOpenRandomEntriesFromPlayers } from "../src/tournament/engines/index.js";

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

function emptyEvent(id = "ev1") {
  return {
    id,
    name: "Đôi nam",
    eventType: EVENT_TYPE.MEN_DOUBLE,
    entries: [],
    drawEntries: [],
    groups: [],
    matches: [],
    standings: [],
    bracket: null,
  };
}

function baseTournament(eligibilityRules = {}) {
  return {
    id: "a3aa9414-a800-44f3-b20f-f7aa042c5ca1",
    name: "Official P2I",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    settings: {
      officialCompetition: {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      },
      eligibilityRules,
    },
    events: [emptyEvent()],
  };
}

const LEGACY_ALL_ZERO = {
  skill: { enabled: true, minLevel: 0, maxLevel: 0 },
  rating: { enabled: true, minRating: 0, maxRating: 0 },
};

const PLAYER_A = { id: "a", name: "A", gender: "male", level: 3.8, rating: 3.8 };
const PLAYER_B = { id: "b", name: "B", gender: "male", level: 3.5 };
const PLAYER_C = { id: "c", name: "C", gender: "male", rating: 4.0 };
const PLAYER_D = { id: "d", name: "D", gender: "male" };

describe("official-open-tournament-phase2i-hidden-min-eligibility-01", () => {
  it("legacy min/max 0 normalizes to unset; missing skill/rating pass", () => {
    const rules = getEligibilityRules(baseTournament(LEGACY_ALL_ZERO));
    assert.equal(rules.skill.minLevel, null);
    assert.equal(rules.skill.maxLevel, null);
    assert.equal(rules.rating.minRating, null);
    assert.equal(rules.rating.maxRating, null);
    assert.equal(rules.skill.enabled, false);
    assert.equal(rules.rating.enabled, false);

    for (const player of [PLAYER_A, PLAYER_B, PLAYER_C, PLAYER_D]) {
      const result = checkPlayerEligibility(player, rules);
      assert.equal(result.ok, true, `${player.id}: ${JSON.stringify(result.violations)}`);
      assert.equal(
        result.violations.some((item) => item.message?.includes("Thiếu trình độ")),
        false
      );
      assert.equal(
        result.violations.some((item) => item.message?.includes("Thiếu rating")),
        false
      );
    }
  });

  it("hidden min=0 after max ceilings cleared still has no effective constraint", () => {
    const rules = getEligibilityRules(
      baseTournament({
        skill: { enabled: true, minLevel: 0, maxLevel: null },
        rating: { enabled: true, minRating: 0, maxRating: null },
      })
    );
    assert.equal(rules.skill.minLevel, null);
    assert.equal(rules.rating.minRating, null);
    assert.equal(checkPlayerEligibility(PLAYER_B, rules).ok, true);
    assert.equal(checkPlayerEligibility(PLAYER_C, rules).ok, true);
    assert.equal(checkPlayerEligibility(PLAYER_D, rules).ok, true);
  });

  it("maxSkill=3.5 rejects 3.8 and fail-closes missing skill", () => {
    const rules = getEligibilityRules(
      patchOfficialVisibleEligibilityLimits(baseTournament(LEGACY_ALL_ZERO), {
        maxLevel: 3.5,
        maxRating: null,
      }).tournament
    );
    assert.equal(rules.skill.maxLevel, 3.5);
    assert.equal(rules.skill.minLevel, null);

    const high = checkPlayerEligibility({ ...PLAYER_A, level: 3.8 }, rules);
    assert.equal(high.ok, false);
    assert.equal(high.violations[0].code, ELIGIBILITY_VIOLATION.SKILL_TOO_HIGH);

    const missing = checkPlayerEligibility(PLAYER_D, rules);
    assert.equal(missing.ok, false);
    assert.equal(missing.violations[0].code, ELIGIBILITY_VIOLATION.SKILL_UNKNOWN);
    assert.equal(missing.violations[0].message, "Thiếu trình độ để kiểm tra điều kiện trình độ.");
  });

  it("maxRating=8 fail-closes missing rating; rating 7 passes rating dimension", () => {
    const rules = getEligibilityRules(
      patchOfficialVisibleEligibilityLimits(baseTournament(LEGACY_ALL_ZERO), {
        maxLevel: null,
        maxRating: 8,
      }).tournament
    );
    assert.equal(rules.rating.maxRating, 8);
    assert.equal(rules.rating.minRating, null);

    const missing = checkPlayerEligibility(PLAYER_B, rules);
    assert.equal(missing.ok, false);
    assert.equal(missing.violations[0].code, ELIGIBILITY_VIOLATION.RATING_UNKNOWN);
    assert.equal(missing.violations[0].message, "Thiếu rating để kiểm tra điều kiện rating.");

    const okRating = checkPlayerEligibility(
      { id: "r7", name: "R7", gender: "male", level: 3.5, displayRating: 7 },
      rules
    );
    assert.equal(okRating.ok, true);
  });

  it("Official clear-save roundtrip removes hidden mins; F5 stays unset", () => {
    const saved = patchOfficialVisibleEligibilityLimits(baseTournament(LEGACY_ALL_ZERO), {
      maxLevel: null,
      maxRating: null,
    }).tournament;
    const rules = getEligibilityRules(saved);
    assert.equal(rules.skill.minLevel, null);
    assert.equal(rules.skill.maxLevel, null);
    assert.equal(rules.rating.minRating, null);
    assert.equal(rules.rating.maxRating, null);
    assert.equal(rules.skill.enabled, false);
    assert.equal(rules.rating.enabled, false);

    const hydrated = getEligibilityRules(normalizeTournament(JSON.parse(JSON.stringify(saved))));
    assert.equal(hydrated.skill.minLevel, null);
    assert.equal(hydrated.rating.minRating, null);
    assert.equal(hydrated.skill.maxLevel, null);
    assert.equal(hydrated.rating.maxRating, null);
  });

  it("bulk registration: mixed missing values pass when no admission bound", () => {
    const tournament = patchOfficialVisibleEligibilityLimits(baseTournament(LEGACY_ALL_ZERO), {
      maxLevel: null,
      maxRating: null,
    }).tournament;
    const players = [PLAYER_A, PLAYER_B, PLAYER_C, PLAYER_D];
    const batch = registerOfficialIndividualsBatch(
      tournament,
      {
        eventId: "ev1",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        playerIds: players.map((player) => player.id),
        players,
      },
      { clubId: "club-1" }
    );
    assert.equal(batch.ok, true, batch.error);
    assert.equal(batch.persist !== false, true);
  });

  it("bulk still fail-closed when a real maxRating is configured", () => {
    const tournament = patchOfficialVisibleEligibilityLimits(baseTournament(LEGACY_ALL_ZERO), {
      maxLevel: null,
      maxRating: 8,
    }).tournament;
    const batch = registerOfficialIndividualsBatch(
      tournament,
      {
        eventId: "ev1",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        playerIds: ["a", "b"],
        players: [PLAYER_A, PLAYER_B],
      },
      { clubId: "club-1" }
    );
    assert.equal(batch.ok, false);
    assert.match(batch.error || "", /Thiếu rating để kiểm tra điều kiện rating/);
  });

  it("real minLevel 2.5 remains a legitimate bound", () => {
    const rules = getEligibilityRules(
      updateEligibilityRules(baseTournament(), {
        skill: { enabled: true, minLevel: 2.5, maxLevel: 5 },
      }).tournament
    );
    assert.equal(rules.skill.minLevel, 2.5);
    const low = checkPlayerEligibility({ ...PLAYER_A, level: 2.0 }, rules);
    assert.equal(low.ok, false);
    assert.equal(low.violations[0].code, ELIGIBILITY_VIOLATION.SKILL_TOO_LOW);
  });

  it("Open pairing/group draw remain rating-neutral", () => {
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
      randomFn: makeRng(23),
    });
    const b = suggestOpenRandomEntriesFromPlayers(high, EVENT_TYPE.MEN_DOUBLE, {
      randomFn: makeRng(23),
    });
    assert.deepEqual(pairKeys(a), pairKeys(b));
  });

  it("Official Settings save no longer preserves hidden min fields", () => {
    const settings = src(
      "src/components/tournament/official/OfficialTournamentSettingsScreen.jsx"
    );
    assert.match(settings, /patchOfficialVisibleEligibilityLimits/);
    assert.doesNotMatch(settings, /minLevel: eligibility\.skill/);
    assert.doesNotMatch(settings, /minRating: eligibility\.rating/);
  });
});
