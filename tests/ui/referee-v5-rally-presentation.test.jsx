import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RefereeV5Workspace from "../../src/features/referee-v5/components/RefereeV5Workspace.jsx";
import { SERVE_DIRECTION } from "../../src/features/referee-v5/selectors/serveContextSelector.js";
import { buildPresentationModel } from "../../src/features/referee-v5/selectors/presentationSelector.js";
import { useCourtVisualizerState } from "../../src/features/referee-v5/hooks/useCourtVisualizerState.js";
import { initStartedUsapRallyMatch } from "../referee-v5/testHelpers.js";
import { buildDoublesSideOutConfig, initStartedMatch } from "../referee-v5/testHelpers.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { applyMatchEvent } from "../../src/features/referee-v5/engines/matchStateEngine.js";
import { MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";

vi.mock("../../src/features/referee-v5/hooks/useRefereeMatchController.js", async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

function renderRallyWorkspace(fixtureId = "doubles-usap-rally") {
  return render(<RefereeV5Workspace initialFixtureId={fixtureId} showPrototypeBadge />);
}

describe("Referee V5-R2-2B Rally Doubles presentation", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_REFEREE_V5_ENABLED", "true");
  });

  it("1 rally hides Server 1/2 indicators", () => {
    renderRallyWorkspace();
    expect(screen.queryByTestId("serve-context-server-number")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("player-slot-A")).queryByText(/S1|S2/)).not.toBeInTheDocument();
  });

  it("2 side-out still shows Server 1/2", () => {
    renderRallyWorkspace("doubles-server-1");
    expect(screen.getByTestId("serve-context-server-number")).toHaveTextContent("1");
    expect(within(screen.getByTestId("player-slot-A")).getByText(/S1/)).toBeInTheDocument();
  });

  it("3 rally serverNumber null does not render raw text", () => {
    renderRallyWorkspace();
    const line = screen.getByTestId("side-out-line");
    expect(line.textContent).not.toMatch(/null|undefined|—/i);
    expect(line.textContent).toMatch(/^0 – 0/);
  });

  it("4 rally serving player badge is correct", () => {
    renderRallyWorkspace();
    expect(within(screen.getByTestId("player-slot-A")).getByLabelText(/Đang giao/i)).toBeInTheDocument();
    expect(screen.getByTestId("serve-context-server")).toHaveTextContent("Nguyễn Văn A");
  });

  it("5 rally receiving player badge is correct", () => {
    renderRallyWorkspace();
    expect(within(screen.getByTestId("player-slot-D")).getByLabelText(/Đỡ bóng/i)).toBeInTheDocument();
    expect(screen.getByTestId("serve-context-receiver")).toHaveTextContent("Phạm Văn D");
  });

  it("6 rally player positions are correct", () => {
    renderRallyWorkspace();
    expect(screen.getByTestId("player-slot-A")).toHaveAttribute(
      "data-screen-position",
      "SCREEN_BOTTOM_RIGHT"
    );
    expect(screen.getByTestId("player-slot-B")).toHaveAttribute(
      "data-screen-position",
      "SCREEN_BOTTOM_LEFT"
    );
    expect(screen.getByTestId("player-slot-C")).toHaveAttribute(
      "data-screen-position",
      "SCREEN_TOP_RIGHT"
    );
    expect(screen.getByTestId("player-slot-D")).toHaveAttribute(
      "data-screen-position",
      "SCREEN_TOP_LEFT"
    );
  });

  it("7 rally serve arrow is correct", () => {
    renderRallyWorkspace();
    expect(screen.getByTestId("serve-direction-arrow")).toHaveAttribute(
      "data-serve-direction",
      SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT
    );
  });

  it("8 rally score updates after a rally", async () => {
    const user = userEvent.setup();
    renderRallyWorkspace();
    await user.click(screen.getByTestId("btn-team-a-won-rally"));
    expect(screen.getByTestId("score-team-a")).toHaveTextContent("1");
    expect(screen.getByTestId("side-out-line")).toHaveTextContent("1 – 0");
  });

  it("9 rally service possession changes correctly", async () => {
    const user = userEvent.setup();
    renderRallyWorkspace();
    await user.click(screen.getByTestId("btn-team-b-won-rally"));
    expect(screen.getByTestId("score-team-b")).toHaveTextContent("1");
    expect(within(screen.getByTestId("player-slot-C")).getByLabelText(/Đang giao/i)).toBeInTheDocument();
    expect(screen.getByTestId("serve-context-server")).toHaveTextContent("Lê Văn C");
    expect(screen.queryByTestId("serve-context-server-number")).not.toBeInTheDocument();
  });

  it("10 rally switch ends preserves identities and reverses court display", async () => {
    const user = userEvent.setup();
    renderRallyWorkspace();
    const serverBefore = screen.getByTestId("serve-context-server").textContent;
    const receiverBefore = screen.getByTestId("serve-context-receiver").textContent;
    const before = screen.getByTestId("serve-direction-arrow").getAttribute("data-serve-direction");

    for (let i = 0; i < 6; i += 1) {
      await user.click(screen.getByTestId("btn-team-a-won-rally"));
    }

    expect(screen.getByTestId("serve-context-server")).toHaveTextContent(serverBefore);
    expect(screen.getByTestId("serve-context-receiver")).toHaveTextContent(receiverBefore);
    expect(screen.getByTestId("player-slot-A")).toHaveAttribute(
      "data-screen-position",
      "SCREEN_TOP_LEFT"
    );
    const after = screen.getByTestId("serve-direction-arrow").getAttribute("data-serve-direction");
    expect(after).not.toBe(before);
  });

  it("11 rally label is visible", () => {
    renderRallyWorkspace();
    expect(screen.getByTestId("referee-match-header")).toHaveTextContent("USAP Rally Scoring");
  });

  it("12 side-out presentation regression unchanged", () => {
    renderRallyWorkspace("doubles-server-1");
    expect(screen.getByTestId("referee-match-header")).toHaveTextContent("Doubles / Side-out");
    expect(screen.getByTestId("side-out-line")).toHaveTextContent("0 – 0 – 1");
    expect(screen.getByTestId("serve-context-server-number")).toHaveTextContent("1");
  });
});

describe("Referee V5-R2-2B presentation selector", () => {
  it("buildPresentationModel for USAP rally doubles", () => {
    const state = initStartedUsapRallyMatch();
    const model = buildPresentationModel(state);
    expect(model.scoringLabel).toBe("Doubles / USAP Rally Scoring");
    expect(model.showServerNumber).toBe(false);
    expect(model.scoreLine).toBe("0 – 0");
    expect(model.scoreLineMode).toBe("usap_rally_doubles");
  });

  it("buildPresentationModel for side-out doubles", () => {
    const state = initStartedMatch();
    const model = buildPresentationModel(state);
    expect(model.scoringLabel).toBe("Doubles / Side-out");
    expect(model.showServerNumber).toBe(true);
    expect(model.scoreLine).toBe("0 – 0 – 1");
  });

  it("useCourtVisualizerState exposes presentation fields for USAP", () => {
    const state = initStartedUsapRallyMatch();
    const applied = applyMatchEvent(state, {
      eventId: "e1",
      eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      sequence: 2,
      expectedVersion: state.version,
      actorId: "ref",
      payload: {},
    });
    const { result } = renderHook(() => useCourtVisualizerState(applied.nextState));
    expect(result.current.showServerNumber).toBe(false);
    expect(result.current.scoreLine).toBe("1 – 0");
    expect(result.current.scoringLabel).toContain("USAP Rally Scoring");
  });

  it("USAP fixture is prototype-only and not in production routes by default", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = path.dirname(fileURLToPath(import.meta.url));
    const routerSource = fs.readFileSync(path.join(root, "../../src/router.jsx"), "utf8");
    expect(routerSource).not.toContain("doubles-usap-rally");
    const init = initializeMatchState(
      buildDoublesSideOutConfig({
        scoringSystem: "RALLY",
        scoringVariant: "USAP_2026_PROVISIONAL_RALLY",
      })
    );
    expect(init.ok).toBe(true);
  });
});
