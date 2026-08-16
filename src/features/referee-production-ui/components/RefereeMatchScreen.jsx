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
  const servingSide = court.serving?.servingSide;
  const pending = Boolean(pendingAction);
  const scoreLine = court.scoreLine || {};
  const db = court.dreambreaker;
  const isSideOut = scoreLine.showServiceTurn === true;
  const leftName = court.sides?.left?.participant?.displayName || "Đội A";
  const rightName = court.sides?.right?.participant?.displayName || "Đội B";
  const gamesWon = view.gameSummary?.gamesWon || {};
  const gamesA = Number(gamesWon.SIDE_A || 0);
  const gamesB = Number(gamesWon.SIDE_B || 0);
  const servingTeamName =
    servingSide === "SIDE_B" ? rightName : servingSide === "SIDE_A" ? leftName : null;

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
        <h1 className="rp-match-title">{view.competitionName || "Trận trọng tài"}</h1>
        <p className="rp-match-meta">
          {[view.stageName, view.roundName ? `Vòng ${view.roundName}` : null, view.courtLabel]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {view.gameSummary?.scorePolicyLine ? (
          <p className="rp-match-policy" data-testid="scoring-policy">
            {view.gameSummary.scorePolicyLine}
            {view.gameSummary.changeEndPolicy
              ? ` · Đổi sân: ${view.gameSummary.changeEndPolicy}`
              : ""}
          </p>
        ) : null}
      </header>

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
          <div className={`rp-score-team${servingSide === "SIDE_A" ? " is-serving" : ""}`}>
            <div className="rp-score-label">{leftName}</div>
            <div className="rp-score-num" data-testid="score-a">
              {Number(score.SIDE_A || 0)}
            </div>
          </div>
          <div className={`rp-score-team${servingSide === "SIDE_B" ? " is-serving" : ""}`}>
            <div className="rp-score-label">{rightName}</div>
            <div className="rp-score-num" data-testid="score-b">
              {Number(score.SIDE_B || 0)}
            </div>
          </div>
        </div>
        <div className="rp-scoreboard-summary" data-testid="games-summary">
          <span>
            Game {view.gameSummary?.currentGame || 1}
            {view.gameSummary?.bestOf ? ` / ${view.gameSummary.bestOf}` : ""}
          </span>
          <span data-testid="games-won">
            Games: {gamesA}–{gamesB}
          </span>
        </div>
      </section>

      {isSideOut ? (
        <div className="rp-serve-meta" data-testid="service-turn">
          {servingTeamName ? <span>Đội giao: {servingTeamName}</span> : null}
          {scoreLine.serviceTurn != null ? (
            <span data-testid="service-turn-number">Lượt giao: #{scoreLine.serviceTurn}</span>
          ) : null}
          {scoreLine.display ? (
            <span className="rp-serve-call" data-testid="sideout-call">
              Đọc tỷ số: {scoreLine.display}
            </span>
          ) : null}
        </div>
      ) : null}

      <CanonicalCourtView courtProjection={court} />

      <DreamBreakerPanel db={db} />

      {court.sideChangeRequired ? (
        <Banner kind="warn" testId="change-ends-warning">
          Cần đổi sân theo luật. Xác nhận để gửi lệnh — sân chỉ đổi sau khi máy chủ xác nhận.
        </Banner>
      ) : null}

      {confirmChangeEnds ? (
        <div className="rp-confirm" data-testid="change-ends-confirm">
          <p>Xác nhận đổi sân / đổi đầu sân? Sân chỉ đổi sau ACK từ máy chủ.</p>
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
          <button
            type="button"
            className="rp-btn rp-btn-ghost"
            disabled={pending || stale}
            onClick={() => onSwitchPositions?.("A")}
            data-testid="btn-switch-positions"
          >
            ĐỔI VỊ TRÍ VĐV
          </button>
          <button
            type="button"
            className="rp-btn rp-btn-warn"
            disabled={pending || stale}
            onClick={() => setConfirmChangeEnds(true)}
            data-testid="btn-change-ends"
          >
            ĐỔI SÂN / ĐỔI ĐẦU SÂN
          </button>
        </div>

        {view.canComplete ? (
          <button
            type="button"
            className="rp-btn rp-btn-primary rp-actions-wide"
            disabled={pending || stale}
            onClick={onSubmitResult}
            data-testid="btn-complete"
          >
            Hoàn tất / gửi kết quả
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
            Sửa kết quả
          </button>
        ) : null}
      </div>
    </div>
  );
}
