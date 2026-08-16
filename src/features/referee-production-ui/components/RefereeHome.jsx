import { useMemo, useState } from "react";
import RefereeAssignmentCard from "./RefereeAssignmentCard.jsx";
import {
  HOME_STATUS_FILTER,
  buildRefereeHomeSummary,
  filterAssignmentsByHomeStatus,
} from "../projection/buildRefereeHomeSummary.js";

export default function RefereeHome({
  assignments = [],
  loading = false,
  error = null,
  userLabel = "bạn",
}) {
  const [filter, setFilter] = useState(HOME_STATUS_FILTER.ALL);
  const summary = useMemo(() => buildRefereeHomeSummary(assignments), [assignments]);
  const board = useMemo(() => summary.board || [], [summary]);
  const visible = useMemo(
    () => filterAssignmentsByHomeStatus(board, filter),
    [board, filter]
  );

  return (
    <div className="rp-page rp-page-home" data-testid="referee-home">
      <header className="rp-home-header" data-testid="referee-home-header">
        <h1 className="rp-title">Trọng tài của tôi</h1>
        <p className="rp-sub" data-testid="referee-user-context">
          Xin chào {userLabel}
        </p>
      </header>

      <section className="rp-home-summary" data-testid="home-daily-summary">
        <p className="rp-home-summary-title" data-testid="home-daily-headline">
          {loading && assignments.length === 0 ? "Đang tải phân công…" : summary.headline}
        </p>
        <div className="rp-home-counters" data-testid="home-status-counters">
          <div className="rp-home-counter" data-testid="counter-upcoming">
            <span className="rp-home-counter-value">
              {loading && assignments.length === 0 ? "—" : summary.counters.upcoming}
            </span>
            <span className="rp-home-counter-label">Sắp diễn ra</span>
          </div>
          <div className="rp-home-counter" data-testid="counter-live">
            <span className="rp-home-counter-value">
              {loading && assignments.length === 0 ? "—" : summary.counters.live}
            </span>
            <span className="rp-home-counter-label">Đang thi đấu</span>
          </div>
          <div className="rp-home-counter" data-testid="counter-done">
            <span className="rp-home-counter-value">
              {loading && assignments.length === 0 ? "—" : summary.counters.done}
            </span>
            <span className="rp-home-counter-label">Hoàn tất</span>
          </div>
        </div>
      </section>

      <div className="rp-home-filters" data-testid="home-status-filters" role="tablist">
        {summary.filters.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`rp-filter-tab${filter === tab.id ? " is-active" : ""}`}
            data-testid={`filter-${tab.id.toLowerCase()}`}
            onClick={() => setFilter(tab.id)}
            disabled={loading && assignments.length === 0}
          >
            {tab.label}
            <span className="rp-filter-count">
              {loading && assignments.length === 0 ? "—" : tab.count}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="rp-banner rp-banner-error" data-testid="referee-home-error">
          {error}
        </div>
      ) : null}
      {loading ? <p className="rp-sub">Đang tải…</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="rp-sub" data-testid="referee-home-empty">
          {board.length === 0
            ? `Chưa có trận được phân công cho ${userLabel}.`
            : "Không có trận trong bộ lọc này."}
        </p>
      ) : null}
      <div className="rp-assignment-list" data-testid="assignment-list">
        {visible.map((card) => (
          <RefereeAssignmentCard key={`${card.competitionId}-${card.matchId}`} card={card} />
        ))}
      </div>
    </div>
  );
}
