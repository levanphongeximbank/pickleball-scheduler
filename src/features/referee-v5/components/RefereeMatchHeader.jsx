export default function RefereeMatchHeader({ meta, visualState, showPrototypeBadge = false }) {
  return (
    <header className="rv5-header" data-testid="referee-match-header">
      {showPrototypeBadge ? <span className="rv5-prototype-badge">V5 Prototype</span> : null}
      <h1 className="rv5-header-title">{meta?.tournamentName || "Giải Prototype"}</h1>
      <p className="rv5-header-meta">
        {meta?.eventName} · {meta?.matchCode} · {meta?.courtName}
      </p>
      <p className="rv5-header-meta" data-testid="scoring-format-label">
        Game {visualState.currentGameNumber} · {visualState.formatLabel} · {visualState.statusLabel}
      </p>
    </header>
  );
}
