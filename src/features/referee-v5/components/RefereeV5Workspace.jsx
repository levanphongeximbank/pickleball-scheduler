import { useMemo } from "react";

import "../styles/refereeV5.css";
import { MATCH_EVENT_TYPE } from "../constants/eventTypes.js";
import { isRefereeV5RemoteMode } from "../flags.js";
import { useRefereeMatchController } from "../hooks/useRefereeMatchController.js";
import { useRefereeRemoteMatchController } from "../hooks/useRefereeRemoteMatchController.js";
import { useCourtVisualizerState } from "../hooks/useCourtVisualizerState.js";
import { REFEREE_V5_FIXTURES } from "../prototype/refereeV5PrototypeFixtures.js";
import RefereeMatchHeader from "./RefereeMatchHeader.jsx";
import RefereeScoreboard from "./RefereeScoreboard.jsx";
import CourtVisualizer from "./CourtVisualizer.jsx";
import ServeContextPanel from "./ServeContextPanel.jsx";
import RefereeActionPanel from "./RefereeActionPanel.jsx";
import MatchEventTimeline from "./MatchEventTimeline.jsx";
import RefereeConnectionStatus from "./RefereeConnectionStatus.jsx";
import RefereeConfirmationDialog from "./RefereeConfirmationDialog.jsx";
import { useRefereeConfirmation } from "../hooks/useRefereeConfirmation.js";

export default function RefereeV5Workspace({
  initialFixtureId = "doubles-side-out-0-0-2",
  showPrototypeBadge = true,
  accessToken = null,
  stagingFixtureId = "staging-doubles",
}) {
  const localController = useRefereeMatchController(initialFixtureId);
  const remoteController = useRefereeRemoteMatchController({
    fixtureId: stagingFixtureId,
    accessToken,
  });
  const remoteMode = isRefereeV5RemoteMode();
  const controller = remoteMode ? remoteController : localController;
  const { requestConfirm, dialogProps } = useRefereeConfirmation();

  const teamNames = useMemo(() => {
    const fixture = REFEREE_V5_FIXTURES.find((item) => item.id === controller.fixtureId);
    return {
      teamA: fixture?.config?.teams?.teamA?.teamName || "Đội A",
      teamB: fixture?.config?.teams?.teamB?.teamName || "Đội B",
    };
  }, [controller.fixtureId]);

  const visualState = useCourtVisualizerState(controller.state, teamNames);

  const lastDomainEvents =
    controller.domainEventsBySequence[controller.state.lastEventSequence] || [];

  const handleCommand = (eventType) => {
    controller.dispatch(eventType);
  };

  return (
    <div className="rv5-workspace" data-testid="referee-v5-workspace">
      <RefereeMatchHeader
        meta={controller.meta}
        visualState={visualState}
        showPrototypeBadge={showPrototypeBadge}
      />
      <RefereeConnectionStatus
        mode={controller.connectionMode || "prototype"}
        realtimeState={controller.realtimeConnectionState}
        isRealtimeActive={controller.isRealtimeActive}
      />

      {controller.remoteUpdateNotice ? (
        <p className="rv5-header-meta rv5-remote-update-notice" data-testid="remote-update-notice">
          Cập nhật từ thiết bị khác
        </p>
      ) : null}

      {!isRefereeV5RemoteMode() ? (
        <>
          <label htmlFor="rv5-fixture-select" className="rv5-header-meta">
            Fixture prototype
          </label>
          <select
            id="rv5-fixture-select"
            className="rv5-fixture-select"
            value={controller.fixtureId}
            onChange={(event) => controller.loadFixture(event.target.value)}
            data-testid="fixture-select"
          >
            {REFEREE_V5_FIXTURES.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.label}
              </option>
            ))}
          </select>
        </>
      ) : (
        <p className="rv5-header-meta" data-testid="remote-mode-badge">
          Remote staging — {stagingFixtureId}
        </p>
      )}

      <div className="rv5-main-grid">
        <div>
          <RefereeScoreboard visualState={visualState} />
          <CourtVisualizer visualState={visualState} lastDomainEvents={lastDomainEvents} />
        </div>
        <div>
          <ServeContextPanel visualState={visualState} />
          <MatchEventTimeline
            eventHistory={controller.eventHistory}
            domainEventsBySequence={controller.domainEventsBySequence}
          />
        </div>
      </div>

      {controller.lastError ? (
        <p className="rv5-error" role="alert" data-testid="referee-error">
          {controller.lastError}
        </p>
      ) : null}

      {controller.connectionMode === "remote-error" ? (
        <button
          type="button"
          className="rv5-btn rv5-btn-secondary"
          onClick={() => controller.reload?.()}
          data-testid="btn-reload-remote"
        >
          Tải lại trạng thái
        </button>
      ) : null}

      <RefereeActionPanel
        status={controller.state.status}
        disabled={controller.actionsDisabled}
        canUndo={controller.canUndo}
        timeoutActive={controller.timeoutActive}
        onCommand={handleCommand}
        onConfirmSwitchEnds={(action) =>
          requestConfirm(
            {
              title: "Xác nhận đổi sân",
              message: "Hai đội sẽ đảo đầu sân. Tỷ số và người giao/đỡ giữ nguyên.",
              confirmLabel: "Đổi sân",
            },
            action
          )
        }
      />

      <button
        type="button"
        className="rv5-btn rv5-btn-secondary"
        onClick={() =>
          requestConfirm(
            {
              title: "Reset prototype",
              message: "Khôi phục fixture hiện tại về trạng thái ban đầu?",
              confirmLabel: "Reset",
            },
            () => controller.resetFixture()
          )
        }
        data-testid="btn-reset-prototype"
      >
        RESET FIXTURE
      </button>

      <RefereeConfirmationDialog {...dialogProps} />
    </div>
  );
}

export { MATCH_EVENT_TYPE };
