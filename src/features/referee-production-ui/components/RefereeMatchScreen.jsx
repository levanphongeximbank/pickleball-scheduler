import CanonicalCourtView from "./CanonicalCourtView.jsx";

function Banner({ kind, children, testId }) {
  return (
    <div className={`rp-banner rp-banner-${kind}`} data-testid={testId}>
      {children}
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
  if (loading) {
    return (
      <div className="rp-page" data-testid="referee-match-screen">
        <p className="rp-sub">Đang tải trận từ trạng thái canonical…</p>
      </div>
    );
  }

  if (error && !view) {
    return (
      <div className="rp-page" data-testid="referee-match-screen">
        <Banner kind="error" testId="match-error">{error}</Banner>
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

  return (
    <div className="rp-page" data-testid="referee-match-screen" data-mode={view.competitionMode}>
      <h1 className="rp-title">{view.competitionName || "Trận trọng tài"}</h1>
      <p className="rp-sub">
        {view.competitionMode}
        {view.stageName ? ` • ${view.stageName}` : ""}
        {view.roundName ? ` • Vòng ${view.roundName}` : ""}
        {view.courtLabel ? ` • ${view.courtLabel}` : ""}
      </p>

      <div className="rp-policy" data-testid="scoring-policy">
        {view.gameSummary?.scorePolicyLine ? (
          <span className="rp-chip">{view.gameSummary.scorePolicyLine}</span>
        ) : null}
        {view.gameSummary?.changeEndPolicy ? (
          <span className="rp-chip" data-testid="change-end-policy">
            {view.gameSummary.changeEndPolicy}
          </span>
        ) : null}
        <span className="rp-chip">Game {view.gameSummary?.currentGame || 1}</span>
        <span className="rp-chip">{view.matchStatus || "—"}</span>
      </div>

      <Banner
        kind={view.acceptedOfficialResult ? "ok" : "info"}
        testId="result-status"
      >
        {view.resultStatusLabel}
      </Banner>

      {stale ? (
        <Banner kind="warn" testId="stale-banner">
          Trạng thái cũ — không ghi đè. Tải lại để hòa giải.
          <button type="button" className="rp-btn rp-btn-ghost" onClick={onReload} style={{ marginTop: 8 }}>
            Hòa giải
          </button>
        </Banner>
      ) : null}

      {pending ? (
        <Banner kind="info" testId="pending-banner">
          Đang chờ ACK canonical…
        </Banner>
      ) : null}

      {error ? <Banner kind="error" testId="match-error">{error}</Banner> : null}

      {view.preStart && view.preStart.ok === false ? (
        <Banner kind="warn" testId="precheck-banner">
          Precheck chưa đạt. Không mở trận cho đến khi Adapter B / CORE-13 sẵn sàng.
        </Banner>
      ) : null}

      <div className="rp-score" data-testid="scoreboard">
        <div className={`rp-score-team${servingSide === "SIDE_A" ? " is-serving" : ""}`}>
          <div>{court.sides?.left?.participant?.displayName || "A"}</div>
          <div className="rp-score-num">{Number(score.SIDE_A || 0)}</div>
        </div>
        <div className={`rp-score-team${servingSide === "SIDE_B" ? " is-serving" : ""}`}>
          <div>{court.sides?.right?.participant?.displayName || "B"}</div>
          <div className="rp-score-num">{Number(score.SIDE_B || 0)}</div>
        </div>
        {scoreLine.showServiceTurn ? (
          <div className="rp-score-line" data-testid="service-turn">
            Lượt giao #{scoreLine.serviceTurn} (không phải số áo VĐV)
          </div>
        ) : (
          <div className="rp-score-line" data-testid="rally-score-line">
            {scoreLine.display || `${Number(score.SIDE_A || 0)} – ${Number(score.SIDE_B || 0)}`}
          </div>
        )}
      </div>

      {db?.isDreambreaker ? (
        <div className="rp-db" data-testid="dreambreaker-panel">
          <strong>DreamBreaker</strong>
          <p>
            A: {db.sideAActivePlayer?.displayName || "—"}
            {db.nextPlayerA ? ` → ${db.nextPlayerA.displayName}` : ""}
          </p>
          <p>
            B: {db.sideBActivePlayer?.displayName || "—"}
            {db.nextPlayerB ? ` → ${db.nextPlayerB.displayName}` : ""}
          </p>
          {db.rotationProgress ? (
            <p>
              Rotation {db.rotationProgress.pointsInRotation ?? "—"}/
              {db.rotationProgress.rotationPoints ?? "—"}
            </p>
          ) : null}
        </div>
      ) : null}

      <CanonicalCourtView courtProjection={court} />

      {court.sideChangeRequired ? (
        <Banner kind="warn" testId="change-ends-warning">
          Canonical policy yêu cầu đổi sân. Xác nhận rồi mới gửi lệnh — không đảo sân local trước ACK.
        </Banner>
      ) : null}

      <div className="rp-actions">
        {view.canStart ? (
          <button
            type="button"
            className="rp-btn rp-btn-primary rp-actions-wide"
            disabled={pending}
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
              disabled={pending}
              onClick={onPointA}
              data-testid="btn-point-a"
            >
              Điểm A
            </button>
            <button
              type="button"
              className="rp-btn rp-btn-b"
              disabled={pending}
              onClick={onPointB}
              data-testid="btn-point-b"
            >
              Điểm B
            </button>
          </>
        ) : null}
        {view.canSuspend ? (
          <button type="button" className="rp-btn rp-btn-warn" disabled={pending} onClick={onSuspend} data-testid="btn-suspend">
            Tạm dừng
          </button>
        ) : null}
        {view.canResume ? (
          <button type="button" className="rp-btn rp-btn-primary" disabled={pending} onClick={onResume} data-testid="btn-resume">
            Tiếp tục
          </button>
        ) : null}
        <button
          type="button"
          className="rp-btn rp-btn-ghost"
          disabled={pending}
          onClick={onChangeEnds}
          data-testid="btn-change-ends"
        >
          Đổi sân (ends)
        </button>
        <button
          type="button"
          className="rp-btn rp-btn-ghost"
          disabled={pending}
          onClick={() => onSwitchPositions?.("A")}
          data-testid="btn-switch-positions"
        >
          Đổi vị trí (trong đội)
        </button>
        {view.canComplete ? (
          <button
            type="button"
            className="rp-btn rp-btn-primary rp-actions-wide"
            disabled={pending}
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
            disabled={pending}
            onClick={onCorrect}
            data-testid="btn-correct"
          >
            Correction
          </button>
        ) : null}
      </div>
    </div>
  );
}
