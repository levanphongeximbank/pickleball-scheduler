import { Link as RouterLink } from "react-router-dom";
import { useState } from "react";
import CanonicalCourtView from "./CanonicalCourtView.jsx";

function Banner({ kind, children, testId }) {
  return (
    <div className={`rp-banner rp-banner-${kind}`} data-testid={testId}>
      {children}
    </div>
  );
}

function pointLabel(displayName, fallback) {
  const name = String(displayName || "").trim();
  if (!name) return `+ Điểm ${fallback}`;
  return `+ Điểm ${name}`;
}

function DreamBreakerPanel({ db }) {
  if (!db?.isDreambreaker) return null;
  if (!db.hasActiveRotation) {
    return (
      <Banner kind="warn" testId="dreambreaker-fail-closed">
        DreamBreaker thiếu dữ liệu xoay vòng từ Team domain.
      </Banner>
    );
  }
  return (
    <div className="rp-db" data-testid="dreambreaker-panel">
      <strong>DreamBreaker</strong>
      <div className="rp-db-grid">
        <div data-testid="db-side-a">
          <span className="rp-db-label">Đang thi đấu A</span>
          <p>{db.sideAActivePlayer?.displayName || "Chưa có VĐV"}</p>
          {db.nextPlayerA ? (
            <span className="rp-db-next">Tiếp: {db.nextPlayerA.displayName}</span>
          ) : null}
        </div>
        <div data-testid="db-side-b">
          <span className="rp-db-label">Đang thi đấu B</span>
          <p>{db.sideBActivePlayer?.displayName || "Chưa có VĐV"}</p>
          {db.nextPlayerB ? (
            <span className="rp-db-next">Tiếp: {db.nextPlayerB.displayName}</span>
          ) : null}
        </div>
      </div>
      {db.rotationProgress ? (
        <p className="rp-db-progress" data-testid="db-rotation-progress">
          Xoay vòng {db.rotationProgress.pointsInRotation ?? "—"}/
          {db.rotationProgress.rotationPoints ?? "—"}
        </p>
      ) : null}
    </div>
  );
}

function RulesPanel({ rules }) {
  if (!rules?.rows?.length) return null;
  return (
    <section className="rp-rules" data-testid="match-rules-panel">
      <h2 className="rp-rules-title">{rules.title || "LUẬT TRẬN"}</h2>
      <dl className="rp-rules-grid">
        {rules.rows.map((row) => (
          <div key={row.key} className="rp-rules-row" data-testid={`rule-${row.key}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ServingStatusStrip({ serving, scoreLine }) {
  if (!serving) return null;
  const hasAny =
    serving.servingTeamName ||
    serving.servingPlayerName ||
    serving.showServiceTurn ||
    serving.gameLabel;
  if (!hasAny) return null;
  return (
    <div className="rp-serve-strip" data-testid="serving-status-strip">
      {serving.servingTeamName ? (
        <span data-testid="serve-team">
          Giao bóng: <strong>{serving.servingTeamName}</strong>
        </span>
      ) : null}
      {serving.servingPlayerName ? (
        <span data-testid="serve-player">
          Người giao: <strong>{serving.servingPlayerName}</strong>
        </span>
      ) : null}
      {serving.showServiceTurn && serving.serviceTurn != null ? (
        <span data-testid="service-turn">
          Lượt giao: <strong data-testid="service-turn-number">#{serving.serviceTurn}</strong>
        </span>
      ) : null}
      {serving.gameLabel ? <span data-testid="serve-game">{serving.gameLabel}</span> : null}
      {scoreLine?.display && serving.showServiceTurn ? (
        <span className="rp-serve-call" data-testid="sideout-call">
          Đọc tỷ số: {scoreLine.display}
        </span>
      ) : null}
    </div>
  );
}

function GameHistoryPanel({ summary }) {
  if (!summary) return null;
  const current = summary.currentGamePoints;
  const previous = Array.isArray(summary.previousGames) ? summary.previousGames : [];
  const gamesWon = summary.gamesWon || {};
  return (
    <section className="rp-game-history" data-testid="game-summary-panel">
      <div className="rp-game-current" data-testid="current-game-summary">
        <strong>Game {summary.currentGame || 1}</strong>
        {current ? (
          <span>
            {current.sideA} • {current.sideB}
          </span>
        ) : null}
      </div>
      {summary.bestOf ? (
        <div className="rp-game-won" data-testid="games-won">
          Games won: {Number(gamesWon.SIDE_A || 0)}–{Number(gamesWon.SIDE_B || 0)}
          {summary.bestOf ? ` (Best of ${summary.bestOf})` : ""}
        </div>
      ) : null}
      {previous.length > 0 ? (
        <ul className="rp-game-previous" data-testid="previous-game-history">
          {previous.map((game) => (
            <li key={`g-${game.gameNumber}`}>
              Game {game.gameNumber}: {game.sideA}–{game.sideB}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function RefereeMatchScreen({
  view,
  loading,
  error,
  pendingAction,
  stale,
  onStart,
  onPointA,
  onPointB,
  onSuspend,
  onResume,
  onChangeEnds,
  onSwitchPositions,
  onSubmitResult,
  onCorrect,
  onReload,
}) {
  const [confirmChangeEnds, setConfirmChangeEnds] = useState(false);

  if (loading) {
    return (
      <div className="rp-page rp-page-match" data-testid="referee-match-screen">
        <p className="rp-sub">Đang tải trận…</p>
      </div>
    );
  }

  if (error && !view) {
    return (
      <div className="rp-page rp-page-match" data-testid="referee-match-screen">
        <Banner kind="error" testId="match-error">
          {error}
        </Banner>
        <button type="button" className="rp-btn rp-btn-ghost" onClick={onReload}>
          Tải lại
        </button>
      </div>
    );
  }

  if (!view) return null;

  const court = view.courtProjection || {};
  const score = view.currentScore?.points || {};
  const pending = Boolean(pendingAction);
  const scoreLine = court.scoreLine || {};
  const db = court.dreambreaker;
  const leftSide = court.sides?.left || {};
  const rightSide = court.sides?.right || {};
  const leftScoring = leftSide.scoringSide || "SIDE_A";
  const rightScoring = rightSide.scoringSide || "SIDE_B";
  const leftName =
    leftSide.participant?.displayName ||
    view.participantDisplay?.sideA?.label ||
    "Đội A";
  const rightName =
    rightSide.participant?.displayName ||
    view.participantDisplay?.sideB?.label ||
    "Đội B";
  const leftPlayers =
    (leftSide.activePlayers || []).map((p) => p.displayName).filter(Boolean).join(" / ") ||
    leftName;
  const rightPlayers =
    (rightSide.activePlayers || []).map((p) => p.displayName).filter(Boolean).join(" / ") ||
    rightName;
  const changeEndsRequired = court.sideChangeRequired === true;
  const showManualChangeEnds = view.canChangeEnds === true && !changeEndsRequired;

  const handleConfirmChangeEnds = () => {
    setConfirmChangeEnds(false);
    onChangeEnds?.();
  };

  return (
    <div
      className="rp-page rp-page-match"
      data-testid="referee-match-screen"
      data-mode={view.competitionMode}
      data-pending={pending ? "true" : "false"}
      data-stale={stale ? "true" : "false"}
    >
      <header className="rp-match-header" data-testid="match-header">
        <div className="rp-match-header-top">
          <RouterLink
            className="rp-match-back"
            to="/referee"
            data-testid="btn-back-assignments"
          >
            ← Quay lại DS trận
          </RouterLink>
          <h1 className="rp-match-title">Điều hành trận</h1>
          {view.matchStatusLabel ? (
            <span className="rp-chip rp-chip-status" data-testid="match-status-badge">
              {view.matchStatusLabel}
            </span>
          ) : null}
        </div>
        <p className="rp-match-context" data-testid="match-context-row">
          {view.contextRow ||
            [view.courtLabel, view.competitionName, view.stageRoundLabel]
              .filter(Boolean)
              .join(" | ")}
        </p>
      </header>

      <RulesPanel rules={view.rulesPanel} />

      {view.resultStatus && view.resultStatus !== "NONE" ? (
        <Banner
          kind={view.acceptedOfficialResult ? "ok" : "info"}
          testId="result-status"
        >
          {view.resultStatusLabel}
        </Banner>
      ) : null}

      {stale ? (
        <Banner kind="warn" testId="stale-banner">
          Dữ liệu đã đổi trên máy chủ. Hòa giải trước khi ghi điểm.
          <button
            type="button"
            className="rp-btn rp-btn-ghost rp-btn-inline"
            onClick={onReload}
            data-testid="btn-reconcile"
          >
            Hòa giải
          </button>
        </Banner>
      ) : null}

      {pending ? (
        <Banner kind="info" testId="pending-banner">
          Đang ghi…
        </Banner>
      ) : null}

      {error ? (
        <Banner kind="error" testId="match-error">
          {error}
        </Banner>
      ) : null}

      {view.preStart && view.preStart.ok === false ? (
        <Banner kind="warn" testId="precheck-banner">
          Chưa đủ điều kiện bắt đầu. Kiểm tra phân công và đội hình rồi thử lại.
        </Banner>
      ) : null}

      <section className="rp-scoreboard" data-testid="scoreboard" aria-live="polite">
        <div className="rp-scoreboard-live" data-testid="current-game-score">
          <div
            className={`rp-score-team${
              court.serving?.servingSide === leftScoring ? " is-serving" : ""
            }`}
          >
            <div className="rp-score-label" data-testid="participant-names-a">
              {leftPlayers}
            </div>
            <div className="rp-score-num" data-testid="score-a">
              {Number(score[leftScoring] || 0)}
            </div>
          </div>
          <div
            className={`rp-score-team${
              court.serving?.servingSide === rightScoring ? " is-serving" : ""
            }`}
          >
            <div className="rp-score-label" data-testid="participant-names-b">
              {rightPlayers}
            </div>
            <div className="rp-score-num" data-testid="score-b">
              {Number(score[rightScoring] || 0)}
            </div>
          </div>
        </div>
        <div className="rp-scoreboard-summary" data-testid="games-summary">
          <span>
            Game {view.gameSummary?.currentGame || 1}
            {view.gameSummary?.bestOf ? ` / Best of ${view.gameSummary.bestOf}` : ""}
          </span>
          <span data-testid="games-won-inline">
            Games: {Number(view.gameSummary?.gamesWon?.SIDE_A || 0)}–
            {Number(view.gameSummary?.gamesWon?.SIDE_B || 0)}
          </span>
        </div>
      </section>

      <CanonicalCourtView courtProjection={court} />

      <ServingStatusStrip serving={view.servingStatus} scoreLine={scoreLine} />

      <DreamBreakerPanel db={db} />

      {changeEndsRequired ? (
        <div className="rp-change-ends-required" data-testid="change-ends-warning">
          <p className="rp-change-ends-title">ĐÃ ĐẾN ĐIỂM ĐỔI SÂN</p>
          <p className="rp-change-ends-copy">Vui lòng xác nhận để đổi sân</p>
          {!confirmChangeEnds ? (
            <button
              type="button"
              className="rp-btn rp-btn-warn"
              disabled={pending || stale}
              onClick={() => setConfirmChangeEnds(true)}
              data-testid="btn-change-ends-required"
            >
              XÁC NHẬN ĐỔI SÂN
            </button>
          ) : null}
        </div>
      ) : null}

      {confirmChangeEnds ? (
        <div className="rp-confirm" data-testid="change-ends-confirm">
          <p>Xác nhận đổi sân? Sân chỉ đổi sau khi máy chủ xác nhận (ACK).</p>
          <div className="rp-confirm-actions">
            <button
              type="button"
              className="rp-btn rp-btn-ghost"
              onClick={() => setConfirmChangeEnds(false)}
              data-testid="btn-change-ends-cancel"
            >
              Huỷ
            </button>
            <button
              type="button"
              className="rp-btn rp-btn-warn"
              disabled={pending}
              onClick={handleConfirmChangeEnds}
              data-testid="btn-change-ends-confirm"
            >
              Xác nhận đổi sân
            </button>
          </div>
        </div>
      ) : null}

      <GameHistoryPanel summary={view.gameSummary} />

      <div className="rp-actions">
        {view.canStart ? (
          <button
            type="button"
            className="rp-btn rp-btn-primary rp-actions-wide"
            disabled={pending || stale}
            onClick={onStart}
            data-testid="btn-start"
          >
            Bắt đầu trận
          </button>
        ) : null}
        {view.canScore ? (
          <>
            <button
              type="button"
              className="rp-btn rp-btn-a"
              disabled={pending || stale}
              onClick={onPointA}
              data-testid="btn-point-a"
            >
              {String(pendingAction || "").startsWith("point")
                ? "Đang ghi…"
                : pointLabel(leftName, "A")}
            </button>
            <button
              type="button"
              className="rp-btn rp-btn-b"
              disabled={pending || stale}
              onClick={onPointB}
              data-testid="btn-point-b"
            >
              {String(pendingAction || "").startsWith("point")
                ? "Đang ghi…"
                : pointLabel(rightName, "B")}
            </button>
          </>
        ) : null}

        <div className="rp-actions-secondary rp-actions-wide">
          {view.canSuspend ? (
            <button
              type="button"
              className="rp-btn rp-btn-ghost"
              disabled={pending}
              onClick={onSuspend}
              data-testid="btn-suspend"
            >
              Tạm dừng
            </button>
          ) : null}
          {view.canResume ? (
            <button
              type="button"
              className="rp-btn rp-btn-primary"
              disabled={pending}
              onClick={onResume}
              data-testid="btn-resume"
            >
              Tiếp tục
            </button>
          ) : null}
          {view.canSwitchPositions ? (
            <button
              type="button"
              className="rp-btn rp-btn-ghost"
              disabled={pending || stale}
              onClick={() => onSwitchPositions?.("A")}
              data-testid="btn-switch-positions"
            >
              ĐỔI VỊ TRÍ VĐV
            </button>
          ) : null}
          {showManualChangeEnds ? (
            <button
              type="button"
              className="rp-btn rp-btn-warn"
              disabled={pending || stale}
              onClick={() => setConfirmChangeEnds(true)}
              data-testid="btn-change-ends"
            >
              ĐỔI SÂN / ĐỔI ĐẦU SÂN
            </button>
          ) : null}
        </div>

        {view.canComplete ? (
          <button
            type="button"
            className="rp-btn rp-btn-primary rp-actions-wide"
            disabled={pending || stale}
            onClick={onSubmitResult}
            data-testid="btn-complete"
          >
            KẾT THÚC TRẬN
          </button>
        ) : null}
        {view.canCorrect ? (
          <button
            type="button"
            className="rp-btn rp-btn-warn rp-actions-wide"
            disabled={pending || stale}
            onClick={onCorrect}
            data-testid="btn-correct"
          >
            Sửa / correction
          </button>
        ) : null}
      </div>
    </div>
  );
}
