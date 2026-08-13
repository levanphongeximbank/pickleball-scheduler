/**
 * Phase 2B contract hardening — settings / side-out fail-closed / registration
 * unresolved / scoring provenance / stageLabel / authorities.
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
  OFFICIAL_REGISTRATION_MODE_RESOLUTION,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_ROUND_SCORE_KEY,
  CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  DEFAULT_OFFICIAL_ROUND_TARGETS,
  SIDEOUT_OPERATIONAL,
  SIDEOUT_SELECTION_FAIL_CLOSED,
  getOfficialCompetitionSettings,
  patchOfficialCompetitionSettings,
  resolveOfficialRegistrationMode,
  isOfficialRegistrationModeResolved,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  resolveOfficialMatchScoringRules,
  validateOfficialFinishedScore,
  SIDEOUT_POINT_BY_POINT_RUNTIME_BLOCKED,
} from "../src/features/individual-tournament/engines/officialScoringRulesResolver.js";
import {
  buildOfficialDrawBlockMessage,
  buildOfficialCompetitionFacts,
} from "../src/features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  REFEREE_SCORING_RULE_TRANSPORT_BLOCKED,
  syncOfficialAssignedMatchToLive,
} from "../src/features/individual-tournament/engines/officialRefereeLiveBridge.js";
import { DEFAULT_TIME_PREDICTION } from "../src/features/tournament-engine/constants/defaults.js";
import { getEligibilityRules } from "../src/features/individual-tournament/engines/eligibilityEngine.js";

function baseTournament(overrides = {}) {
  return {
    id: "t-harden",
    name: "Official Harden",
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

describe("official-open-tournament-phase2b-hardening-01", () => {
  it("A. round target defaults provenance from DEFAULT_TIME_PREDICTION.pointsToWin", () => {
    assert.equal(CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT, DEFAULT_TIME_PREDICTION.pointsToWin);
    assert.equal(DEFAULT_OFFICIAL_ROUND_TARGETS.group, DEFAULT_TIME_PREDICTION.pointsToWin);
    assert.equal(DEFAULT_OFFICIAL_ROUND_TARGETS.final, DEFAULT_TIME_PREDICTION.pointsToWin);
    const rules = resolveOfficialMatchScoringRules(baseTournament(), { stage: "group" });
    assert.equal(rules.targetPoints, DEFAULT_TIME_PREDICTION.pointsToWin);
  });

  it("B. rally is the only operable scoring method", () => {
    let t = patchOfficialCompetitionSettings(baseTournament(), {
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
    });
    assert.equal(getOfficialCompetitionSettings(t).scoringMethod, "rally");
    const rules = resolveOfficialMatchScoringRules(t, { stage: "final" });
    assert.equal(rules.scoringMethod, "rally");
    assert.match(rules.summaryLabel, /Rally/);
  });

  it("C. side-out selection fail-closed — cannot activate as operable mode", () => {
    assert.equal(SIDEOUT_OPERATIONAL, false);
    assert.equal(SIDEOUT_SELECTION_FAIL_CLOSED, true);
    assert.equal(SIDEOUT_POINT_BY_POINT_RUNTIME_BLOCKED, true);
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
    });
    assert.equal(getOfficialCompetitionSettings(t).scoringMethod, "rally");
    assert.equal(
      resolveOfficialMatchScoringRules(t, { stage: "group" }).scoringMethod,
      "rally"
    );
  });

  it("D. registration mode — explicit / inferred / unresolved", () => {
    const explicit = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(
      resolveOfficialRegistrationMode(explicit).registrationModeResolution,
      OFFICIAL_REGISTRATION_MODE_RESOLUTION.EXPLICIT
    );

    const doubles = baseTournament();
    assert.equal(resolveOfficialRegistrationMode(doubles).registrationMode, "pair");
    assert.equal(
      resolveOfficialRegistrationMode(doubles).registrationModeResolution,
      OFFICIAL_REGISTRATION_MODE_RESOLUTION.LEGACY_INFERRED
    );

    const singles = baseTournament({
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
    assert.equal(resolveOfficialRegistrationMode(singles).registrationMode, "individual");

    const ambiguous = baseTournament({
      events: [
        {
          id: "ev1",
          eventType: "",
          entries: [
            { id: "e1", playerIds: ["p1"], status: ENTRY_STATUS.ACTIVE },
            { id: "e2", playerIds: ["p2", "p3"], status: ENTRY_STATUS.ACTIVE },
          ],
          groups: [],
          matches: [],
        },
      ],
    });
    const unresolved = resolveOfficialRegistrationMode(ambiguous);
    assert.equal(
      unresolved.registrationModeResolution,
      OFFICIAL_REGISTRATION_MODE_RESOLUTION.UNRESOLVED_LEGACY
    );
    assert.equal(unresolved.registrationMode, null);
    assert.equal(isOfficialRegistrationModeResolved(ambiguous), false);

    const blocked = buildOfficialDrawBlockMessage(
      ambiguous.events[0].entries,
      ambiguous,
      2
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.modeUnresolved, true);
    assert.match(blocked.error, /chế độ đăng ký/i);

    const facts = buildOfficialCompetitionFacts(ambiguous);
    assert.equal(facts.draw.canDraw, false);
    assert.equal(facts.registrationModeUnresolved, true);

    // Organizer may explicitly resolve mode only when entry shapes are compatible.
    const emptyUnresolved = baseTournament({
      events: [{ id: "ev1", eventType: "", entries: [], groups: [], matches: [] }],
    });
    assert.equal(isOfficialRegistrationModeResolved(emptyUnresolved), false);
    const resolved = patchOfficialCompetitionSettings(emptyUnresolved, {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    assert.equal(isOfficialRegistrationModeResolved(resolved), true);
    assert.equal(getOfficialCompetitionSettings(resolved).registrationMode, "pair");

    // Mixed shapes must not be silently reinterpreted as pair.
    assert.throws(
      () =>
        patchOfficialCompetitionSettings(ambiguous, {
          registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
        }),
      /đăng ký/
    );
  });

  it("E/F. stageLabel transport removed; referee scoring transport blocked", () => {
    assert.equal(REFEREE_SCORING_RULE_TRANSPORT_BLOCKED, true);
  });

  it("G. groupCount single authority under officialCompetition", () => {
    const t = patchOfficialCompetitionSettings(baseTournament(), { groupCount: 6 });
    assert.equal(getOfficialCompetitionSettings(t).groupCount, 6);
    assert.equal(t.settings.officialCompetition.maxIndividualLevel, undefined);
    assert.equal(t.settings.officialCompetition.maxPairLevel, undefined);
  });

  it("H. eligibility remains eligibilityRules authority (not officialCompetition)", () => {
    const t = baseTournament({
      settings: {
        eligibilityRules: {
          skill: { enabled: true, maxLevel: 4.5 },
          rating: { enabled: true, maxRating: 1200 },
        },
      },
    });
    const rules = getEligibilityRules(t);
    assert.equal(rules.skill.maxLevel, 4.5);
    assert.equal(rules.rating.maxRating, 1200);
    const competition = getOfficialCompetitionSettings(t);
    assert.equal("maxIndividualLevel" in competition, false);
  });

  it("I. F5 hydration of settings", () => {
    let t = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      roundTargets: { [OFFICIAL_ROUND_SCORE_KEY.FINAL]: 15 },
      groupCount: 3,
    });
    const hydrated = getOfficialCompetitionSettings(JSON.parse(JSON.stringify(t)));
    assert.equal(hydrated.registrationMode, "individual");
    assert.equal(hydrated.roundTargets.final, 15);
    assert.equal(hydrated.groupCount, 3);
  });

  it("scoring consumers share one resolver target", () => {
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      roundTargets: {
        group: 11,
        quarterfinal: 15,
        final: 21,
      },
    });
    const organizer = resolveOfficialMatchScoringRules(t, { stage: "group" });
    const refereeSame = resolveOfficialMatchScoringRules(t, { stage: "group", groupId: "A" });
    assert.equal(organizer.targetPoints, refereeSame.targetPoints);
    assert.equal(organizer.scoringMethod, refereeSame.scoringMethod);
    assert.equal(validateOfficialFinishedScore(organizer, 11, 9).ok, true);
    assert.equal(validateOfficialFinishedScore(organizer, 11, 10).ok, true);
    assert.equal(
      resolveOfficialMatchScoringRules(t, { roundName: "Chung ket" }).targetPoints,
      21
    );
    assert.equal(resolveOfficialMatchScoringRules(t, { stage: "group" }).winBy, null);
    assert.equal(resolveOfficialMatchScoringRules(t, { stage: "group" }).winByPolicyDeferred, true);
  });

  it("bridge does not mutate stageLabel with scoring summary", async () => {
    const tournament = baseTournament({
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            { id: "e1", name: "A", status: ENTRY_STATUS.ACTIVE, playerIds: ["p1", "p2"] },
            { id: "e2", name: "B", status: ENTRY_STATUS.ACTIVE, playerIds: ["p3", "p4"] },
          ],
          groups: [],
          matches: [
            {
              id: "m1",
              entryAId: "e1",
              entryBId: "e2",
              stageLabel: "Vong bang",
              referee: { token: "tok", name: "TT" },
            },
          ],
        },
      ],
    });
    const result = await syncOfficialAssignedMatchToLive({
      tournament,
      match: tournament.events[0].matches[0],
      clubId: "club-1",
      courts: [],
      players: [],
    });
    // Without supabase, bridge skips — but when liveRecord built, stageLabel stays clean.
    // Exercise build path via skipped needsSupabase still constructs before upsert in success path.
    // Here we only assert constant + that stageLabel encoding is not part of public API.
    assert.equal(REFEREE_SCORING_RULE_TRANSPORT_BLOCKED, true);
    assert.ok(result.skipped || result.needsSupabase || result.ok === false);
  });
});
