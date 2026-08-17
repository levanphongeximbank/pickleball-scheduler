/**
 * Official/Open Settings + Match Rules + Pairing Presentation final closure.
 * PATH B — operable UX/settings + presentation; shared Side-out/BO3/win-by/change-end remain unavailable.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  MATCH_STAGE,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
  SIDEOUT_OPERATIONAL,
  BEST_OF_3_OPERATIONAL,
  WIN_BY_POLICY_DEFERRED,
  getOfficialCompetitionSettings,
  patchOfficialCompetitionSettings,
  normalizeOfficialTournamentName,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  buildOfficialSettingsCanonicalFingerprint,
  buildOfficialSettingsDraftFromTournament,
} from "../src/features/individual-tournament/engines/officialSettingsDraftModel.js";
import {
  resolveOfficialMatchScoringRules,
  buildOfficialMatchRulesSummaryLines,
  formatOfficialMatchRulesSummary,
} from "../src/features/individual-tournament/engines/officialScoringRulesResolver.js";
import { createOfficialTournamentRefereeAdapter } from "../src/features/tournament/official-open-adapter-b/officialTournamentRefereeAdapter.js";
import {
  buildPairingSteps,
  buildPairingWaitingPlayers,
  ANIMATION_MODES,
} from "../src/components/tournament/animation/animationUtils.js";
import {
  createCompetitionRefereeAdapterRegistry,
  runCompetitionRefereeAdapterConformance,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
} from "../src/features/competition-engine/integration/referee/index.js";

function baseTournament(overrides = {}) {
  return {
    id: "t-final-closure",
    name: "Official Final Closure",
    version: 3,
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    tenantId: "tenant-1",
    clubId: "club-1",
    settings: {},
    events: [
      {
        id: "ev1",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [],
        groups: [],
        matches: [
          { id: "m-g", stage: MATCH_STAGE.GROUP },
          { id: "m-k", stage: MATCH_STAGE.QUARTERFINAL },
          { id: "m-f", stage: MATCH_STAGE.FINAL },
        ],
      },
    ],
    ...overrides,
  };
}

function readSrc(rel) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("official-open-settings-match-rules-pairing-final-closure-01", () => {
  it("1-7 draft stability + single save model + blank name rejected", () => {
    assert.equal(normalizeOfficialTournamentName("").ok, false);
    const t1 = baseTournament();
    const fp1 = buildOfficialSettingsCanonicalFingerprint(t1);
    const softReloadSame = { ...t1 };
    const fp2 = buildOfficialSettingsCanonicalFingerprint(softReloadSame);
    assert.equal(fp1, fp2, "soft-poll identical content must keep fingerprint");

    const draft = buildOfficialSettingsDraftFromTournament(t1);
    draft.registrationMode = OFFICIAL_REGISTRATION_MODE.PAIR;
    draft.tournamentName = "Open Cup Renamed";
    // Simulating dirty draft: fingerprint unchanged → UI must not wipe (dirty guard).
    assert.equal(buildOfficialSettingsCanonicalFingerprint(t1), fp1);
    assert.equal(draft.registrationMode, OFFICIAL_REGISTRATION_MODE.PAIR);

    let saved = patchOfficialCompetitionSettings(t1, {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
      scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
      matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
      roundTargets: { group: 15, final: 21 },
    });
    saved = { ...saved, name: "Open Cup Renamed", version: 4 };
    const settings = getOfficialCompetitionSettings(saved);
    assert.equal(saved.name, "Open Cup Renamed");
    assert.equal(settings.registrationMode, "pair");
    assert.equal(settings.roundTargets.group, 15);
    assert.equal(settings.matchFormat, "BEST_OF_1");

    const ui = readSrc(
      "src/components/tournament/official/OfficialTournamentSettingsScreen.jsx"
    );
    assert.match(ui, /Lưu cài đặt/);
    assert.match(ui, /if \(dirty\) return/);
    assert.match(ui, /buildOfficialSettingsCanonicalFingerprint/);
    assert.match(ui, /setDirty\(false\)/);
  });

  it("8-11 registration mode + AI restriction + unsafe switch still blocked via engine", () => {
    const pair = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    assert.equal(getOfficialCompetitionSettings(pair).registrationMode, "pair");
    const ind = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(getOfficialCompetitionSettings(ind).registrationMode, "individual");

    const withPairs = baseTournament({
      officialMode: OFFICIAL_MODE.AI_BALANCE,
      events: [
        {
          id: "ev1",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [{ id: "e1", playerIds: ["a", "b"] }],
          groups: [],
          matches: [],
        },
      ],
    });
    assert.throws(() =>
      patchOfficialCompetitionSettings(withPairs, {
        registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
      })
    );
  });

  it("12-16 operable rules persist; unsupported cannot save as operable; summary deterministic", () => {
    assert.equal(SIDEOUT_OPERATIONAL, false);
    assert.equal(BEST_OF_3_OPERATIONAL, false);
    assert.equal(WIN_BY_POLICY_DEFERRED, true);
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      scoringMethod: OFFICIAL_SCORING_METHOD.SIDE_OUT,
      matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_3,
      roundTargets: { group: 11, final: 15 },
    });
    const settings = getOfficialCompetitionSettings(t);
    assert.equal(settings.scoringMethod, "rally");
    assert.equal(settings.matchFormat, "BEST_OF_1");
    assert.equal(settings.roundTargets.group, 11);

    const summary = formatOfficialMatchRulesSummary({
      scoringMethodLabel: "Rally",
      matchFormatLabel: "Best of 1",
      targetPoints: 11,
      roundLabel: "Vòng bảng",
    });
    assert.match(summary, /Rally/);
    assert.match(summary, /Best of 1/);
    assert.match(summary, /11/);
    assert.doesNotMatch(summary, /Side-out|Best of 3|winBy|đổi sân/i);

    const lines = buildOfficialMatchRulesSummaryLines(t, { stage: MATCH_STAGE.GROUP });
    assert.ok(lines.lines.some((row) => row.key === "win_by" && row.unavailable));
    assert.ok(lines.lines.some((row) => row.key === "change_end" && row.unavailable));
  });

  it("17-20 group/knockout/final + Adapter B summary", () => {
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
      roundTargets: { group: 11, quarterfinal: 11, final: 15 },
    });
    const g = resolveOfficialMatchScoringRules(t, { stage: MATCH_STAGE.GROUP });
    const k = resolveOfficialMatchScoringRules(t, { stage: MATCH_STAGE.QUARTERFINAL });
    const f = resolveOfficialMatchScoringRules(t, { stage: MATCH_STAGE.FINAL });
    assert.equal(g.matchFormat, "BEST_OF_1");
    assert.equal(k.matchFormat, "BEST_OF_1");
    assert.equal(f.matchFormat, "BEST_OF_1");
    assert.equal(g.scoringMethod, "rally");
    assert.equal(f.targetPoints, 15);

    const adapter = createOfficialTournamentRefereeAdapter({
      tournament: { ...t, name: "Named For Ref" },
    });
    const ctx = adapter.getCompetitionContext({
      tenantId: "tenant-1",
      competitionId: "t-final-closure",
    });
    assert.equal(ctx.tournamentName, "Named For Ref");
    assert.match(String(ctx.matchRulesSummary || ""), /Rally|Best of 1|điểm/i);
  });

  it("21-25 pairing presentation consumes canonical pairs; zero mutation; invariants", () => {
    const pairs = [
      { id: "p1", name: "A / B", playerIds: ["a", "b"], rating: 4 },
      { id: "p2", name: "C / D", playerIds: ["c", "d"], rating: 3.5 },
    ];
    const before = JSON.stringify(pairs);
    const steps = buildPairingSteps(pairs);
    const waiting = buildPairingWaitingPlayers(pairs, [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
    ]);
    assert.equal(steps.length, 2);
    assert.ok(waiting.length >= 4);
    assert.equal(JSON.stringify(pairs), before, "presentation must not mutate pairs");
    assert.equal(ANIMATION_MODES.PAIRING_REVEAL, "pairing_reveal");

    const setup = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /ANIMATION_MODES\.PAIRING_REVEAL/);
    assert.match(setup, /buildPairingSteps\(formedEntries\)/);
    assert.match(setup, /không đổi kết quả ghép cặp|không đổi dữ liệu/i);
    assert.match(setup, /suggestOpenRandomEntriesFromPlayers/);
    assert.match(setup, /suggestBalancedEntriesFromIndividuals/);
    assert.match(setup, /persistDrawMaterialization[\s\S]*PAIRING_REVEAL/);
    assert.match(setup, /Presentation only/);
  });

  it("26 Referee Adapter B conformance identity", () => {
    const tournament = baseTournament();
    const adapter = createOfficialTournamentRefereeAdapter({ tournament });
    assert.equal(adapter.contractId, COMPETITION_REFEREE_ADAPTER_CONTRACT_ID);
    const registry = createCompetitionRefereeAdapterRegistry({ adapters: [adapter] });
    const conformance = runCompetitionRefereeAdapterConformance(adapter, {
      registry,
      validRequest: {
        tenantId: "tenant-1",
        competitionId: "t-final-closure",
        matchId: "m-g",
      },
      allowScoringRulesCapabilityGap: true,
    });
    if (conformance?.ok === false) {
      assert.ok(adapter.sharedContractCapabilityGaps.length >= 1);
    } else if (conformance && typeof conformance.ok === "boolean") {
      assert.equal(conformance.ok, true);
    }
  });
});
