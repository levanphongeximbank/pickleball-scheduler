/**
 * Screenshot-oriented / mobile viewport visual contracts for Phase 2C remediation.
 * Deterministic fixtures only — no production mock runtime fallback.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import RefereeHome from "../../src/features/referee-production-ui/components/RefereeHome.jsx";
import RefereeMatchScreen from "../../src/features/referee-production-ui/components/RefereeMatchScreen.jsx";
import CanonicalCourtView from "../../src/features/referee-production-ui/components/CanonicalCourtView.jsx";
import { isRefereeWorkspaceRoute } from "../../src/features/referee-production-ui/application/isRefereeWorkspaceRoute.js";
import { projectCanonicalCourtView } from "../../src/features/referee-production-ui/projection/projectCanonicalCourtView.js";
import { projectDreamBreakerRotation } from "../../src/features/referee-production-ui/projection/projectDreamBreakerRotation.js";
import {
  SCORING_SYSTEM,
  createScoringFormat,
} from "../../src/features/competition-core/scoring/index.js";
import "../../src/features/referee-production-ui/styles/referee-production.css";

const SIDE_OUT = createScoringFormat({
  scoringSystem: SCORING_SYSTEM.SIDE_OUT,
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 3,
  metadata: { openingServiceTurn: 2, changeEndPolicyLabel: "Sau mỗi game" },
});

const RALLY = createScoringFormat({
  scoringSystem: SCORING_SYSTEM.RALLY,
  pointsToWin: 21,
  winBy: 2,
  bestOfGames: 1,
});

const NAMES = { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng", "p-a": "Lan", "p-b": "Minh" };

function doublesCourt(system = SIDE_OUT, extras = {}) {
  return projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội 4" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội 3" },
      ],
    },
    participantNames: NAMES,
    scoringRules: system,
    currentScore: {
      points: { SIDE_A: extras.a ?? 1, SIDE_B: extras.b ?? 0 },
      serve: {
        servingSide: "SIDE_A",
        serverNumber: system.scoringSystem === SCORING_SYSTEM.SIDE_OUT ? 2 : 1,
        serverPlayerId: "p1",
        receiverPlayerId: "p4",
      },
      currentGameIndex: 0,
    },
    courtState: {
      serverPlayerId: "p1",
      receiverPlayerId: "p4",
      sideChangeRequired: extras.sideChangeRequired === true,
      courtOrientation: extras.swapped ? "SWAPPED" : "STANDARD",
    },
    matchContext: extras.matchContext || {},
    modeState: extras.modeState || {},
  });
}

function baseView(overrides = {}) {
  const court = overrides.courtProjection || doublesCourt();
  return {
    competitionName: "Giải đồng đội 13/8/2026",
    competitionMode: "TEAM",
    competitionModeLabel: "Giải đồng đội",
    stageName: "KO",
    roundName: "1",
    courtLabel: "Sân 1",
    matchStatusLabel: "Đang diễn ra",
    currentScore: {
      points: { SIDE_A: 1, SIDE_B: 0 },
      serve: { servingSide: "SIDE_A", serverNumber: 2 },
      gamesWon: { SIDE_A: 0, SIDE_B: 0 },
    },
    gameSummary: {
      currentGame: 1,
      gamesWon: { SIDE_A: 0, SIDE_B: 0 },
      bestOf: 3,
      scorePolicyLine: "Best of 3 • đến 11 • win-by 2",
      changeEndPolicy: "Sau mỗi game",
    },
    courtProjection: court,
    canStart: false,
    canScore: true,
    canSuspend: true,
    canResume: false,
    canComplete: false,
    canCorrect: false,
    resultStatus: "NONE",
    ...overrides,
  };
}

describe("referee workspace chrome contract", () => {
  it("suppresses bottom nav only on canonical referee routes", () => {
    expect(isRefereeWorkspaceRoute("/referee")).toBe(true);
    expect(isRefereeWorkspaceRoute("/referee/match/abc")).toBe(true);
    expect(isRefereeWorkspaceRoute("/dashboard")).toBe(false);
    expect(isRefereeWorkspaceRoute("/referee/legacy-token")).toBe(false);
  });
});

describe("1. Referee Home visual", () => {
  it("renders compact My Assignments card without redundant chips / UUID", () => {
    render(
      <MemoryRouter>
        <div style={{ width: 390 }}>
          <RefereeHome
            userLabel="Phong"
            assignments={[
              {
                competitionId: "comp-1",
                matchId: "match-1",
                competitionModeLabel: "Giải đồng đội",
                assignmentStatusLabel: "Đã phân công",
                matchStatusLabel: "Sẵn sàng",
                competitionName: "Giải đồng đội 13/8/2026",
                stageName: "KO",
                roundName: "1",
                participantA: "Đội 4",
                participantB: "Đội 3",
                courtLabel: "Sân 1",
                scheduledTime: "17:02",
                actionLabel: "Vào trận",
                href: "/referee/match/match-1",
              },
            ]}
          />
        </div>
      </MemoryRouter>
    );

    const card = screen.getByTestId("referee-assignment-card");
    expect(within(card).getByTestId("mode-badge")).toHaveTextContent("Giải đồng đội");
    expect(within(card).getByTestId("status-badge")).toHaveTextContent("Đã phân công");
    expect(within(card).queryByTestId("match-status-badge")).not.toBeInTheDocument();
    expect(within(card).getByTestId("competition-name")).toHaveTextContent("Giải đồng đội 13/8/2026");
    expect(within(card).getByTestId("participants")).toHaveTextContent("VS");
    expect(within(card).getByTestId("assignment-action")).toHaveTextContent("Vào trận");
    expect(card.textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(card.textContent).not.toMatch(/\bMODE\b|\bASSIGNED\b/);
  });
});

describe("match screen visual states @ ~390px", () => {
  it("2. Side-Out doubles — 4 players, serving, service turn, distinct scores", () => {
    const court = doublesCourt(SIDE_OUT);
    render(
      <div style={{ width: 390 }}>
        <RefereeMatchScreen view={baseView({ courtProjection: court })} />
      </div>
    );

    expect(screen.getByTestId("canonical-court-view")).toBeInTheDocument();
    expect(screen.getByTestId("court-slot-leftTop")).toHaveTextContent("An");
    expect(screen.getByTestId("court-slot-leftBottom")).toHaveTextContent("Bình");
    expect(screen.getByTestId("court-slot-rightTop")).toHaveTextContent("Chi");
    expect(screen.getByTestId("court-slot-rightBottom")).toHaveTextContent("Dũng");
    expect(screen.getByTestId("serving-indicator")).toHaveTextContent("GIAO");
    expect(screen.getByTestId("service-turn")).toBeInTheDocument();
    expect(screen.getByTestId("service-turn-number")).toHaveTextContent("#2");
    expect(screen.getByTestId("current-game-score")).toBeInTheDocument();
    expect(screen.getByTestId("games-won")).toHaveTextContent("Games: 0–0");
    expect(screen.queryByTestId("rally-score-line")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-point-a")).toHaveTextContent(/Điểm Đội 4|Điểm An|Đội 4/);
    expect(screen.getByTestId("btn-switch-positions")).toHaveTextContent("ĐỔI VỊ TRÍ VĐV");
    expect(screen.getByTestId("btn-change-ends")).toHaveTextContent("ĐỔI SÂN");
  });

  it("3. Rally doubles — two-number score, no service turn #", () => {
    const court = doublesCourt(RALLY, { a: 4, b: 3 });
    render(
      <RefereeMatchScreen
        view={baseView({
          courtProjection: court,
          currentScore: { points: { SIDE_A: 4, SIDE_B: 3 }, gamesWon: { SIDE_A: 0, SIDE_B: 0 } },
        })}
      />
    );
    expect(screen.getByTestId("score-a")).toHaveTextContent("4");
    expect(screen.getByTestId("score-b")).toHaveTextContent("3");
    expect(screen.queryByTestId("service-turn")).not.toBeInTheDocument();
    expect(screen.getByTestId("court-slot-leftTop")).toBeInTheDocument();
    expect(screen.getByTestId("court-slot-leftBottom")).toBeInTheDocument();
  });

  it("4. Singles — two player markers only", () => {
    const court = projectCanonicalCourtView({
      participants: {
        sides: [
          { sideKey: "A", participantIds: ["p-a"], displayName: "Lan" },
          { sideKey: "B", participantIds: ["p-b"], displayName: "Minh" },
        ],
      },
      participantNames: NAMES,
      scoringRules: RALLY,
      currentScore: { points: { SIDE_A: 1, SIDE_B: 0 }, serve: { servingSide: "SIDE_A", serverPlayerId: "p-a" } },
    });
    render(<CanonicalCourtView courtProjection={court} />);
    expect(screen.getByTestId("court-slot-leftTop")).toHaveTextContent("Lan");
    expect(screen.getByTestId("court-slot-rightTop")).toHaveTextContent("Minh");
    expect(screen.queryByTestId("court-slot-leftBottom")).not.toBeInTheDocument();
    expect(screen.queryByTestId("court-slot-rightBottom")).not.toBeInTheDocument();
  });

  it("5. DreamBreaker — active rotation only; no empty A:— / B:—", () => {
    const db = projectDreamBreakerRotation({
      matchContext: { isDreambreaker: true, matchupId: "m1" },
      modeState: {
        matchups: {
          m1: {
            dreambreaker: {
              rotation: {
                sideAPlayerId: "a1",
                sideBPlayerId: "b1",
                nextA: "a2",
                nextB: "b2",
                pointsInRotation: 1,
                rotationPoints: 4,
              },
            },
          },
        },
      },
      participantNames: { a1: "Hà", b1: "Linh", a2: "Khoa", b2: "Nam" },
    });
    const court = {
      ...doublesCourt(RALLY, {
        matchContext: { isDreambreaker: true, matchupId: "m1" },
        modeState: {
          matchups: {
            m1: {
              dreambreaker: {
                rotation: {
                  sideAPlayerId: "a1",
                  sideBPlayerId: "b1",
                  nextA: "a2",
                  nextB: "b2",
                },
              },
            },
          },
        },
      }),
      dreambreaker: db,
      isDreambreaker: true,
    };
    render(<RefereeMatchScreen view={baseView({ courtProjection: court })} />);
    expect(screen.getByTestId("dreambreaker-panel")).toBeInTheDocument();
    expect(screen.getByTestId("db-side-a")).toHaveTextContent("Hà");
    expect(screen.getByTestId("db-side-b")).toHaveTextContent("Linh");
    expect(screen.queryByText(/A:\s*—/)).not.toBeInTheDocument();
  });

  it("5b. DreamBreaker fail-closed when projection incomplete", () => {
    const db = projectDreamBreakerRotation({
      matchContext: { isDreambreaker: true },
      modeState: {},
    });
    render(
      <RefereeMatchScreen
        view={baseView({
          courtProjection: { ...doublesCourt(), dreambreaker: db, isDreambreaker: true },
        })}
      />
    );
    expect(screen.getByTestId("dreambreaker-fail-closed")).toBeInTheDocument();
    expect(screen.queryByTestId("dreambreaker-panel")).not.toBeInTheDocument();
    expect(screen.queryByText(/A:\s*—/)).not.toBeInTheDocument();
  });

  it("5c. leftover dreambreaker blob without match flag does not render panel", () => {
    const db = projectDreamBreakerRotation({
      matchContext: { isDreambreaker: false },
      modeState: { dreambreaker: { rotation: { sideAPlayerId: "a1" } } },
    });
    expect(db.isDreambreaker).toBe(false);
    render(
      <RefereeMatchScreen
        view={baseView({
          courtProjection: { ...doublesCourt(), dreambreaker: db },
        })}
      />
    );
    expect(screen.queryByTestId("dreambreaker-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dreambreaker-fail-closed")).not.toBeInTheDocument();
  });

  it("6+7. change-ends prompt then confirm (ACK path — no visual swap before ACK)", async () => {
    const user = userEvent.setup();
    const onChangeEnds = vi.fn();
    const court = doublesCourt(SIDE_OUT, { sideChangeRequired: true });
    render(
      <RefereeMatchScreen
        view={baseView({ courtProjection: court })}
        onChangeEnds={onChangeEnds}
      />
    );
    expect(screen.getByTestId("change-ends-warning")).toBeInTheDocument();
    expect(screen.getByTestId("canonical-court-view")).toHaveAttribute(
      "data-orientation",
      "STANDARD"
    );
    await user.click(screen.getByTestId("btn-change-ends"));
    expect(screen.getByTestId("change-ends-confirm")).toBeInTheDocument();
    await user.click(screen.getByTestId("btn-change-ends-confirm"));
    expect(onChangeEnds).toHaveBeenCalledTimes(1);
  });

  it("7b. change-ends acknowledged orientation renders only after projection swap", () => {
    const court = doublesCourt(SIDE_OUT, { swapped: true });
    render(<CanonicalCourtView courtProjection={court} />);
    expect(screen.getByTestId("canonical-court-view")).toHaveAttribute(
      "data-orientation",
      "SWAPPED"
    );
  });

  it("8. pending score disables conflicting controls and shows Đang ghi…", () => {
    render(
      <RefereeMatchScreen
        view={baseView()}
        pendingAction="point:SIDE_A"
      />
    );
    expect(screen.getByTestId("pending-banner")).toHaveTextContent("Đang ghi…");
    expect(screen.getByTestId("btn-point-a")).toBeDisabled();
    expect(screen.getByTestId("btn-point-b")).toBeDisabled();
    expect(screen.getByTestId("btn-point-a")).toHaveTextContent("Đang ghi…");
  });

  it("9. stale/reconcile fail-closed", () => {
    const onReload = vi.fn();
    render(<RefereeMatchScreen view={baseView()} stale onReload={onReload} />);
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("btn-point-a")).toBeDisabled();
    expect(screen.getByTestId("btn-reconcile")).toBeInTheDocument();
  });

  it("mobile court stays compact (not full-screen empty rectangle)", () => {
    const { container } = render(
      <div style={{ width: 390 }}>
        <CanonicalCourtView courtProjection={doublesCourt()} />
      </div>
    );
    const court = container.querySelector(".rp-court");
    expect(court).toBeTruthy();
    expect(court.classList.contains("rp-court")).toBe(true);
    // Prefer landscape-ish court, not tall empty 3/4 viewport slab.
    expect(court.className).not.toMatch(/full-viewport|hero-court/);
  });

  it("no permanent player number labels on markers", () => {
    render(<CanonicalCourtView courtProjection={doublesCourt()} />);
    const markers = screen.getAllByTestId(/player-marker-/);
    markers.forEach((node) => {
      expect(node).toHaveAttribute("data-permanent-number", "false");
      expect(node.textContent).not.toMatch(/VĐV\s*#\s*[12]/);
    });
  });
});
