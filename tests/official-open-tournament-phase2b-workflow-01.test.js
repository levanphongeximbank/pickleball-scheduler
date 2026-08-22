/**
 * Phase 2B — Official settings / registration mode / scoring / round stages / draw branches.
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
  OFFICIAL_ROUND_SCORE_KEY,
  getOfficialCompetitionSettings,
  patchOfficialCompetitionSettings,
  deriveLegacyOfficialRegistrationMode,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  resolveOfficialMatchScoringRules,
  validateOfficialFinishedScore,
  mapMatchToOfficialRoundKey,
  SIDEOUT_POINT_BY_POINT_RUNTIME_BLOCKED,
} from "../src/features/individual-tournament/engines/officialScoringRulesResolver.js";
import {
  OFFICIAL_STAGE_ID,
  deriveOfficialOrganizerStages,
  deriveOfficialKnockoutStages,
  buildOfficialDrawBlockMessage,
  filterOfficialDrawEntries,
  buildOfficialCompetitionFacts,
} from "../src/features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";

function baseTournament(overrides = {}) {
  return {
    id: "t-p2b",
    name: "Official P2B",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    settings: {},
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

describe("official-open-tournament-phase2b-workflow-01", () => {
  it("settings: pair/individual registrationMode persists and hydrates", () => {
    let t = baseTournament();
    t = patchOfficialCompetitionSettings(t, {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(getOfficialCompetitionSettings(t).registrationMode, "individual");
    t = patchOfficialCompetitionSettings(t, {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    assert.equal(getOfficialCompetitionSettings(t).registrationMode, "pair");
    assert.equal(getOfficialCompetitionSettings(t).registrationModeSource, "explicit");
  });

  it("settings: legacy doubles defaults to pair without breaking", () => {
    const t = baseTournament();
    assert.equal(deriveLegacyOfficialRegistrationMode(t), OFFICIAL_REGISTRATION_MODE.PAIR);
    assert.equal(getOfficialCompetitionSettings(t).registrationMode, "pair");
    assert.equal(getOfficialCompetitionSettings(t).registrationModeSource, "legacy_derived");
  });

  it("settings: legacy singles defaults to individual", () => {
    const t = baseTournament({
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_SINGLE,
          entries: [{ id: "e1", playerIds: ["p1"], status: ENTRY_STATUS.ACTIVE }],
          groups: [],
          matches: [],
        },
      ],
    });
    assert.equal(deriveLegacyOfficialRegistrationMode(t), OFFICIAL_REGISTRATION_MODE.INDIVIDUAL);
  });

  it("legacy fixture: explicit Side-out and explicit 15-point overrides persist/hydrate", () => {
    const explicitOverrideTarget = 15;
    let t = baseTournament();
    t = patchOfficialCompetitionSettings(t, {
      scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
      roundTargets: {
        [OFFICIAL_ROUND_SCORE_KEY.GROUP]: 11,
        [OFFICIAL_ROUND_SCORE_KEY.FINAL]: explicitOverrideTarget,
        [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]: explicitOverrideTarget,
      },
      groupCount: 4,
    });
    const s = getOfficialCompetitionSettings(t);
    assert.equal(s.scoringMethod, "side_out");
    assert.equal(s.roundTargets.group, 11);
    assert.equal(s.roundTargets.final, explicitOverrideTarget);
    assert.equal(s.roundTargets.quarterfinal, explicitOverrideTarget);
    assert.equal(s.groupCount, 4);
  });

  it("legacy compatibility resolver: explicit stage overrides are non-default fixtures", () => {
    const explicitOverrideTarget = 15;
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      roundTargets: {
        group: 11,
        round_of_16: 11,
        quarterfinal: explicitOverrideTarget,
        semifinal: explicitOverrideTarget,
        final: explicitOverrideTarget,
      },
    });
    const group = resolveOfficialMatchScoringRules(t, {
      stage: "group",
      groupId: "A",
      eventId: "ev1",
    });
    assert.equal(group.targetPoints, 11);
    assert.match(group.summaryLabel, /11 điểm/);
    assert.equal(
      resolveOfficialMatchScoringRules(t, { roundName: "Vong 16", eventId: "ev1" })
        .targetPoints,
      11
    );
    const qf = resolveOfficialMatchScoringRules(t, {
      roundName: "Tu ket",
      eventId: "ev1",
    });
    assert.equal(qf.roundKey, OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL);
    assert.equal(qf.targetPoints, explicitOverrideTarget);
    const finalRule = resolveOfficialMatchScoringRules(t, {
      stage: "final",
      eventId: "ev1",
    });
    assert.equal(finalRule.targetPoints, explicitOverrideTarget);
    assert.equal(SIDEOUT_POINT_BY_POINT_RUNTIME_BLOCKED, false);
    assert.equal(validateOfficialFinishedScore(group, 5, 3).ok, false);
    assert.equal(validateOfficialFinishedScore(group, 11, 7).ok, true);
    assert.equal(validateOfficialFinishedScore(group, 11, 10).ok, false);
    assert.equal(validateOfficialFinishedScore(group, 12, 10).ok, true);
  });

  it("draw eligibility excludes pending/rejected/withdrawn/incomplete", () => {
    const entries = [
      { id: "1", status: ENTRY_STATUS.ACTIVE },
      { id: "2", status: ENTRY_STATUS.APPROVED },
      { id: "3", status: ENTRY_STATUS.PENDING },
      { id: "4", status: ENTRY_STATUS.REJECTED },
      { id: "5", status: ENTRY_STATUS.WITHDRAWN },
      { id: "6", status: ENTRY_STATUS.WAITLISTED },
    ];
    const eligible = filterOfficialDrawEntries(entries, baseTournament());
    assert.deepEqual(eligible.map((e) => e.id).sort(), ["1", "2"]);
    const blocked = buildOfficialDrawBlockMessage(
      [{ id: "x", status: ENTRY_STATUS.PENDING }],
      baseTournament(),
      2
    );
    assert.equal(blocked.ok, false);
  });

  it("workflow stages are round-centric (settings→…→group→results)", () => {
    const { stages } = deriveOfficialOrganizerStages(baseTournament());
    const ids = stages.map((s) => s.id);
    assert.ok(ids.includes(OFFICIAL_STAGE_ID.SETTINGS));
    assert.ok(ids.includes(OFFICIAL_STAGE_ID.REGISTRATION));
    assert.ok(ids.includes(OFFICIAL_STAGE_ID.LOCK_ENTRIES));
    assert.ok(ids.includes(OFFICIAL_STAGE_ID.DRAW));
    assert.ok(ids.includes(OFFICIAL_STAGE_ID.GROUP_STAGE));
    assert.ok(ids.includes(OFFICIAL_STAGE_ID.RESULTS));
    assert.ok(!ids.includes("referee"));
    assert.ok(!ids.includes("scoring"));
  });

  it("facts: pair mode does not require pairing; individual does before draw", () => {
    const pairT = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    assert.equal(buildOfficialCompetitionFacts(pairT).draw.needsPairing, false);

    const indT = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(buildOfficialCompetitionFacts(indT).draw.needsPairing, true);
  });

  it("dynamic knockout: SF+Final only for 4-team path", () => {
    const t = baseTournament({
      status: TOURNAMENT_STATUS.ACTIVE,
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            { id: "e1", status: ENTRY_STATUS.ACTIVE, name: "A", playerIds: ["p1", "p2"] },
            { id: "e2", status: ENTRY_STATUS.ACTIVE, name: "B", playerIds: ["p3", "p4"] },
          ],
          groups: [{ id: "g1", entries: [{ id: "e1" }, { id: "e2" }] }],
          matches: [],
          bracket: {
            rounds: [
              {
                name: "Ban ket",
                matches: [{ id: "R1-1", homeSeed: "A1", awaySeed: "B2" }],
              },
              {
                name: "Chung ket",
                matches: [{ id: "R2-1", homeSeed: "W1", awaySeed: "W2" }],
              },
            ],
            winnersByMatch: {},
            unlockedRounds: {},
          },
        },
      ],
    });
    const ko = deriveOfficialKnockoutStages(t);
    assert.equal(ko.length, 2);
    assert.equal(ko[0].label, "Ban ket");
    assert.equal(ko[1].label, "Chung ket");
    assert.ok(["CURRENT", "READY", "BLOCKED"].includes(ko[0].state));
    assert.equal(mapMatchToOfficialRoundKey({}, { roundName: "Chung ket" }), "final");
  });

  it("dynamic knockout: R16 path reveals four rounds", () => {
    const rounds = [
      { name: "Vong 16", matches: [{ id: "a" }, { id: "b" }] },
      { name: "Tu ket", matches: [{ id: "c" }] },
      { name: "Ban ket", matches: [{ id: "d" }] },
      { name: "Chung ket", matches: [{ id: "e" }] },
    ];
    const t = baseTournament({
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [],
          groups: [{ id: "g1" }],
          matches: [],
          bracket: { rounds, winnersByMatch: {}, unlockedRounds: {} },
        },
      ],
    });
    const ko = deriveOfficialKnockoutStages(t);
    assert.equal(ko.length, 4);
    assert.deepEqual(
      ko.map((s) => s.label),
      ["Vong 16", "Tu ket", "Ban ket", "Chung ket"]
    );
  });

  it("dynamic knockout: final-only path", () => {
    const t = baseTournament({
      events: [
        {
          id: "ev1",
          entries: [],
          groups: [],
          matches: [],
          bracket: {
            rounds: [{ name: "Chung ket", matches: [{ id: "f1" }] }],
            winnersByMatch: {},
            unlockedRounds: {},
          },
        },
      ],
    });
    const ko = deriveOfficialKnockoutStages(t);
    assert.equal(ko.length, 1);
    assert.equal(ko[0].label, "Chung ket");
  });

  it("F5 hydration: settings round-trip via JSON clone", () => {
    let t = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      roundTargets: { final: 15 },
    });
    const hydrated = getOfficialCompetitionSettings(JSON.parse(JSON.stringify(t)));
    assert.equal(hydrated.registrationMode, "individual");
    assert.equal(hydrated.roundTargets.final, 15);
  });

  it("loading UX contract: stage selection is local UI state (not derived-only)", () => {
    const t = baseTournament();
    const first = deriveOfficialOrganizerStages(t);
    const second = deriveOfficialOrganizerStages(JSON.parse(JSON.stringify(t)));
    assert.equal(first.currentStageId, second.currentStageId);
    // Organizer may keep a selected stage after soft refresh; derivation remains pure.
    assert.ok(first.stages.every((stage) => typeof stage.id === "string"));
  });
});
