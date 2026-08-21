/**
 * Screenshot-oriented / mobile viewport visual contracts for Phase 2C remediation.
 * Deterministic fixtures only — no production mock runtime fallback.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
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
        serve: {
          servingSide: "SIDE_A",
          serverNumber: 2,
          serverPlayerId: "p1",
          receiverPlayerId: "p4",
        },
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
    courtState: {
      serverPlayerId: "p1",
      receiverPlayerId: "p4",
      sideChangeRequired: court.sideChangeRequired === true,
    },
  });
  return {
    ...built,
    courtProjection: court,
    servingStatus: {
      ...built.servingStatus,
      servingPlayerName:
        court.serving?.serverPlayerId && NAMES[court.serving.serverPlayerId]
          ? NAMES[court.serving.serverPlayerId]
          : built.servingStatus?.servingPlayerName,
      receivingPlayerName:
        court.serving?.receiverPlayerId && NAMES[court.serving.receiverPlayerId]
          ? NAMES[court.serving.receiverPlayerId]
          : built.servingStatus?.receivingPlayerName,
      serviceTurn: built.servingStatus?.serviceTurn ?? court.serving?.serviceTurn ?? 2,
      showServiceTurn: built.isSideOut === true,
    },
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
  const TODAY = new Date("2026-08-17T12:00:00+07:00");
  const todayIso = "2026-08-17T10:00:00+07:00";

  it("renders daily summary, filters, compact meta row, status CTA", () => {
    render(
      <MemoryRouter>
        <div style={{ width: 390 }}>
          <RefereeHome
            userLabel="Phong"
            now={TODAY}
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
                scheduledTimeRaw: todayIso,
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
                scheduledTimeRaw: todayIso,
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
    expect(screen.getByTestId("home-date-range")).toBeInTheDocument();
    expect(screen.getByTestId("home-date-from")).toHaveValue("2026-08-17");
    expect(screen.getByTestId("home-date-to")).toHaveValue("2026-08-17");
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
            now={TODAY}
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
                scheduledTimeRaw: todayIso,
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

  it("1c. date range excludes historical days from Hôm nay; empty today stays 0", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RefereeHome
          userLabel="Phong"
          now={TODAY}
          assignments={[
            {
              competitionId: "comp-1",
              matchId: "hist-12",
              matchStatus: "COMPLETED",
              action: "VIEW_RESULT",
              competitionName: "Giải 12/8",
              participantA: "A",
              participantB: "B",
              courtLabel: "Sân 1",
              scheduledTime: "09:00",
              scheduledTimeRaw: "2026-08-12T09:00:00+07:00",
              href: "/referee/match/hist-12",
            },
            {
              competitionId: "comp-1",
              matchId: "hist-13",
              matchStatus: "READY_TO_START",
              action: "ENTER",
              competitionName: "Giải 13/8",
              participantA: "C",
              participantB: "D",
              courtLabel: "Sân 2",
              scheduledTime: "10:00",
              scheduledTimeRaw: "2026-08-13T10:00:00+07:00",
              href: "/referee/match/hist-13",
            },
            {
              competitionId: "comp-1",
              matchId: "undated-1",
              matchStatus: "READY_TO_START",
              action: "ENTER",
              competitionName: "Chưa ngày",
              participantA: "E",
              participantB: "F",
              courtLabel: "Sân 3",
              href: "/referee/match/undated-1",
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("home-daily-headline")).toHaveTextContent("Hôm nay: 0 trận");
    expect(screen.getByTestId("referee-home-empty")).toHaveTextContent(
      "Chưa có trận được phân công trong ngày hôm nay."
    );
    expect(screen.getByTestId("home-undated-note")).toHaveTextContent(/1 trận chưa xác định ngày/);

    fireEvent.change(screen.getByTestId("home-date-from"), {
      target: { value: "2026-08-13" },
    });
    fireEvent.change(screen.getByTestId("home-date-to"), {
      target: { value: "2026-08-13" },
    });
    expect(screen.getByTestId("home-daily-headline")).toHaveTextContent("Ngày 13/08/2026: 1 trận");
    expect(screen.getAllByTestId("referee-assignment-card")).toHaveLength(1);

    fireEvent.change(screen.getByTestId("home-date-from"), {
      target: { value: "2026-08-12" },
    });
    fireEvent.change(screen.getByTestId("home-date-to"), {
      target: { value: "2026-08-13" },
    });
    expect(screen.getByTestId("home-daily-headline")).toHaveTextContent(
      "12/08/2026 – 13/08/2026: 2 trận"
    );
    expect(screen.getAllByTestId("referee-assignment-card")).toHaveLength(2);

    await user.click(screen.getByTestId("filter-done"));
    expect(screen.getAllByTestId("referee-assignment-card")).toHaveLength(1);
    expect(screen.getByTestId("filter-done")).toHaveTextContent("1");
    expect(screen.getByTestId("filter-upcoming")).toHaveTextContent("1");
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
    expect(screen.getByTestId("change-ends-warning")).toHaveTextContent("ĐÃ ĐẾN ĐIỂM ĐỔI ĐẦU SÂN");
    expect(screen.getByTestId("change-ends-policy")).toHaveTextContent(/Điểm đổi đầu sân/);
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

  it("7c. scoreboard + point buttons follow physical ends after confirmChangeEnds ACK", async () => {
    const user = userEvent.setup();
    const onPointA = vi.fn();
    const onPointB = vi.fn();
    const before = doublesCourt(RALLY, { a: 11, b: 5 });
    const after = doublesCourt(RALLY, { a: 11, b: 5, swapped: true });

    const { rerender } = render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            courtProjection: before,
            currentScore: { points: { SIDE_A: 11, SIDE_B: 5 } },
            isRally: true,
            isSideOut: false,
            canPointSideA: true,
            canPointSideB: true,
            canChangeServe: false,
          })}
          onPointA={onPointA}
          onPointB={onPointB}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("scoreboard")).toHaveAttribute("data-orientation", "STANDARD");
    expect(screen.getByTestId("team-name-a")).toHaveTextContent("Đội 4");
    expect(screen.getByTestId("team-name-b")).toHaveTextContent("Đội 3");
    expect(screen.getByTestId("score-a")).toHaveTextContent("11");
    expect(screen.getByTestId("score-b")).toHaveTextContent("5");
    expect(screen.getByTestId("court-slot-leftTop")).toHaveTextContent("An");
    expect(screen.getByTestId("btn-point-a")).toHaveAttribute("data-display-end", "left");
    expect(screen.getByTestId("btn-point-a")).toHaveAttribute("data-scoring-side", "SIDE_A");
    expect(screen.getByTestId("btn-point-a")).toHaveTextContent(/Đội 4/);
    expect(screen.getByTestId("btn-point-b")).toHaveAttribute("data-display-end", "right");

    rerender(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            courtProjection: after,
            currentScore: { points: { SIDE_A: 11, SIDE_B: 5 } },
            isRally: true,
            isSideOut: false,
            canPointSideA: true,
            canPointSideB: true,
            canChangeServe: false,
          })}
          onPointA={onPointA}
          onPointB={onPointB}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("scoreboard")).toHaveAttribute("data-orientation", "SWAPPED");
    expect(screen.getByTestId("canonical-court-view")).toHaveAttribute(
      "data-orientation",
      "SWAPPED"
    );
    // LEFT = Team B (5), RIGHT = Team A (11)
    expect(screen.getByTestId("team-name-a")).toHaveTextContent("Đội 3");
    expect(screen.getByTestId("team-name-b")).toHaveTextContent("Đội 4");
    expect(screen.getByTestId("score-a")).toHaveTextContent("5");
    expect(screen.getByTestId("score-b")).toHaveTextContent("11");
    expect(screen.getByTestId("participant-names-a")).toHaveTextContent(/Chi/);
    expect(screen.getByTestId("participant-names-b")).toHaveTextContent(/An/);
    expect(screen.getByTestId("court-slot-leftTop")).toHaveTextContent("Chi");
    expect(screen.getByTestId("court-slot-rightTop")).toHaveTextContent("An");
    expect(screen.getByTestId("serving-indicator").closest("[data-testid^='player-marker-']")).toHaveAttribute(
      "data-testid",
      "player-marker-p1"
    );

    const leftBtn = screen.getByTestId("btn-point-b");
    expect(leftBtn).toHaveAttribute("data-display-end", "left");
    expect(leftBtn).toHaveAttribute("data-scoring-side", "SIDE_B");
    expect(leftBtn).toHaveTextContent(/Đội 3/);
    const rightBtn = screen.getByTestId("btn-point-a");
    expect(rightBtn).toHaveAttribute("data-display-end", "right");
    expect(rightBtn).toHaveAttribute("data-scoring-side", "SIDE_A");
    expect(rightBtn).toHaveTextContent(/Đội 4/);

    await user.click(leftBtn);
    expect(onPointB).toHaveBeenCalledTimes(1);
    expect(onPointA).not.toHaveBeenCalled();
    await user.click(rightBtn);
    expect(onPointA).toHaveBeenCalledTimes(1);
  });

  it("8. pending score disables conflicting controls and shows Đang xác nhận...", () => {
    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            isSideOut: true,
            canPointSideA: true,
            canPointSideB: false,
            canChangeServe: true,
            canUndo: true,
            servingSideNow: "SIDE_A",
            receivingSideNow: "SIDE_B",
          })}
          pendingAction="point:SIDE_A"
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("pending-banner")).toHaveTextContent("Đang xác nhận...");
    expect(screen.getByTestId("score-pending-hint")).toHaveTextContent("Đang xác nhận...");
    expect(screen.getByTestId("btn-point-a")).toBeDisabled();
    expect(screen.getByTestId("btn-change-serve")).toBeDisabled();
    expect(screen.getByTestId("btn-undo-last-scoring-action")).toBeDisabled();
    expect(screen.queryByTestId("btn-point-b")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-point-a")).toHaveTextContent("Đang xác nhận...");
  });

  it("8c. undo button uses Vietnamese restore label and pending Đang hoàn tác...", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            canScore: true,
            canUndo: true,
            undoAvailability: { undoAvailable: true, reasonCode: null },
          })}
          onUndoLastScoringAction={onUndo}
        />
      </MemoryRouter>
    );
    const undoBtn = screen.getByTestId("btn-undo-last-scoring-action");
    expect(undoBtn).toHaveTextContent("↶ Hoàn tác lần ghi gần nhất");
    expect(undoBtn).not.toHaveTextContent(/- Điểm|Giảm điểm/);
    expect(undoBtn).not.toBeDisabled();
    await user.click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);

    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            canScore: true,
            canUndo: true,
            undoAvailability: { undoAvailable: true, reasonCode: null },
          })}
          pendingAction="undo"
          onUndoLastScoringAction={onUndo}
        />
      </MemoryRouter>
    );
    expect(screen.getAllByTestId("btn-undo-last-scoring-action")[1]).toHaveTextContent(
      "Đang hoàn tác..."
    );
    expect(screen.getAllByTestId("btn-undo-last-scoring-action")[1]).toBeDisabled();
  });

  it("8d. undo disabled when server eligibility is false", () => {
    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            canScore: true,
            canUndo: false,
            undoAvailability: {
              undoAvailable: false,
              reasonCode: "FAIL_CLOSED_UNSUPPORTED_FOR_QUICK_UNDO",
              message: "Quick undo rejected after confirmChangeEnds ACK (v1)",
            },
          })}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("btn-undo-last-scoring-action")).toBeDisabled();
    expect(screen.getByTestId("btn-undo-last-scoring-action")).toHaveTextContent(
      "↶ Hoàn tác lần ghi gần nhất"
    );
  });

  it("8b. optimistic change-end warning does not enable confirm before ACK", () => {
    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            isOptimisticPresentation: true,
            changeEndConfirmBlocked: true,
            courtProjection: doublesCourt(SIDE_OUT, { sideChangeRequired: true }),
          })}
          pendingAction="point:SIDE_A"
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("change-ends-warning")).toHaveTextContent(
      /Đang chờ máy chủ xác nhận/
    );
    expect(screen.getByTestId("btn-change-ends-required")).toBeDisabled();
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

describe("UI lock reconciliation — home filters + console layout", () => {
  const TODAY = new Date("2026-08-17T12:00:00+07:00");
  const todayIso = "2026-08-17T10:00:00+07:00";

  const sampleAssignments = [
    {
      competitionId: "comp-internal",
      matchId: "m-1",
      competitionMode: "INTERNAL",
      competitionModeLabel: "Giải nội bộ",
      matchStatus: "READY_TO_START",
      competitionName: "Giải nội bộ CLB A",
      participantA: "An / Bình",
      participantAEntryLabel: "Đội 9",
      participantAMemberLine: "An / Bình",
      participantB: "Chi / Dũng",
      participantBEntryLabel: "Đội 10",
      participantBMemberLine: "Chi / Dũng",
      courtLabel: "TT412 Sân 1",
      scheduledTime: "10:00",
      scheduledTimeRaw: todayIso,
      action: "ENTER",
      actionLabel: "VÀO TRẬN",
      href: "/referee/match/m-1",
    },
    {
      competitionId: "comp-team",
      matchId: "m-2",
      competitionMode: "TEAM",
      competitionModeLabel: "Giải đồng đội",
      matchStatus: "IN_PROGRESS",
      competitionName: "Giải đồng đội 13/8/2026",
      participantA: "Lan / Minh",
      participantB: "Hà / Nam",
      courtLabel: "Sân 2",
      scheduledTime: "11:00",
      scheduledTimeRaw: todayIso,
      action: "CONTINUE",
      actionLabel: "TIẾP TỤC",
      href: "/referee/match/m-2",
    },
  ];

  it("tournament + mode + status filters combine without mutating authority", async () => {
    const user = userEvent.setup();
    const frozen = structuredClone(sampleAssignments);
    render(
      <MemoryRouter>
        <RefereeHome userLabel="Phong" now={TODAY} assignments={sampleAssignments} />
      </MemoryRouter>
    );

    expect(screen.getByTestId("home-tournament-filter")).toBeInTheDocument();
    expect(screen.getByTestId("home-mode-filter")).toBeInTheDocument();
    expect(screen.getAllByTestId("referee-assignment-card")).toHaveLength(2);

    await user.selectOptions(screen.getByTestId("home-tournament-filter"), "comp-internal");
    expect(screen.getAllByTestId("referee-assignment-card")).toHaveLength(1);
    expect(screen.getByTestId("competition-name")).toHaveTextContent("Giải nội bộ CLB A");
    expect(screen.getByTestId("meta-court")).toHaveTextContent("TT412 Sân 1");
    expect(screen.getByTestId("participant-a-entry")).toHaveTextContent("Đội 9");
    expect(screen.getByTestId("participant-a-members")).toHaveTextContent("An / Bình");

    await user.selectOptions(screen.getByTestId("home-tournament-filter"), "ALL");
    await user.selectOptions(screen.getByTestId("home-mode-filter"), "TEAM");
    expect(screen.getAllByTestId("referee-assignment-card")).toHaveLength(1);
    expect(screen.getByTestId("competition-name")).toHaveTextContent("Giải đồng đội");

    await user.click(screen.getByTestId("filter-live"));
    expect(screen.getAllByTestId("referee-assignment-card")).toHaveLength(1);

    expect(sampleAssignments).toEqual(frozen);
  });

  it("match console exposes 3 zones, receiver, history, đổi đầu sân wording", () => {
    render(
      <MemoryRouter>
        <div style={{ width: 1440 }}>
          <RefereeMatchScreen view={baseView({ canChangeEnds: true, canSuspend: true })} />
        </div>
      </MemoryRouter>
    );

    expect(screen.getByTestId("referee-console-layout")).toBeInTheDocument();
    expect(screen.getByTestId("console-zone-context")).toBeInTheDocument();
    expect(screen.getByTestId("console-zone-score")).toBeInTheDocument();
    expect(screen.getByTestId("console-zone-tools")).toBeInTheDocument();
    expect(screen.getByTestId("side-identity-a-entry")).toBeInTheDocument();
    expect(screen.getByTestId("side-identity-a-athletes")).toBeInTheDocument();
    expect(screen.getByTestId("receiving-player-name")).toHaveTextContent("Dũng");
    expect(screen.getByTestId("serving-player-name")).toHaveTextContent("An");
    expect(screen.getByTestId("match-operation-history")).toBeInTheDocument();
    expect(screen.getByTestId("btn-change-ends")).toHaveTextContent("Đổi đầu sân");
    expect(screen.queryByText(/ĐỔI SÂN \/ ĐỔI ĐẦU SÂN/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-change-court")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/CHANGE_COURT/);
  });

  it("unsupported footer actions are hidden (not fake-enabled)", () => {
    render(
      <MemoryRouter>
        <RefereeMatchScreen
          view={baseView({
            canSuspend: false,
            canResume: false,
            canCorrect: false,
            canComplete: false,
          })}
        />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("btn-suspend")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-correct")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-complete")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-footer-back")).toBeInTheDocument();
  });
});
