import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../constants/eventTypes.js";

export default function RefereeActionPanel({
  onCommand,
  disabled = false,
  canUndo = false,
  status,
  timeoutActive = false,
  onConfirmSwitchEnds,
}) {
  const rallyDisabled = disabled || status === MATCH_STATUS.NOT_STARTED || status === MATCH_STATUS.PAUSED;

  const handleSwitchEnds = () => {
    if (onConfirmSwitchEnds) {
      onConfirmSwitchEnds(() => onCommand(MATCH_EVENT_TYPE.SWITCH_ENDS));
      return;
    }
    onCommand(MATCH_EVENT_TYPE.SWITCH_ENDS);
  };

  return (
    <section className="rv5-actions" aria-label="Thao tác trọng tài" data-testid="referee-action-panel">
      {status === MATCH_STATUS.NOT_STARTED ? (
        <button
          type="button"
          className="rv5-btn rv5-btn-rally-a"
          onClick={() => onCommand(MATCH_EVENT_TYPE.START_MATCH)}
          disabled={disabled}
          aria-label="Bắt đầu trận"
          data-testid="btn-start-match"
        >
          BẮT ĐẦU TRẬN
        </button>
      ) : null}

      <div className="rv5-actions-rally">
        <button
          type="button"
          className="rv5-btn rv5-btn-rally-a"
          onClick={() => onCommand(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY)}
          disabled={rallyDisabled}
          aria-label="Đội A thắng rally"
          data-testid="btn-team-a-won-rally"
        >
          ĐỘI A THẮNG RALLY
        </button>
        <button
          type="button"
          className="rv5-btn rv5-btn-rally-b"
          onClick={() => onCommand(MATCH_EVENT_TYPE.TEAM_B_WON_RALLY)}
          disabled={rallyDisabled}
          aria-label="Đội B thắng rally"
          data-testid="btn-team-b-won-rally"
        >
          ĐỘI B THẮNG RALLY
        </button>
      </div>

      <div className="rv5-actions-secondary">
        <button
          type="button"
          className="rv5-btn rv5-btn-secondary"
          onClick={() => onCommand(MATCH_EVENT_TYPE.UNDO_LAST_EVENT)}
          disabled={disabled || !canUndo}
          aria-label="Hoàn tác"
          data-testid="btn-undo"
        >
          HOÀN TÁC
        </button>
        <button
          type="button"
          className="rv5-btn rv5-btn-warning"
          onClick={handleSwitchEnds}
          disabled={rallyDisabled}
          aria-label="Đổi sân"
          data-testid="btn-switch-ends"
        >
          ĐỔI SÂN
        </button>
        <button
          type="button"
          className="rv5-btn rv5-btn-secondary"
          onClick={() =>
            onCommand(
              status === MATCH_STATUS.PAUSED
                ? MATCH_EVENT_TYPE.RESUME_MATCH
                : MATCH_EVENT_TYPE.PAUSE_MATCH
            )
          }
          disabled={disabled || status === MATCH_STATUS.NOT_STARTED}
          aria-label={status === MATCH_STATUS.PAUSED ? "Tiếp tục" : "Tạm dừng"}
          data-testid="btn-pause-resume"
        >
          {status === MATCH_STATUS.PAUSED ? "TIẾP TỤC" : "TẠM DỪNG"}
        </button>
      </div>

      <button
        type="button"
        className="rv5-btn rv5-btn-secondary"
        onClick={() =>
          onCommand(timeoutActive ? MATCH_EVENT_TYPE.END_TIMEOUT : MATCH_EVENT_TYPE.START_TIMEOUT)
        }
        disabled={disabled || status === MATCH_STATUS.NOT_STARTED}
        aria-label="Timeout"
        data-testid="btn-timeout"
      >
        {timeoutActive ? "KẾT THÚC TIMEOUT" : "TIMEOUT"}
      </button>
    </section>
  );
}
