import { Link as RouterLink } from "react-router-dom";

export default function RefereeAssignmentCard({ card }) {
  return (
    <article className="rp-card" data-testid="referee-assignment-card">
      <h2 className="rp-card-title">
        {card.participantA} vs {card.participantB}
      </h2>
      <p className="rp-card-meta">
        {card.competitionName}
        {card.stageName ? ` • ${card.stageName}` : ""}
        {card.roundName ? ` • Vòng ${card.roundName}` : ""}
      </p>
      <p className="rp-card-sub">
        {card.courtLabel}
        {card.scheduledTime ? ` • ${card.scheduledTime}` : ""}
      </p>
      <div className="rp-chip-row">
        <span className="rp-chip">{card.competitionMode || "MODE"}</span>
        <span className="rp-chip">{card.assignmentStatus}</span>
        <span className="rp-chip">{card.matchStatus || "—"}</span>
      </div>
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
