import RefereeAssignmentCard from "./RefereeAssignmentCard.jsx";

export default function RefereeHome({
  assignments = [],
  loading = false,
  error = null,
  userLabel = "bạn",
}) {
  return (
    <div className="rp-page rp-page-home" data-testid="referee-home">
      <header className="rp-home-header">
        <h1 className="rp-title">Trận được phân công</h1>
        <p className="rp-sub">Xin chào {userLabel}. Chọn trận để ghi điểm.</p>
      </header>
      {error ? (
        <div className="rp-banner rp-banner-error" data-testid="referee-home-error">
          {error}
        </div>
      ) : null}
      {loading ? <p className="rp-sub">Đang tải…</p> : null}
      {!loading && assignments.length === 0 ? (
        <p className="rp-sub" data-testid="referee-home-empty">
          Chưa có trận được phân công cho {userLabel}.
        </p>
      ) : null}
      <div className="rp-assignment-list" data-testid="assignment-list">
        {assignments.map((card) => (
          <RefereeAssignmentCard key={`${card.competitionId}-${card.matchId}`} card={card} />
        ))}
      </div>
    </div>
  );
}
