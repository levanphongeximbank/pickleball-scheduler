/**
 * OFFICIAL_OPEN_CANONICAL_RULES_ADAPTER_B_ADOPTION_01
 * Focused architectural conformance — not a certification campaign.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TOURNAMENT_MODE,
  OFFICIAL_MODE,
  EVENT_TYPE,
} from "../src/models/tournament/constants.js";
import {
  COMPETITION_RULES_POLICY_GATEWAY_ID,
  COMPETITION_RULES_PROFILE_SCHEMA_V1,
  COMPETITION_RULES_CONTRACT_VERSION,
  COMPETITION_RULES_CAPABILITY_ID,
  CAPABILITY_STATE,
  LIFECYCLE_MILESTONE,
  RULE_CLASS,
} from "../src/features/competition-core/competition-rules/index.js";
import {
  OFFICIAL_OPEN_ADAPTER_B_ID,
  OFFICIAL_OPEN_ADAPTER_B_VERSION,
  createOfficialOpenAdapterB,
  buildOfficialOpenCompetitionRulesProfile,
  resolveOfficialEffectiveCapability,
} from "../src/features/tournament/official-open-adapter-b/index.js";
import { resolveOfficialMatchScoringRules } from "../src/features/individual-tournament/engines/officialScoringRulesResolver.js";
import { projectOfficialSettings } from "../src/features/tournament/official-tournament-experience/officialExperienceCommands.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "../src/features/tournament/official-tournament-experience/authorityLock.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function officialFixture(overrides = {}) {
  return {
    id: "rules-adoption-1",
    tenantId: "venue-staging-a",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    name: "Official Rules Adoption",
    events: [
      {
        id: "ev-doubles",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [],
        groups: [],
        matches: [],
      },
      {
        id: "ev-women",
        name: "Đôi nữ",
        eventType: EVENT_TYPE.WOMEN_DOUBLE,
        entries: [],
        groups: [],
        matches: [],
      },
    ],
    settings: {
      officialCompetition: {
        scoringMethod: "rally",
        matchFormat: "BEST_OF_1",
        groupCount: 3,
        qualifiersPerGroup: 2,
        totalQualifiers: 8,
        roundTargets: {
          group: 11,
          round_of_16: 11,
          quarterfinal: 11,
          semifinal: 11,
          final: 15,
        },
      },
    },
    ...overrides,
  };
}

describe("OFFICIAL_OPEN_CANONICAL_RULES_ADAPTER_B_ADOPTION_01", () => {
  it("1-4 Adapter B maps Official settings → profile.v1 and calls Adapter A; owns no authority", () => {
    const tournament = officialFixture();
    const built = buildOfficialOpenCompetitionRulesProfile(tournament, {
      eventId: "ev-doubles",
    });
    assert.equal(built.ok, true);
    assert.equal(built.derived, true);
    assert.equal(built.ownsAuthority, false);
    assert.equal(built.profile.schemaVersion, COMPETITION_RULES_PROFILE_SCHEMA_V1);
    assert.equal(built.profile.tenantId, "venue-staging-a");
    assert.equal(built.profile.competitionId, "rules-adoption-1");
    assert.equal(built.profile.qualification.totalQualifiers, 8);
    assert.equal(built.profile.qualification.directQualifiersPerGroup, 2);

    const adapter = createOfficialOpenAdapterB({
      tournament,
      currentTenantId: "venue-staging-a",
    });
    assert.equal(adapter.id, OFFICIAL_OPEN_ADAPTER_B_ID);
    assert.equal(adapter.version, OFFICIAL_OPEN_ADAPTER_B_VERSION);
    assert.equal(adapter.ownsAuthority, false);
    assert.equal(adapter.contracts.rules.ownsAuthority, false);
    assert.equal(adapter.contracts.rules.adapterAId, COMPETITION_RULES_POLICY_GATEWAY_ID);
    assert.equal(adapter.contracts.rules.contractVersion, COMPETITION_RULES_CONTRACT_VERSION);

    const validated = adapter.contracts.rules.validateProfile({ eventId: "ev-doubles" });
    assert.equal(validated.ok, true);

    const multi = buildOfficialOpenCompetitionRulesProfile(tournament, {});
    assert.equal(multi.ok, false);
    assert.equal(multi.code, "EVENT_REQUIRED");
  });

  it("5 effective stage scoring comes from Adapter A", () => {
    const tournament = officialFixture();
    const adapter = createOfficialOpenAdapterB({
      tournament,
      currentTenantId: "venue-staging-a",
    });
    const stage = adapter.contracts.rules.resolveStageMatchRules({
      eventId: "ev-doubles",
      stage: "FINAL",
    });
    assert.equal(stage.ok, true);
    assert.equal(stage.matchScoring.targetPoints, 15);
    assert.equal(stage.executionOwners.scoring, "CORE-16");
    assert.equal(stage.executionOwners.refereeAssignment, "CORE-13");

    const resolved = resolveOfficialMatchScoringRules(
      tournament,
      { stage: "final", eventId: "ev-doubles" },
      { eventId: "ev-doubles" }
    );
    assert.equal(resolved.targetPoints, 15);
    assert.equal(resolved.rulesSource, "competition.rules.policy.gateway.v1");
  });

  it("6-7 qualification from Adapter A; wildcard deferred fail-closed", () => {
    const tournament = officialFixture();
    const adapter = createOfficialOpenAdapterB({
      tournament,
      currentTenantId: "venue-staging-a",
    });
    const plan = adapter.contracts.rules.deriveQualificationPlan({
      eventId: "ev-doubles",
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.groupCount, 3);
    assert.equal(plan.directSlots, 6);
    assert.equal(plan.wildcardSlots, 2);

    const wildcard = adapter.contracts.rules.resolveWildcardRankingPolicy({
      eventId: "ev-doubles",
    });
    assert.equal(wildcard.ok, false);
    assert.equal(wildcard.failClosed, true);
    assert.equal(wildcard.code, "CROSS_GROUP_WILDCARD_EXECUTION_DEFERRED");
  });

  it("8 lifecycle lock delegates Adapter A", () => {
    const tournament = officialFixture();
    const adapter = createOfficialOpenAdapterB({
      tournament,
      currentTenantId: "venue-staging-a",
    });
    const lock = adapter.contracts.rules.canMutateCompetitionRule({
      eventId: "ev-doubles",
      ruleClass: RULE_CLASS.SCORING_FORMAT,
      lifecycleMilestone: LIFECYCLE_MILESTONE.AFTER_MATCH_START,
    });
    assert.equal(lock.ok, true);
    assert.equal(lock.allowed, false);
  });

  it("9-12 referee requirement ≠ CORE-13; court ≠ assignment; no second SSOT; no events[0]", () => {
    const tournament = officialFixture();
    const adapter = createOfficialOpenAdapterB({
      tournament,
      currentTenantId: "venue-staging-a",
    });
    const refReq = adapter.contracts.rules.resolveRefereeRequirement({
      eventId: "ev-doubles",
      stage: "FINAL",
    });
    assert.ok(refReq);
    assert.equal(adapter.contracts.referee != null, true);
    assert.notEqual(adapter.contracts.rules, adapter.contracts.referee);

    const courtReq = adapter.contracts.rules.resolveCourtRequirement({
      eventId: "ev-doubles",
    });
    assert.ok(courtReq);

    const profileSrc = read(
      "src/features/tournament/official-open-adapter-b/buildOfficialOpenCompetitionRulesProfile.js"
    );
    assert.match(profileSrc, /No persistence/);
    assert.doesNotMatch(profileSrc, /localStorage/);
    assert.match(profileSrc, /không dùng events\[0\]/);

    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
  });

  it("capability truth: effective selectable respects Official binding gaps", () => {
    const rally = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_RALLY
    );
    const sideOut = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT
    );
    const bo1 = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_1
    );
    const bo3 = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_3
    );
    const winBy = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.WIN_BY
    );
    const changeEnd = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.CHANGE_END
    );
    const wildcard = resolveOfficialEffectiveCapability(
      COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING
    );

    assert.equal(rally.effectiveSelectable, true);
    assert.equal(sideOut.sharedExecution, CAPABILITY_STATE.SUPPORTED);
    assert.equal(sideOut.effectiveSelectable, false);
    assert.equal(sideOut.bindingGap, true);
    assert.equal(bo1.effectiveSelectable, true);
    assert.equal(bo3.effectiveSelectable, false);
    assert.equal(winBy.effectiveSelectable, false);
    assert.equal(changeEnd.effectiveSelectable, false);
    assert.equal(wildcard.failClosed, true);

    const projected = projectOfficialSettings(officialFixture(), {
      selectedEventId: "ev-doubles",
    });
    assert.equal(projected.scoringCapabilities.rally, true);
    assert.equal(projected.scoringCapabilities.sideOut, false);
    assert.equal(projected.scoringCapabilities.bestOf3, false);
    assert.equal(projected.rulesAdoption.ok, true);
    assert.equal(projected.rulesAdoption.qualification.wildcardSlots, 2);
    assert.equal(projected.rulesAdoption.wildcardFailClosed, true);
  });

  it("13-19 CORE authorities unchanged; no new Adapter B package", () => {
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");

    const createRoot = read(
      "src/features/tournament/official-open-adapter-b/createOfficialOpenAdapterB.js"
    );
    assert.match(createRoot, /contracts\.rules|rules,/);
    assert.match(createRoot, /ownsAuthority:\s*false/);

    assert.equal(
      read("src/features/competition-core/competition-rules/gateway/competitionRulesPolicyGateway.js")
        .includes("MODE_AGNOSTIC=YES"),
      true
    );
  });
});
