import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import RefereeV5Workspace from "../../src/features/referee-v5/components/RefereeV5Workspace.jsx";
import RefereeV5PreviewPage from "../../src/pages/dev/RefereeV5PreviewPage.jsx";
import { SERVE_DIRECTION } from "../../src/features/referee-v5/selectors/serveContextSelector.js";
import { dispatchMatchCommand } from "../../src/features/referee-v5/engines/matchCommandDispatcher.js";
import { MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { rebuildMatchState } from "../../src/features/referee-v5/engines/stateReplayEngine.js";
import { buildDoublesSideOutConfig } from "../referee-v5/testHelpers.js";
import { isRefereeV5Enabled } from "../../src/features/referee-v5/flags.js";
import { buildArrowGeometry } from "../../src/features/referee-v5/selectors/serveArrowSelector.js";
import { buildServeContext } from "../../src/features/referee-v5/selectors/scoreboardSelector.js";
import { RALLY_VARIANT } from "../../src/features/referee-v5/constants/scoringFormats.js";

vi.mock("../../src/features/referee-v5/hooks/useRefereeMatchController.js", async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

function renderWorkspace(fixtureId = "doubles-server-1") {
  return render(<RefereeV5Workspace initialFixtureId={fixtureId} showPrototypeBadge />);
}

describe("Referee V5-C Court Visualizer", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_REFEREE_V5_ENABLED", "true");
  });

  it("1 displays four players in doubles", () => {
    renderWorkspace("doubles-server-1");
    expect(screen.getByTestId("player-slot-A")).toBeInTheDocument();
    expect(screen.getByTestId("player-slot-B")).toBeInTheDocument();
    expect(screen.getByTestId("player-slot-C")).toBeInTheDocument();
    expect(screen.getByTestId("player-slot-D")).toBeInTheDocument();
  });

  it("2 displays two players in singles", () => {
    renderWorkspace("singles-even");
    expect(screen.getByTestId("player-slot-P1")).toBeInTheDocument();
    expect(screen.getByTestId("player-slot-P2")).toBeInTheDocument();
    expect(screen.queryByTestId("player-slot-A")).not.toBeInTheDocument();
  });

  it("3 marks server correctly", () => {
    renderWorkspace("doubles-server-1");
    expect(within(screen.getByTestId("player-slot-A")).getByLabelText(/Đang giao/i)).toBeInTheDocument();
  });

  it("4 marks receiver correctly", () => {
    renderWorkspace("doubles-server-1");
    expect(within(screen.getByTestId("player-slot-D")).getByLabelText(/Đỡ bóng/i)).toBeInTheDocument();
  });

  it("5 displays server number", () => {
    renderWorkspace("doubles-server-1");
    expect(screen.getByTestId("serve-context-server-number")).toHaveTextContent("1");
  });

  it("6 draws NEAR_RIGHT_TO_FAR_LEFT arrow", () => {
    renderWorkspace("doubles-server-1");
    const arrow = screen.getByTestId("serve-direction-arrow");
    expect(arrow).toHaveAttribute("data-serve-direction", SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT);
  });

  it("7 draws NEAR_LEFT after serving team point", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(screen.getByTestId("serve-direction-arrow")).toHaveAttribute(
      "data-serve-direction",
      SERVE_DIRECTION.NEAR_LEFT_TO_FAR_RIGHT
    );
  });

  it("8 draws FAR_RIGHT when far-end serving fixture", () => {
    renderWorkspace("far-end-serving");
    expect(screen.getByTestId("serve-direction-arrow")).toHaveAttribute(
      "data-serve-direction",
      SERVE_DIRECTION.FAR_RIGHT_TO_NEAR_LEFT
    );
  });

  it("9 draws FAR_LEFT for far-left server setup", () => {
    const init = initializeMatchState(buildDoublesSideOutConfig({ firstServingPlayerId: "C", firstServingTeamId: "team-b" }));
    const ctx = buildServeContext({
      ...init.state,
      status: "in_progress",
      servingPlayerId: "C",
      servingTeamId: "team-b",
      receivingPlayerId: "B",
      receivingTeamId: "team-a",
      serverNumber: 1,
    });
    const arrow = buildArrowGeometry(ctx);
    expect(arrow.serveDirection).toBe(SERVE_DIRECTION.FAR_LEFT_TO_NEAR_RIGHT);
    expect(arrow.isDiagonal).toBe(true);
  });

  it("10 arrow is diagonal not straight", () => {
    renderWorkspace("doubles-server-1");
    expect(screen.getByTestId("serve-direction-arrow")).toHaveAttribute("data-is-diagonal", "true");
  });

  it("11 team A rally button dispatches command", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(screen.getByTestId("score-team-a")).toHaveTextContent("1");
  });

  it("12 team B rally button dispatches command", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-team-b-won-rally"));
    expect(screen.getByTestId("serve-context-server-number")).toHaveTextContent("2");
  });

  it("13 UI routes commands through dispatchMatchCommand", async () => {
    const user = userEvent.setup();
    const dispatcher = await import("../../src/features/referee-v5/engines/matchCommandDispatcher.js");
    const spy = vi.spyOn(dispatcher, "dispatchMatchCommand");
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("14 server 2 fixture shows server 2", () => {
    renderWorkspace("doubles-server-2");
    expect(screen.getByTestId("serve-context-server-number")).toHaveTextContent("2");
    expect(within(screen.getByTestId("player-slot-B")).getByLabelText(/Đang giao/i)).toBeInTheDocument();
  });

  it("15 side-out shows new serving team", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-2");
    await user.click(screen.getByTestId("btn-team-b-won-rally"));
    expect(screen.getByTestId("serve-context-server-number")).toHaveTextContent("1");
    expect(within(screen.getByTestId("player-slot-D")).getByLabelText(/Đang giao/i)).toBeInTheDocument();
  });

  it("16 serving team point switches partner sides", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(screen.getByTestId("serve-context-receiver")).toHaveTextContent("Lê Văn C");
  });

  it("17 receiver updates when server switches logical side", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    expect(screen.getByTestId("serve-context-receiver")).toHaveTextContent("Phạm Văn D");
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(screen.getByTestId("serve-context-receiver")).toHaveTextContent("Lê Văn C");
  });

  it("18 switch ends swaps teams on screen", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-switch-ends"));
    await user.click(screen.getByTestId("referee-confirm-action"));
    expect(screen.getByTestId("player-slot-A")).toHaveAttribute(
      "data-screen-position",
      "SCREEN_TOP_LEFT"
    );
  });

  it("19 switch ends preserves server and receiver identities", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    const serverBefore = screen.getByTestId("serve-context-server").textContent;
    const receiverBefore = screen.getByTestId("serve-context-receiver").textContent;
    await user.click(screen.getByTestId("btn-switch-ends"));
    await user.click(screen.getByTestId("referee-confirm-action"));
    expect(screen.getByTestId("serve-context-server")).toHaveTextContent(serverBefore);
    expect(screen.getByTestId("serve-context-receiver")).toHaveTextContent(receiverBefore);
  });

  it("20 undo restores screen state", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(screen.getByTestId("score-team-a")).toHaveTextContent("1");
    await user.click(screen.getByTestId("btn-undo"));
    expect(screen.getByTestId("score-team-a")).toHaveTextContent("0");
  });

  it("21 mobile 360px layout has no horizontal overflow", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 360 });
    const { container } = renderWorkspace("doubles-server-1");
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1);
  });

  it("22 serve/receive labels visible", () => {
    renderWorkspace("doubles-server-1");
    expect(within(screen.getByTestId("player-slot-A")).getByText(/ĐANG GIAO/i)).toBeVisible();
    expect(within(screen.getByTestId("player-slot-D")).getByText(/ĐỠ BÓNG/i)).toBeVisible();
  });

  it("23 rally buttons do not overlap", () => {
    renderWorkspace("doubles-server-1");
    const a = screen.getByTestId("btn-team-a-won-rally").getBoundingClientRect();
    const b = screen.getByTestId("btn-team-b-won-rally").getBoundingClientRect();
    expect(a.top).toBe(b.top);
    expect(a.right).toBeLessThanOrEqual(b.left + 1);
  });

  it("24 arrow visible on mobile", () => {
    renderWorkspace("doubles-server-1");
    expect(screen.getByTestId("serve-direction-arrow")).toBeVisible();
  });

  it("25 timeline does not hide action panel", () => {
    renderWorkspace("doubles-server-1");
    expect(screen.getByTestId("match-event-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("referee-action-panel")).toBeVisible();
  });

  it("26 controller handles three-rally chain", () => {
    const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
    let state = initial;
    let history = [];
    const start = {
      eventId: "s",
      eventType: MATCH_EVENT_TYPE.START_MATCH,
      sequence: 1,
      expectedVersion: 0,
      actorId: "ref",
      payload: {},
    };
    let result = dispatchMatchCommand({ state, command: start, history, initialState: initial });
    state = result.nextState;
    history = result.eventHistory;

    for (const eventType of [
      MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
      MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    ]) {
      const command = {
        eventId: eventType,
        eventType,
        sequence: state.lastEventSequence + 1,
        expectedVersion: state.version,
        actorId: "ref",
        payload: {},
      };
      result = dispatchMatchCommand({ state, command, history, initialState: initial });
      expect(result.ok).toBe(true);
      state = result.nextState;
      history = result.eventHistory;
    }
    expect(state.teams.teamA.score).toBe(1);
  });

  it("27 server1-server2-sideout sequence", () => {
    const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
    let state = initial;
    let history = [];
    const events = [MATCH_EVENT_TYPE.START_MATCH, MATCH_EVENT_TYPE.TEAM_B_WON_RALLY, MATCH_EVENT_TYPE.TEAM_B_WON_RALLY];
    for (const eventType of events) {
      const command = {
        eventId: eventType,
        eventType,
        sequence: state.lastEventSequence + 1,
        expectedVersion: state.version,
        actorId: "ref",
        payload: {},
      };
      const result = dispatchMatchCommand({ state, command, history, initialState: initial });
      state = result.nextState;
      history = result.eventHistory;
    }
    expect(state.serverNumber).toBe(1);
    expect(state.servingPlayerId).toBe("D");
  });

  it("28 point switch receiver change in UI", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(screen.getByTestId("timeline-PLAYERS_SWITCHED")).toBeInTheDocument();
  });

  it("29 switch ends reverses arrow in UI", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    const before = screen.getByTestId("serve-direction-arrow").getAttribute("data-serve-direction");
    await user.click(screen.getByTestId("btn-switch-ends"));
    await user.click(screen.getByTestId("referee-confirm-action"));
    const after = screen.getByTestId("serve-direction-arrow").getAttribute("data-serve-direction");
    expect(after).not.toBe(before);
  });

  it("30 undo after switch ends in UI", async () => {
    const user = userEvent.setup();
    renderWorkspace("doubles-server-1");
    await user.click(screen.getByTestId("btn-switch-ends"));
    await user.click(screen.getByTestId("referee-confirm-action"));
    await user.click(screen.getByTestId("btn-undo"));
    expect(screen.getByTestId("serve-direction-arrow")).toHaveAttribute(
      "data-serve-direction",
      SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT
    );
  });

  it("31 rebuild from history matches state", () => {
    const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
    const events = [
      {
        eventId: "e1",
        eventType: MATCH_EVENT_TYPE.START_MATCH,
        sequence: 1,
        expectedVersion: 0,
        actorId: "ref",
        payload: {},
      },
      {
        eventId: "e2",
        eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
        sequence: 2,
        expectedVersion: 1,
        actorId: "ref",
        payload: {},
      },
    ];
    const rebuilt = rebuildMatchState(initial, events);
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.state.teams.teamA.score).toBe(1);
  });

  it("32 unsupported MLP config rejected", () => {
    const result = initializeMatchState({
      ...buildDoublesSideOutConfig(),
      scoringFormat: "rally",
      rallyVariant: RALLY_VARIANT.MLP,
    });
    expect(result.ok).toBe(false);
  });

  it("33 feature flag off hides prototype workspace", () => {
    vi.stubEnv("VITE_REFEREE_V5_ENABLED", "false");
    render(<RefereeV5PreviewPage />);
    expect(screen.getByText(/Feature flag đang tắt/i)).toBeInTheDocument();
    expect(isRefereeV5Enabled()).toBe(false);
    vi.stubEnv("VITE_REFEREE_V5_ENABLED", "true");
  });

  it("34 legacy referee routes remain registered", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = path.dirname(fileURLToPath(import.meta.url));
    const routerSource = fs.readFileSync(path.join(root, "../../src/router.jsx"), "utf8");
    expect(routerSource).toContain('path="/referee/:token"');
    expect(routerSource).toContain('path="/referee/match/:matchId"');
  });

  it("35 singles shows no server number label", () => {
    renderWorkspace("singles-even");
    expect(screen.queryByTestId("serve-context-server-number")).not.toBeInTheDocument();
  });
});

describe("Referee V5-C route shell", () => {
  it("renders preview page behind memory router", () => {
    vi.stubEnv("VITE_REFEREE_V5_ENABLED", "true");
    render(
      <MemoryRouter initialEntries={["/dev/referee-v5"]}>
        <Routes>
          <Route path="/dev/referee-v5" element={<RefereeV5PreviewPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("referee-v5-workspace")).toBeInTheDocument();
  });
});
