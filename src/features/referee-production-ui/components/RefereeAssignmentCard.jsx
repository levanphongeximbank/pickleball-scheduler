import { Link as RouterLink } from "react-router-dom";

export default function RefereeAssignmentCard({ card }) {
  return (
    <article className="rp-card" data-testid="referee-assignment-card">
      <div className="rp-chip-row rp-chip-row-top">
        {card.competitionModeLabel ? (
          <span className="rp-chip rp-chip-mode" data-testid="mode-badge">
            {card.competitionModeLabel}
          </span>
        ) : null}
        <span className="rp-chip rp-chip-status" data-testid="status-badge">
          {card.assignmentStatusLabel || "Đã phân công"}
        </span>
        {card.matchStatusLabel ? (
          <span className="rp-chip" data-testid="match-status-badge">
            {card.matchStatusLabel}
          </span>
        ) : null}
      </div>

      <h2 className="rp-card-competition" data-testid="competition-name">
        {card.competitionName}
      </h2>
      {(card.stageName || card.roundName) && (
        <p className="rp-card-meta" data-testid="stage-round">
          {card.stageName || ""}
          {card.stageName && card.roundName ? " • " : ""}
          {card.roundName ? `Vòng ${card.roundName}` : ""}
        </p>
      )}

      <div className="rp-card-vs" data-testid="participants">
        <div className="rp-card-side">{card.participantA}</div>
        <div className="rp-card-vs-label">vs</div>
        <div className="rp-card-side">{card.participantB}</div>
      </div>

      <p className="rp-card-sub" data-testid="court-time">
        {card.courtLabel}
        {card.scheduledTime ? ` • ${card.scheduledTime}` : ""}
      </p>

      <RouterLink
        className="rp-btn rp-btn-primary"
        to={card.href}
        data-testid="assignment-action"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
      >
        {card.actionLabel}
      </RouterLink>
    </article>
  );
}
