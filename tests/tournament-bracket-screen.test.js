import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BRACKET_LAYOUT,
  buildBracketTreeLayout,
  getColumnScrollLeft,
} from "../src/components/tournament/bracket/bracketLayoutEngine.js";
import {
  buildAdvancingTeams,
  buildBracketRevealPlan,
  buildBracketViewModel,
  getBracketAnimationTiming,
  getMatchDisplayCode,
  getRoundDisplayName,
} from "../src/components/tournament/bracket/bracketScreenUtils.js";
import {
  buildKnockoutProgress,
  buildTournamentBracket,
} from "../src/pages/tournament.bracket.logic.js";
import { FLOW_STEP_KEYS, TOURNAMENT_FLOW_STEPS } from "../src/components/tournament/animation/shared/tournamentFlowConfig.js";

function createGroup(group, count = 4) {
  return {
    group,
    standing: Array.from({ length: count }, (_, index) => ({
      id: `${group}-${index + 1}`,
      name: `Đội ${group}${index + 1} / VĐV ${group}${index + 1}b`,
      points: count - index,
    })),
  };
}

function buildProgressForTeamCount(groupCount) {
  const groups = Array.from({ length: groupCount }, (_, index) =>
    createGroup(String.fromCharCode(65 + index))
  );
  const rounds = buildTournamentBracket(groups);
  return buildKnockoutProgress(rounds, {});
}

function buildViewModelForGroups(groupCount) {
  const progress = buildProgressForTeamCount(groupCount);
  return buildBracketViewModel({ progress });
}

describe("tournament bracket flow config", () => {
  it("includes bracket step before results", () => {
    assert.equal(TOURNAMENT_FLOW_STEPS[3].key, FLOW_STEP_KEYS.BRACKET);
    assert.equal(TOURNAMENT_FLOW_STEPS[3].label, "Sơ đồ thi đấu");
  });
});

describe("bracket screen utils", () => {
  it("maps engine round names to display labels", () => {
    assert.equal(getRoundDisplayName("Tu ket"), "Tứ kết");
    assert.equal(getRoundDisplayName("Ban ket"), "Bán kết");
    assert.equal(getRoundDisplayName("Chung ket"), "Chung kết");
  });

  it("builds match codes by round", () => {
    assert.equal(getMatchDisplayCode("Tu ket", 0), "TK-01");
    assert.equal(getMatchDisplayCode("Ban ket", 1), "SF-02");
    assert.equal(getMatchDisplayCode("Chung ket", 0), "F-01");
  });

  it("builds view model for 4-team bracket (2 groups x 2)", () => {
    const viewModel = buildViewModelForGroups(2);

    assert.equal(viewModel.rounds.length, 2);
    assert.equal(viewModel.teamCount, 4);
    assert.equal(viewModel.rounds[0].displayName, "Bán kết");
    assert.equal(viewModel.rounds[0].matches[0].code, "SF-01");
  });

  it("builds view model for 8-team bracket", () => {
    const viewModel = buildViewModelForGroups(4);

    assert.equal(viewModel.rounds.length, 3);
    assert.equal(viewModel.teamCount, 8);
    assert.equal(viewModel.rounds[0].matches[0].code, "TK-01");
    assert.equal(viewModel.rounds[0].matches[0].home.name.includes("Đội"), true);
  });

  it("builds view model for 16-team bracket", () => {
    const viewModel = buildViewModelForGroups(8);

    assert.equal(viewModel.teamCount, 16);
    assert.equal(viewModel.rounds[0].displayName, "Vòng 1/8");
  });

  it("marks placeholder slots as waiting", () => {
    const progress = buildProgressForTeamCount(4);
    const viewModel = buildBracketViewModel({ progress });
    const finalMatch = viewModel.rounds[2].matches[0];

    assert.equal(finalMatch.home.name, "Chờ đội thắng");
    assert.equal(finalMatch.status, "waiting");
  });

  it("does not expose champion before final is complete", () => {
    const progress = buildProgressForTeamCount(4);
    const qfWinners = {
      [progress.rounds[0].matches[0].id]: "home",
      [progress.rounds[0].matches[1].id]: "home",
    };
    const afterQf = buildKnockoutProgress(progress.rounds, qfWinners);
    const viewModel = buildBracketViewModel({ progress: afterQf });

    assert.equal(viewModel.champion, null);
    assert.equal(viewModel.rounds[2].matches[0].completed, false);
  });

  it("exposes champion only after final result from engine", () => {
    const progress = buildProgressForTeamCount(4);
    const qfWinners = Object.fromEntries(
      progress.rounds[0].matches.map((match) => [match.id, "home"])
    );
    const afterQf = buildKnockoutProgress(progress.rounds, qfWinners);
    const sfWinners = {
      ...qfWinners,
      [afterQf.rounds[1].matches[0].id]: "home",
      [afterQf.rounds[1].matches[1].id]: "home",
    };
    const afterSf = buildKnockoutProgress(progress.rounds, sfWinners);
    const finalWinners = {
      ...sfWinners,
      [afterSf.rounds[2].matches[0].id]: "home",
    };
    const done = buildKnockoutProgress(progress.rounds, finalWinners);
    const viewModel = buildBracketViewModel({ progress: done });

    assert.ok(viewModel.champion);
    assert.equal(viewModel.rounds[2].matches[0].completed, true);
  });

  it("tracks advancing teams after quarterfinal results", () => {
    const progress = buildProgressForTeamCount(4);
    const winners = {
      [progress.rounds[0].matches[0].id]: "home",
      [progress.rounds[0].matches[1].id]: "away",
    };
    const resolved = buildKnockoutProgress(progress.rounds, winners);
    const advancing = buildAdvancingTeams(resolved);

    assert.equal(advancing.length, 2);
    assert.equal(advancing[0].toRoundDisplay, "Bán kết");
  });

  it("preserves long team names", () => {
    const longName = "Nguyễn Văn Anh Tuấn Rất Dài / Trần Thị Bích Ngọc Siêu Dài";
    const progress = buildKnockoutProgress(
      [
        {
          name: "Chung ket",
          matches: [
            {
              id: "R1-M1",
              home: { id: "1", name: longName },
              away: { id: "2", name: "Đội B" },
              homeSeed: "A1",
              awaySeed: "B1",
            },
          ],
        },
      ],
      {}
    );

    const viewModel = buildBracketViewModel({ progress });
    assert.equal(viewModel.rounds[0].matches[0].home.name, longName);
  });

  it("builds reveal plan from view model", () => {
    const viewModel = buildViewModelForGroups(4);
    const plan = buildBracketRevealPlan(viewModel);

    assert.equal(plan.length, viewModel.rounds.length);
    assert.equal(plan[0].matches.length, 4);
  });

  it("exposes animation timing presets", () => {
    const fast = getBracketAnimationTiming("fast");
    const slow = getBracketAnimationTiming("slow");

    assert.ok(fast.matchMs < slow.matchMs);
    assert.ok(fast.roundMs < slow.roundMs);
  });
});

describe("bracket layout engine", () => {
  it("positions 8-team bracket with increasing vertical span", () => {
    const viewModel = buildViewModelForGroups(4);
    const layout = buildBracketTreeLayout(viewModel.rounds);

    assert.equal(layout.nodes.length, 7);
    assert.ok(layout.edges.length >= 6);
    assert.ok(layout.width > BRACKET_LAYOUT.CARD_WIDTH * 3);
    assert.ok(layout.championSlot);
  });

  it("positions 16-team bracket with four columns before champion", () => {
    const viewModel = buildViewModelForGroups(8);
    const layout = buildBracketTreeLayout(viewModel.rounds);

    assert.equal(layout.nodes.length, 15);
    assert.equal(viewModel.rounds.length, 4);
    assert.ok(layout.height > 400);
  });

  it("creates feeder edges from engine winner seeds", () => {
    const viewModel = buildViewModelForGroups(4);
    const layout = buildBracketTreeLayout(viewModel.rounds);
    const edgeIds = layout.edges.map((edge) => edge.id);

    assert.ok(edgeIds.some((id) => id.includes("R1-M1")));
    assert.ok(edgeIds.some((id) => id.includes("->champion")));
  });

  it("marks connector active when feeder match completed", () => {
    const progress = buildProgressForTeamCount(4);
    const winners = {
      [progress.rounds[0].matches[0].id]: "home",
    };
    const partial = buildKnockoutProgress(progress.rounds, winners);
    const viewModel = buildBracketViewModel({ progress: partial });
    const layout = buildBracketTreeLayout(viewModel.rounds);
    const feederId = progress.rounds[0].matches[0].id;
    const activeEdge = layout.edges.find((edge) => edge.fromId === feederId);

    assert.equal(activeEdge?.active, true);
  });

  it("returns column scroll offsets for sidebar navigation", () => {
    assert.equal(getColumnScrollLeft(0), 0);
    assert.ok(getColumnScrollLeft(2) > getColumnScrollLeft(1));
  });
});

describe("bracket engine integrity", () => {
  it("4-team path resolves champion from engine winners only", () => {
    const groups = [createGroup("A", 2), createGroup("B", 2)];
    const rounds = buildTournamentBracket(groups);
    const semiWinners = {
      [rounds[0].matches[0].id]: "home",
      [rounds[0].matches[1].id]: "home",
    };
    const afterSemi = buildKnockoutProgress(rounds, semiWinners);
    const finalWinners = {
      ...semiWinners,
      [afterSemi.rounds[1].matches[0].id]: "home",
    };
    const done = buildKnockoutProgress(rounds, finalWinners);

    assert.equal(done.champion?.id, rounds[0].matches[0].home.id);
  });
});
