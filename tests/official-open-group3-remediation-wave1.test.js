/**
 * Group 3 remediation wave 1:
 * Rally default, Point Cap capability, no invented change-end threshold.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  COMPETITION_RULES_CAPABILITY_ID,
} from "../src/features/competition-core/competition-rules/index.js";
import {
  OFFICIAL_SCORING_METHOD,
  SIDEOUT_OPERATIONAL,
  resolveNewOfficialTournamentScoringDefault,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  normalizeContentCompetitionRules,
  patchEventContentCompetitionRules,
} from "../src/features/individual-tournament/engines/officialContentCompetitionRules.js";
import {
  buildOfficialOpenCompetitionRulesProfile,
  resolveOfficialEffectiveCapability,
} from "../src/features/tournament/official-open-adapter-b/index.js";
import { projectOfficialSettings } from "../src/features/tournament/official-tournament-experience/officialExperienceCommands.js";

function rules(scoringMethod = undefined) {
  return normalizeContentCompetitionRules({
    matchScoring: {
      ...(scoringMethod ? { scoringMethod } : {}),
      targetPoints: 11,
      winCondition: {
        winByEnabled: true,
        winByMargin: 2,
        pointCapEnabled: true,
        pointCap: 15,
      },
      changeEnd: {
        changeEndsEnabled: false,
        changeEndsAtPoints: null,
      },
    },
  });
}

function tournament() {
  return {
    id: "g3-r-wave1",
    tenantId: "tenant-1",
    mode: "official_tournament",
    officialMode: "open",
    settings: {
      officialCompetition: {
        scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
      },
    },
    events: [
      { id: "event-a", name: "A", competitionRules: rules() },
      {
        id: "event-b",
        name: "B",
        competitionRules: rules(OFFICIAL_SCORING_METHOD.SIDE_OUT),
      },
    ],
  };
}

describe("official-open-group3-remediation-wave1", () => {
  it("G3-R1: blank/new Content defaults Rally while explicit methods survive", () => {
    assert.equal(resolveNewOfficialTournamentScoringDefault(), OFFICIAL_SCORING_METHOD.RALLY);
    assert.equal(rules().matchScoring.scoringMethod, OFFICIAL_SCORING_METHOD.RALLY);
    assert.equal(
      rules(OFFICIAL_SCORING_METHOD.RALLY).matchScoring.scoringMethod,
      OFFICIAL_SCORING_METHOD.RALLY
    );
    assert.equal(SIDEOUT_OPERATIONAL, true);
    assert.equal(
      rules(OFFICIAL_SCORING_METHOD.SIDE_OUT).matchScoring.scoringMethod,
      OFFICIAL_SCORING_METHOD.SIDE_OUT
    );
  });

  it("G3-R1: explicit event mutation isolates Content A from Content B", () => {
    const before = tournament();
    const eventBBefore = structuredClone(before.events[1].competitionRules);
    const result = patchEventContentCompetitionRules(before, "event-a", {
      contentRules: rules(OFFICIAL_SCORING_METHOD.RALLY),
    });
    const next = result.tournament;

    assert.equal(next.events[0].competitionRules.matchScoring.scoringMethod, "rally");
    assert.deepEqual(next.events[1].competitionRules, eventBBefore);
    assert.equal(next.settings.officialCompetition.scoringMethod, "side_out");
  });

  it("G3-R2: Point Cap follows canonical and Official effective capability truth", () => {
    const capability = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.POINT_CAP
    );
    assert.equal(capability.policy, "SUPPORTED");
    assert.equal(capability.execution, "SUPPORTED");
    assert.equal(capability.effectiveSelectable, true);

    const projected = projectOfficialSettings(tournament(), {
      selectedEventId: "event-a",
    });
    assert.equal(projected.scoringCapabilities.pointCap, true);
    assert.equal(projected.scoringCapabilities.winBy, true);
    assert.equal(projected.scoringCapabilities.sideOut, true);

    const panel = readFileSync(
      "src/features/tournament/experience-a1/components/OfficialContentFormatSettingsPanel.jsx",
      "utf8"
    );
    assert.match(panel, /scoringCaps\.pointCap !== true/);
    assert.match(panel, /disabled=\{disabled \|\| pointCapUnsupported\}/);
  });

  it("G3-R2: persisted Point Cap remains mapped into the canonical profile", () => {
    const built = buildOfficialOpenCompetitionRulesProfile(tournament(), {
      eventId: "event-a",
    });
    assert.equal(built.ok, true);
    assert.equal(built.profile.matchScoring.winCondition.pointCapEnabled, true);
    assert.equal(built.profile.matchScoring.winCondition.pointCap, 15);
  });

  it("G3-R3: Adapter B preserves missing change-end threshold as unresolved", () => {
    const unresolved = tournament();
    unresolved.events[0].competitionRules = normalizeContentCompetitionRules({
      ...unresolved.events[0].competitionRules,
      matchScoring: {
        ...unresolved.events[0].competitionRules.matchScoring,
        changeEnd: {
          changeEndsEnabled: true,
          changeEndsAtPoints: null,
        },
      },
    });
    const built = buildOfficialOpenCompetitionRulesProfile(unresolved, {
      eventId: "event-a",
    });
    assert.equal(built.ok, true);
    assert.equal(built.profile.matchScoring.changeEnd.changeEndsEnabled, true);
    assert.equal(built.profile.matchScoring.changeEnd.changeEndsAtPoints, null);

    const explicit = tournament();
    explicit.events[0].competitionRules = normalizeContentCompetitionRules({
      ...explicit.events[0].competitionRules,
      matchScoring: {
        ...explicit.events[0].competitionRules.matchScoring,
        changeEnd: {
          changeEndsEnabled: true,
          changeEndsAtPoints: 6,
        },
      },
    });
    const explicitBuilt = buildOfficialOpenCompetitionRulesProfile(explicit, {
      eventId: "event-a",
    });
    assert.equal(explicitBuilt.profile.matchScoring.changeEnd.changeEndsAtPoints, 6);

    const changeEnd = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.CHANGE_END
    );
    assert.equal(changeEnd.execution, "PARTIAL");
    assert.equal(changeEnd.effectiveSelectable, false);
  });
});
