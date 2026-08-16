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
import RefereeCompactChrome from "../../src/features/referee-production-ui/components/RefereeCompactChrome.jsx";
import { isRefereeWorkspaceRoute } from "../../src/features/referee-production-ui/application/isRefereeWorkspaceRoute.js";
import { projectCanonicalCourtView } from "../../src/features/referee-production-ui/projection/projectCanonicalCourtView.js";
import { projectDreamBreakerRotation } from "../../src/features/referee-production-ui/projection/projectDreamBreakerRotation.js";
import { buildRefereeMatchView } from "../../src/features/referee-production-ui/projection/buildRefereeMatchView.js";
import {
  SCORING_SYSTEM,
  createScoringFormat,
} from "../../src/features/competition-core/scoring/index.js";
import "../../src/features/referee-production-ui/styles/referee-production.css";

const mockSignOut = vi.fn(async () => ({ ok: true }));

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: { id: "u1", displayName: "Phong", email: "phong@example.com" },
    isAuthenticated: true,
    signOut: (...args) => mockSignOut(...args),
  }),
}));

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
    lifecyclePolicy: extras.lifecyclePolicy || { changeEndPolicyLabel: "Sau mỗi game" },
  });
}

function baseView(overrides = {}) {
  const court = overrides.courtProjection || doublesCourt();
  const built = buildRefereeMatchView({
    matchId: "match-1",
    competitionMode: "TEAM",
    competitionContext: { competitionName: "Giải đồng đội 13/8/2026", competitionId: "c1" },
    matchContext: { stage: "KO", round: 1, courtLabel: "Sân 1", status: "IN_PROGRESS" },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội 4" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội 3" },
      ],
    },
    participantNames: NAMES,
    scoringRules: SIDE_OUT,
    lifecyclePolicy: { changeEndPolicyLabel: "Sau mỗi game" },
    capabilities: { changeEnds: true, switchPositions: true, scoring: true, suspend: true },
    assignedMatch: {
      lifecycleState: "IN_PROGRESS",
      scoreProjection: {
        points: { SIDE_A: 1, SIDE_B: 0 },
        serve: { servingSide: "SIDE_A", serverNumber: 2, serverPlayerId: "p1" },
        gamesWonInCurrentSet: { SIDE_A: 0, SIDE_B: 0 },
        currentGameIndex: 0,
        completedGames: [],
        format: SIDE_OUT,
      },
      match: {
        court: court.sideChangeRequired
          ? { sideChangeRequired: true, serverPlayerId: "p1", receiverPlayerId: "p4" }
          : { serverPlayerId: "p1", receiverPlayerId: "p4" },
      },
    },
  });
  return {
    ...built,
    courtProjection: court,
    ...overrides,
    canSwitchPositions: overrides.canSwitchPositions ?? true,
    canChangeEnds: overrides.canChangeEnds ?? true,
    canScore: overrides.canScore ?? true,
    canSuspend: overrides.canSuspend ?? true,
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
  it("renders daily summary, filters, compact meta row, status CTA", () => {
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
                matchStatus: "READY_TO_START",
                matchStatusLabel: "Sẵn sàng",
                homeStatusBucket: "UPCOMING",
                homeStatusLabel: "Sắp diễn ra",
                competitionName: "Giải đồng đội 13/8/2026",
                stageName: "KO",
                roundName: "1",
                participantA: "Đội 4",
                participantB: "Đội 3",
                courtLabel: "Sân 1",
                scheduledTime: "17:02",
                action: "ENTER",
                actionLabel: "VÀO TRẬN",
                href: "/referee/match/match-1",
              },
              {
                competitionId: "comp-1",
                matchId: "match-2",
                matchStatus: "IN_PROGRESS",
                homeStatusBucket: "LIVE",
                homeStatusLabel: "Đang thi đấu",
                competitionName: "Giải đồng đội 13/8/2026",
                participantA: "An / Bình",
                participantB: "Chi / Dũng",
                courtLabel: "Sân 2",
                scheduledTime: "18:00",
                action: "CONTINUE",
                actionLabel: "TIẾP TỤC",
                href: "/referee/match/match-2",
              },
            ]}
          />
        </div>
      </MemoryRouter>
    );

    expect(screen.getByTestId("referee-home-header")).toHaveTextContent("Trọng tài của tôi");
    expect(screen.getByTestId("home-daily-headline")).toHaveTextContent("Hôm nay: 2 trận");
    expect(screen.getByTestId("counter-upcoming")).toHaveTextContent("1");
    expect(screen.getByTestId("counter-live")).toHaveTextContent("1");
    expect(screen.getByTestId("home-status-filters")).toBeInTheDocument();
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("filter-upcoming")).toBeInTheDocument();
    expect(screen.getByTestId("filter-live")).toBeInTheDocument();
    expect(screen.getByTestId("filter-done")).toBeInTheDocument();

    const cards = screen.getAllByTestId("referee-assignment-card");
    const card = cards[0];
    expect(within(card).getByTestId("assignment-meta-row")).toBeInTheDocument();
    expect(within(card).getByTestId("meta-court")).toHaveTextContent("Sân 1");
    expect(within(card).getByTestId("meta-time")).toHaveTextContent("17:02");
    expect(within(card).getByTestId("competition-name")).toHaveTextContent("Giải đồng đội 13/8/2026");
    expect(within(card).getByTestId("status-badge")).toHaveTextContent("Sắp diễn ra");
    expect(within(card).getByTestId("participants")).toHaveTextContent("VS");
    expect(within(card).getByTestId("assignment-action")).toHaveTextContent("VÀO TRẬN");
    expect(cards[1]).toHaveTextContent("TIẾP TỤC");
    expect(card.textContent).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
  });

  it("1b. TIẾP TỤC counts as Đang thi đấu even when stale bucket says DONE", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <div style={{ width: 390 }}>
          <RefereeHome
            userLabel="Trọng tài 01"
            assignments={[
              {
                competitionId: "comp-1",
                matchId: "sub-syysofdv",
                matchStatus: "COMPLETED",
                homeStatusBucket: "DONE",
                homeStatusLabel: "Hoàn tất",
                acceptedOfficialResult: true,
                competitionName: "Giải đồng đội 13/8/2026",
                participantA: "Đội 4",
                participantB: "Đội 3",
                courtLabel: "Sân 2",
                scheduledTime: "09:11",
                action: "CONTINUE",
                actionLabel: "TIẾP TỤC",
                href: "/referee/match/sub-syysofdv",
              },
            ]}
          />
        </div>
      </MemoryRouter>
    );

    expect(screen.getByTestId("counter-live")).toHaveTextContent("1");
    expect(screen.getByTestId("counter-done")).toHaveTextContent("0");
    expect(screen.getByTestId("filter-live")).toHaveTextContent("1");
    await user.click(screen.getByTestId("filter-live"));
    expect(screen.getByTestId("assignment-list").querySelectorAll("[data-testid='referee-assignment-card']")).toHaveLength(1);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Đang thi đấu");
    expect(screen.getByTestId("assignment-action")).toHaveTextContent("TIẾP TỤC");
    await user.click(screen.getByTestId("filter-done"));
    expect(screen.getByTestId("referee-home-empty")).toBeInTheDocument();
  });
});

describe("match screen visual states @ ~390px", () => {
  it("2. Side-Out doubles — 4 players, serving, service turn, rules, names", () => {
    const court = doublesCourt(SIDE_OUT);
    render(
      <MemoryRouter>
        <div style={{ width: 390 }}>
          <RefereeMatchScreen view={baseView({ courtProjection: court })} />
        </div>
      </MemoryRouter>
    );

    expect(screen.getByTestId("match-header")).toHaveTextContent("Điều hành trận");
    expect(screen.getByTestId("match-status-badge")).toBeInTheDocument();
    expect(screen.getByTestId("match-context-row")).toHaveTextContent(/Sân 1/);
    expect(screen.getByTestId("match-rules-panel")).toBeInTheDocument();
    expect(screen.getByTestId("rule-method")).toHaveTextContent("SIDE-OUT");
    expect(screen.getByTestId("rule-target")).toHaveTextContent("11");
    expect(screen.getByTestId("rule-winBy")).toHaveTextContent("2");
    expect(screen.getByTestId("rule-cap")).toHaveTextContent("Không");
    expect(screen.getByTestId("rule-changeEnd")).toBeInTheDocument();
    expect(screen.getByTestId("rule-bestOf")).toHaveTextContent("Best of 3");
    expect(screen.getByTestId("canonical-court-view")).toBeInTheDocument();
    expect(screen.getByTestId("court-slot-leftTop")).toHaveTextContent("An");
    expect(screen.getByTestId("court-slot-leftBottom")).toHaveTextContent("Bình");
    expect(screen.getByTestId("court-slot-rightTop")).toHaveTextContent("Chi");
    expect(screen.getByTestId("court-slot-rightBottom")).toHaveTextContent("Dũng");
    expect(screen.getByTestId("serving-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("serving-status-strip")).toBeInTheDocument();
    expect(screen.getByTestId("service-turn")).toHaveTextContent(/Lượt giao/);
    expect(screen.getByTestId("service-turn")).not.toHaveTextContent(/Người giao/);
    expect(screen.getByTestId("service-turn-number")).toHaveTextContent("Lượt 2");
    expect(screen.getByTestId("serving-player-name")).toHaveTextContent("An");
    expect(screen.getByTestId("team-name-a")).toHaveTextContent("Đội 4");
    expect(screen.getByTestId("team-name-b")).toHaveTextContent("Đội 3");
    expect(screen.getByTestId("participant-names-a")).toHaveTextContent(/An/);
    expect(screen.getByTestId("participant-names-b")).toHaveTextContent(/Chi/);
    expect(screen.getByTestId("current-game-score")).toBeInTheDocument();
    expect(screen.getByTestId("games-won")).toHaveTextContent(/0–0/);
    expect(screen.getByTestId("current-game-summary")).toBeInTheDocument();
    expect(screen.queryByTestId("rally-score-line")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-point-a")).toHaveTextContent(/Điểm Đội 4|Điểm An|Đội 4/);
    expect(screen.getByTestId("btn-switch-positions")).toHaveTextContent("Sắp xếp đội hình");
    expect(screen.getByTestId("serve-version")).toHaveTextContent(/Version/);
    expect(screen.getByTestId("btn-back-assignments")).toBeInTheDocument();
    expect(screen.getByTestId("canonical-court-view").querySelector(".rp-court-net")).toBeTruthy();
    expect(screen.getByTestId("canonical-court-view").querySelector(".rp-court-kitchen")).toBeTruthy();
    // Landscape: net is vertical at horizontal center (left/right teams).
    expect(screen.getByTestId("canonical-court-view")).toHaveAttribute("data-testid", "canonical-court-view");
    const markers = screen.getAllByTestId(/player-marker-/);
    markers.forEach((node) => {
      expect(node.textContent).not.toMatch(/#\s*[12]\b/);
    });
  });

  it("3. Rally doubles — two point buttons, no Lượt giao / no ĐỔI GIAO", () => {
    const court = doublesCourt(RALLY, { a: 4, b: 3 });
    const view = baseView({
      courtProjection: court,
      currentScore: { points: { SIDE_A: 4, SIDE_B: 3 }, gamesWon: { SIDE_A: 0, SIDE_B: 0 } },
      isRally: true,
      isSideOut: false,
      canChangeServe: false,
      canPointSideA: true,
      canPointSideB: true,
      servingStatus: {
        servingTeamName: "Đội 4",
        servingPlayerName: "An",
        showServiceTurn: false,
        serviceTurn: null,
        gameLabel: "Game 1 / Best of 1",
      },
      rulesPanel: {
        title: "LUẬT TRẬN",
        rows: [
          { key: "method", label: "Cách tính", value: "RALLY" },
          { key: "target", label: "Kết thúc game", value: "21" },
          { key: "winBy", label: "Thắng cách", value: "2" },
          { key: "cap", label: "Điểm trần / cap", value: "Không" },
          { key: "bestOf", label: "Thể thức", value: "Best of 1" },
        ],
      },
    });
    render(
      <MemoryRouter>
        <RefereeMatchScreen view={view} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("score-a")).toHaveTextContent("4");
    expect(screen.getByTestId("score-b")).toHaveTextContent("3");
    expect(screen.queryByTestId("service-turn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-change-serve")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-point-a")).toBeInTheDocument();
    expect(screen.getByTestId("btn-point-b")).toBeInTheDocument();
    expect(screen.getByTestId("rule-method")).toHaveTextContent("RALLY");
  });

  it("3b. Side-Out shows serving +Điểm and ĐỔI GIAO only", () => {
    const court = doublesCourt(SIDE_OUT, { a: 1, b: 0 });
    const view = baseView({
      courtProjection: court,
      isSideOut: true,
      isRally: false,
      canChangeServe: true,
      canPointSideA: true,
      canPointSideB: false,
      receivingSideNow: "SIDE_B",
      servingSideNow: "SIDE_A",
      servingStatus: {
        servingTeamName: "Đội 4",
        servingPlayerName: "An",
        showServiceTurn: true,
        serviceTurn: 2,
        gameLabel: "1 / Best of 3",
      },
    });
    render(
      <MemoryRouter>
        <RefereeMatchScreen view={view} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("btn-point-a")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-point-b")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-change-serve")).toHaveTextContent("ĐỔI GIAO");
    expect(screen.getByTestId("service-turn")).toHaveTextContent(/Lượt giao/);
  });

  it("3c. Lineup required blocks score until configured", async () => {
    const user = userEvent.setup();
    const court = projectCanonicalCourtView({
      participants: {
        sides: [
          { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội 4" },
          { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội 3" },
        ],
      },
      participantNames: NAMES,
      scoringRules: RALLY,
      currentScore: { points: { SIDE_A: 0, SIDE_B: 0 }, currentGameIndex: 0 },
      courtState: {},
    });
    const onConfigureLineup = vi.fn(async () => ({ ok: true }));
    const view = baseView({
      courtProjection: court,
      lineupRequired: true,
      lineupConfigured: false,
      canScore: false,
      canStart: false,
      servingStatus: {
        servingTeamName: null,
        servingPlayerName: null,
        showServiceTurn: true,
        serviceTurn: null,
        gameLabel: "1 / Best of 1",
      },
    });
    render(
      <MemoryRouter>
        <RefereeMatchScreen view={view} onConfigureLineup={onConfigureLineup} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("lineup-required-banner")).toBeInTheDocument();
    expect(screen.getByTestId("lineup-setup-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-point-a")).not.toBeInTheDocument();
    expect(screen.getByTestId("service-turn")).toHaveTextContent(/Lượt giao/);
    await user.click(screen.getByTestId("btn-lineup-confirm"));
    expect(onConfigureLineup).toHaveBeenCalled();
    const payload = onConfigureLineup.mock.calls[0][0];
    expect(payload.serverPlayerId).toBeTruthy();
    expect([1, 2]).toContain(payload.serverNumber);
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
    render(
      <MemoryRouter>
        <RefereeMatchScreen view={baseView({ courtProjection: court })} />
      </MemoryRouter>
    );
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
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            courtProjection: { ...doublesCourt(), dreambreaker: db, isDreambreaker: true },
          })}
        />
      </MemoryRouter>
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
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            courtProjection: { ...doublesCourt(), dreambreaker: db },
          })}
        />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("dreambreaker-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dreambreaker-fail-closed")).not.toBeInTheDocument();
  });

  it("6+7. change-ends required warning then confirm (ACK path — no visual swap before ACK)", async () => {
    const user = userEvent.setup();
    const onChangeEnds = vi.fn();
    const court = doublesCourt(SIDE_OUT, { sideChangeRequired: true });
    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({ courtProjection: court, canChangeEnds: false })}
          onChangeEnds={onChangeEnds}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("change-ends-warning")).toHaveTextContent("ĐÃ ĐẾN ĐIỂM ĐỔI SÂN");
    expect(screen.getByTestId("change-ends-policy")).toHaveTextContent(/Điểm đổi sân/);
    expect(screen.getByTestId("change-ends-threshold")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-change-ends")).not.toBeInTheDocument();
    expect(screen.getByTestId("canonical-court-view")).toHaveAttribute(
      "data-orientation",
      "STANDARD"
    );
    await user.click(screen.getByTestId("btn-change-ends-required"));
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
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            isSideOut: true,
            canPointSideA: true,
            canPointSideB: false,
            canChangeServe: true,
            servingSideNow: "SIDE_A",
            receivingSideNow: "SIDE_B",
          })}
          pendingAction="point:SIDE_A"
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("pending-banner")).toHaveTextContent("Đang ghi…");
    expect(screen.getByTestId("btn-point-a")).toBeDisabled();
    expect(screen.getByTestId("btn-change-serve")).toBeDisabled();
    expect(screen.queryByTestId("btn-point-b")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-point-a")).toHaveTextContent("Đang ghi…");
  });

  it("9. stale/reconcile fail-closed", () => {
    const onReload = vi.fn();
    render(
      <MemoryRouter>
        <RefereeMatchScreen view={baseView()} stale onReload={onReload} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("stale-banner")).toBeInTheDocument();
    expect(screen.getByTestId("btn-point-a")).toBeDisabled();
    expect(screen.getByTestId("btn-reconcile")).toBeInTheDocument();
  });

  it("10. capability-driven controls + completion/result state", () => {
    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            canSuspend: true,
            canResume: false,
            canCorrect: true,
            canComplete: true,
            canSwitchPositions: true,
            canChangeEnds: true,
            resultStatus: "PENDING_ACCEPTANCE",
            resultStatusLabel: "Đã tính tỷ số — chờ CORE-17 chấp nhận",
            acceptedOfficialResult: false,
          })}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("btn-suspend")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-resume")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-correct")).toHaveTextContent(/Sửa/);
    expect(screen.getByTestId("btn-complete")).toHaveTextContent("KẾT THÚC TRẬN");
    expect(screen.getByTestId("result-status")).toHaveTextContent(/CORE-17/);
  });

  it("mobile court stays compact with pickleball geometry", () => {
    const { container } = render(
      <div style={{ width: 390 }}>
        <CanonicalCourtView courtProjection={doublesCourt()} />
      </div>
    );
    const court = container.querySelector(".rp-court");
    expect(court).toBeTruthy();
    expect(court.querySelector(".rp-court-net")).toBeTruthy();
    expect(court.querySelector(".rp-court-kitchen")).toBeTruthy();
    expect(court.querySelector(".rp-court-baseline")).toBeTruthy();
    expect(court.querySelector(".rp-court-sideline")).toBeTruthy();
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

describe("remediation05: referee account / nav chrome", () => {
  it("shows account menu trigger, drawer nav, and logout control", async () => {
    const user = userEvent.setup();
    mockSignOut.mockClear();
    render(
      <MemoryRouter>
        <RefereeCompactChrome title="Trọng tài của tôi" />
      </MemoryRouter>
    );
    expect(screen.getByTestId("referee-compact-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("referee-account-menu-trigger")).toBeInTheDocument();
    await user.click(screen.getByTestId("referee-chrome-menu"));
    expect(await screen.findByTestId("referee-nav-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("referee-nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("referee-nav-assignments")).toBeInTheDocument();
    expect(screen.getByTestId("referee-nav-account")).toBeInTheDocument();
    expect(screen.getByTestId("referee-nav-logout")).toBeInTheDocument();
    await user.click(screen.getByTestId("referee-account-menu-trigger"));
    expect(await screen.findByTestId("referee-account-profile")).toBeInTheDocument();
    expect(screen.getByTestId("referee-account-logout")).toBeInTheDocument();
  });
});
