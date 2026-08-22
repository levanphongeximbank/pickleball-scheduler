import { useMemo, useState } from "react";
import RefereeAssignmentCard from "./RefereeAssignmentCard.jsx";
import {
  HOME_STATUS_FILTER,
  buildHomeStatusFilterModel,
  buildRefereeHomeSummary,
  filterAssignmentsByHomeStatus,
  localDayKey,
} from "../projection/buildRefereeHomeSummary.js";
import {
  HOME_MODE_FILTER_ALL,
  HOME_TOURNAMENT_FILTER_ALL,
  buildHomeModeOptions,
  buildHomeTournamentOptions,
  filterAssignmentsByCompetitionMode,
  filterAssignmentsByTournament,
} from "../projection/homePresentationFilters.js";

function todayInputValue(now = new Date()) {
  return localDayKey(now);
}

export default function RefereeHome({
  assignments = [],
  loading = false,
  error = null,
  userLabel = "bạn",
  now = null,
}) {
  const [rangeClock] = useState(() => (now instanceof Date ? now : new Date()));
  const clock = now instanceof Date ? now : rangeClock;
  const [fromDate, setFromDate] = useState(() => todayInputValue(clock));
  const [toDate, setToDate] = useState(() => todayInputValue(clock));
  const [tournamentFilter, setTournamentFilter] = useState(HOME_TOURNAMENT_FILTER_ALL);
  const [modeFilter, setModeFilter] = useState(HOME_MODE_FILTER_ALL);
  const [filter, setFilter] = useState(HOME_STATUS_FILTER.ALL);

  const summary = useMemo(
    () =>
      buildRefereeHomeSummary(assignments, {
        fromDate,
        toDate,
        now: clock,
      }),
    [assignments, fromDate, toDate, clock]
  );

  const tournamentOptions = useMemo(
    () => buildHomeTournamentOptions(summary.board),
    [summary.board]
  );
  const modeOptions = useMemo(() => buildHomeModeOptions(summary.board), [summary.board]);

  const board = useMemo(() => {
    const byTournament = filterAssignmentsByTournament(summary.board || [], tournamentFilter);
    return filterAssignmentsByCompetitionMode(byTournament, modeFilter);
  }, [summary.board, tournamentFilter, modeFilter]);

  const statusModel = useMemo(() => buildHomeStatusFilterModel(board), [board]);

  const visible = useMemo(
    () => filterAssignmentsByHomeStatus(board, filter),
    [board, filter]
  );

  return (
    <div className="rp-page rp-page-home" data-testid="referee-home">
      <header className="rp-home-header" data-testid="referee-home-header">
        <h1 className="rp-title">Trọng tài của tôi</h1>
        <p className="rp-sub" data-testid="referee-user-context">
          Dashboard · Xin chào {userLabel}
        </p>
        <p className="rp-sub" data-testid="referee-home-nav-hint">
          Trận được phân công · Tài khoản từ menu góc phải
        </p>
      </header>

      <section className="rp-home-date-range" data-testid="home-date-range">
        <label className="rp-home-date-field" htmlFor="referee-home-from-date">
          <span>Từ ngày</span>
          <input
            id="referee-home-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            data-testid="home-date-from"
          />
        </label>
        <label className="rp-home-date-field" htmlFor="referee-home-to-date">
          <span>Đến ngày</span>
          <input
            id="referee-home-to-date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            data-testid="home-date-to"
          />
        </label>
      </section>

      <section className="rp-home-select-filters" data-testid="home-select-filters">
        <label className="rp-home-date-field" htmlFor="referee-home-tournament">
          <span>Giải đấu</span>
          <select
            id="referee-home-tournament"
            value={tournamentFilter}
            onChange={(event) => setTournamentFilter(event.target.value)}
            data-testid="home-tournament-filter"
            disabled={loading && assignments.length === 0}
          >
            {tournamentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rp-home-date-field" htmlFor="referee-home-mode">
          <span>Hình thức</span>
          <select
            id="referee-home-mode"
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value)}
            data-testid="home-mode-filter"
            disabled={loading && assignments.length === 0}
          >
            {modeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rp-home-summary" data-testid="home-daily-summary">
        <p className="rp-home-summary-title" data-testid="home-daily-headline">
          {loading && assignments.length === 0
            ? "Đang tải phân công…"
            : `${summary.headline.replace(/: \d+ trận$/, `: ${board.length} trận`)}`}
        </p>
        <div className="rp-home-counters" data-testid="home-status-counters">
          <div className="rp-home-counter" data-testid="counter-upcoming">
            <span className="rp-home-counter-value">
              {loading && assignments.length === 0 ? "—" : statusModel.counters.upcoming}
            </span>
            <span className="rp-home-counter-label">Sắp diễn ra</span>
          </div>
          <div className="rp-home-counter" data-testid="counter-live">
            <span className="rp-home-counter-value">
              {loading && assignments.length === 0 ? "—" : statusModel.counters.live}
            </span>
            <span className="rp-home-counter-label">Đang thi đấu</span>
          </div>
          <div className="rp-home-counter" data-testid="counter-done">
            <span className="rp-home-counter-value">
              {loading && assignments.length === 0 ? "—" : statusModel.counters.done}
            </span>
            <span className="rp-home-counter-label">Hoàn tất</span>
          </div>
        </div>
      </section>

      <div className="rp-home-filters" data-testid="home-status-filters" role="tablist">
        {statusModel.filters.map((tab) => (
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
          {(summary.board || []).length === 0
            ? summary.emptyMessage ||
              `Chưa có trận được phân công cho ${userLabel}.`
            : "Không có trận trong bộ lọc này."}
        </p>
      ) : null}
      {summary.undatedCount > 0 ? (
        <p className="rp-sub" data-testid="home-undated-note">
          {summary.undatedCount} trận chưa xác định ngày (không tính trong khoảng đã chọn).
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
