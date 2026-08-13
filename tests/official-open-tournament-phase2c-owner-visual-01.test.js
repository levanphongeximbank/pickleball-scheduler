/**
 * Phase 2C — Owner visual blocker closure (front-of-flow + Side-out gate).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  ENTRY_STATUS,
  EVENT_TYPE,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  SIDEOUT_OPERATIONAL,
  SIDEOUT_SELECTION_FAIL_CLOSED,
  SIDEOUT_BACKEND_PACKAGE_REQUIRED,
  SIDEOUT_DEFAULT_FOR_NEW_TOURNAMENT,
  SIDEOUT_SHARED_EXTRACTION_RECONCILE_AFTER_PR418,
  INTENDED_NEW_TOURNAMENT_SCORING_METHOD,
  parseOfficialDecimalLevelInput,
  assessOfficialRegistrationModeChange,
  resolveNewOfficialTournamentScoringDefault,
  getOfficialCompetitionSettings,
  patchOfficialCompetitionSettings,
  resolveOfficialRegistrationMode,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  projectOfficialFinalizationBuckets,
  filterOfficialDrawEntries,
} from "../src/features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import { updateEligibilityRules } from "../src/features/individual-tournament/engines/eligibilityEngine.js";
import { approveEntry } from "../src/features/individual-tournament/engines/registrationEngine.js";
import { createOpenEntryFromPlayer } from "../src/tournament/engines/officialTournamentEngine.js";

function baseTournament(overrides = {}) {
  return {
    id: "t-phase2c",
    name: "Official Phase2C",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    settings: {
      officialCompetition: {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      },
    },
    events: [
      {
        id: "ev1",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [],
        groups: [],
        matches: [],
      },
    ],
    ...overrides,
  };
}

describe("official-open-tournament-phase2c-owner-visual-01", () => {
  it("decimal level accepts 4.5 and 4,4; rejects invalid; no parseInt path", () => {
    assert.equal(parseOfficialDecimalLevelInput("4.5").value, 4.5);
    assert.equal(parseOfficialDecimalLevelInput("4,4").value, 4.4);
    assert.equal(parseOfficialDecimalLevelInput(" 3,25 ").value, 3.25);
    assert.equal(parseOfficialDecimalLevelInput("").value, null);
    assert.equal(parseOfficialDecimalLevelInput("abc").ok, false);
    assert.equal(parseOfficialDecimalLevelInput("4,,5").ok, false);

    let t = baseTournament();
    const skill = parseOfficialDecimalLevelInput("4,4");
    const rating = parseOfficialDecimalLevelInput("4.5");
    const patched = updateEligibilityRules(t, {
      skill: { enabled: true, maxLevel: skill.value, minLevel: null },
      rating: { enabled: true, maxRating: rating.value, minRating: null },
    });
    assert.equal(patched.tournament.settings.eligibilityRules.skill.maxLevel, 4.4);
    assert.equal(patched.tournament.settings.eligibilityRules.rating.maxRating, 4.5);
    assert.equal(typeof patched.tournament.settings.eligibilityRules.skill.maxLevel, "number");
  });

  it("explicit registrationMode individual wins over doubles eventType", () => {
    const t = baseTournament({
      settings: {
        officialCompetition: {
          registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        },
      },
      events: [
        {
          id: "ev1",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [],
          groups: [],
          matches: [],
        },
      ],
    });
    const resolved = resolveOfficialRegistrationMode(t);
    assert.equal(resolved.registrationMode, OFFICIAL_REGISTRATION_MODE.INDIVIDUAL);
    assert.equal(resolved.registrationModeResolution, "explicit");
    const settings = getOfficialCompetitionSettings(t);
    assert.equal(settings.registrationMode, OFFICIAL_REGISTRATION_MODE.INDIVIDUAL);
    // Competition format doubles ≠ registration mode pair
    assert.equal(t.events[0].eventType, EVENT_TYPE.MEN_DOUBLE);
  });

  it("mode switch blocked when entry shapes conflict; allowed when empty", () => {
    const empty = baseTournament();
    assert.equal(
      assessOfficialRegistrationModeChange(empty, OFFICIAL_REGISTRATION_MODE.PAIR).allowed,
      true
    );

    const withIndividuals = baseTournament({
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            {
              id: "e1",
              name: "A",
              playerIds: ["p1"],
              status: ENTRY_STATUS.ACTIVE,
            },
          ],
          groups: [],
          matches: [],
        },
      ],
    });
    const blocked = assessOfficialRegistrationModeChange(
      withIndividuals,
      OFFICIAL_REGISTRATION_MODE.PAIR
    );
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.code, "MODE_SWITCH_BLOCKED_ENTRY_SHAPE");

    assert.throws(() =>
      patchOfficialCompetitionSettings(withIndividuals, {
        registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
      })
    );

    // No automatic deletion — entry still present
    assert.equal(withIndividuals.events[0].entries.length, 1);
  });

  it("individual registration on doubles can approve 1-player entry", () => {
    let t = baseTournament();
    const entry = {
      id: "e-ind",
      name: "Nguyen Van A",
      playerIds: ["p1"],
      status: ENTRY_STATUS.PENDING,
    };
    t = {
      ...t,
      events: [{ ...t.events[0], entries: [entry] }],
    };
    const approved = approveEntry(t, entry.id, { eventId: "ev1" });
    assert.equal(approved.ok, true);
    assert.equal(
      approved.tournament.events[0].entries[0].playerIds.length,
      1
    );
  });

  it("pair mode still rejects incomplete doubles entry on approve", () => {
    let t = baseTournament({
      settings: {
        officialCompetition: {
          registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
        },
      },
    });
    t = {
      ...t,
      events: [
        {
          ...t.events[0],
          entries: [
            {
              id: "e-incomplete",
              name: "Incomplete",
              playerIds: ["p1"],
              status: ENTRY_STATUS.PENDING,
            },
          ],
        },
      ],
    };
    const result = approveEntry(t, "e-incomplete", { eventId: "ev1" });
    assert.equal(result.ok, false);
  });

  it("finalization buckets show eligible/pending/ineligible with matching counts", () => {
    const t = baseTournament({
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            {
              id: "ok1",
              name: "A",
              playerIds: ["p1"],
              status: ENTRY_STATUS.ACTIVE,
            },
            {
              id: "ok2",
              name: "B",
              playerIds: ["p2"],
              status: ENTRY_STATUS.APPROVED,
            },
            {
              id: "pend",
              name: "C",
              playerIds: ["p3"],
              status: ENTRY_STATUS.PENDING,
            },
            {
              id: "rej",
              name: "D",
              playerIds: ["p4"],
              status: ENTRY_STATUS.REJECTED,
              rejectionReason: "Trình độ",
            },
          ],
          groups: [],
          matches: [],
        },
      ],
    });
    const buckets = projectOfficialFinalizationBuckets(t, "ev1");
    assert.equal(buckets.eligible.length, 2);
    assert.equal(buckets.pending.length, 1);
    assert.equal(buckets.ineligible.length, 1);
    assert.equal(
      buckets.counts.eligible + buckets.counts.pending + buckets.counts.ineligible,
      buckets.counts.total
    );
    const drawInput = filterOfficialDrawEntries(t.events[0].entries, t);
    assert.deepEqual(
      drawInput.map((e) => e.id).sort(),
      buckets.eligible.map((e) => e.id).sort()
    );
  });

  it("createOpenEntryFromPlayer remains 1-player individual entry shape", () => {
    const entry = createOpenEntryFromPlayer(
      { id: "p9", name: "Solo", clubName: "CLB" },
      { tournamentId: "t1", eventId: "ev1" }
    );
    assert.equal(entry.playerIds.length, 1);
    assert.equal(entry.playerIds[0], "p9");
  });

  it("Side-out remains fail-closed; backend package required; no new default yet", () => {
    assert.equal(SIDEOUT_OPERATIONAL, false);
    assert.equal(SIDEOUT_SELECTION_FAIL_CLOSED, true);
    assert.equal(SIDEOUT_BACKEND_PACKAGE_REQUIRED, true);
    assert.equal(SIDEOUT_DEFAULT_FOR_NEW_TOURNAMENT, false);
    assert.equal(SIDEOUT_SHARED_EXTRACTION_RECONCILE_AFTER_PR418, false);
    assert.equal(INTENDED_NEW_TOURNAMENT_SCORING_METHOD, OFFICIAL_SCORING_METHOD.SIDE_OUT);
    assert.equal(resolveNewOfficialTournamentScoringDefault(), OFFICIAL_SCORING_METHOD.RALLY);

    const t = patchOfficialCompetitionSettings(baseTournament(), {
      scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
    });
    assert.equal(getOfficialCompetitionSettings(t).scoringMethod, OFFICIAL_SCORING_METHOD.RALLY);

    const rallyKept = patchOfficialCompetitionSettings(baseTournament(), {
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
    });
    assert.equal(
      getOfficialCompetitionSettings(rallyKept).scoringMethod,
      OFFICIAL_SCORING_METHOD.RALLY
    );
  });

  it("explicit registrationMode persists through patch/readback", () => {
    let t = baseTournament({ settings: { officialCompetition: {} } });
    t = patchOfficialCompetitionSettings(t, {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(
      t.settings.officialCompetition.registrationMode,
      OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
    );
    assert.equal(
      getOfficialCompetitionSettings(t).registrationMode,
      OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
    );
  });
});
