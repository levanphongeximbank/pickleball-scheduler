import { Link as RouterLink } from "react-router-dom";

export default function RefereeAssignmentCard({ card }) {
  return (
    <article className="rp-card" data-testid="referee-assignment-card">
      <div className="rp-card-topline">
        {card.competitionModeLabel ? (
          <span className="rp-chip rp-chip-mode" data-testid="mode-badge">
            {card.competitionModeLabel}
          </span>
        ) : null}
        <span className="rp-chip rp-chip-status" data-testid="status-badge">
          {card.assignmentStatusLabel || "Đã phân công"}
        </span>
      </div>

      <h2 className="rp-card-competition" data-testid="competition-name">
        {card.competitionName}
      </h2>
      {(card.stageName || card.roundName) && (
        <p className="rp-card-meta" data-testid="stage-round">
          {[card.stageName, card.roundName ? `Vòng ${card.roundName}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="rp-card-vs" data-testid="participants">
        <div className="rp-card-side" data-testid="participant-a">
          {card.participantA}
        </div>
        <div className="rp-card-vs-label">VS</div>
        <div className="rp-card-side" data-testid="participant-b">
          {card.participantB}
        </div>
      </div>

      <p className="rp-card-sub" data-testid="court-time">
        {[card.courtLabel, card.scheduledTime].filter(Boolean).join(" · ")}
      </p>

      <RouterLink
        className="rp-btn rp-btn-primary rp-btn-card-action"
        to={card.href}
        data-testid="assignment-action"
      >
        {card.actionLabel}
      </RouterLink>
    </article>
  );
}
