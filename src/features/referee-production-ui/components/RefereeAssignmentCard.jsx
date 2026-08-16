import { Link as RouterLink } from "react-router-dom";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FlagIcon from "@mui/icons-material/Flag";

export default function RefereeAssignmentCard({ card }) {
  const statusLabel = card.homeStatusLabel || card.matchStatusLabel || card.assignmentStatusLabel;
  const stageRound = [card.stageName, card.roundName ? `Vòng ${card.roundName}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rp-card rp-card-compact" data-testid="referee-assignment-card">
      <div className="rp-card-meta-row" data-testid="assignment-meta-row">
        <span className="rp-meta-item" data-testid="meta-court">
          <SportsTennisIcon className="rp-meta-icon" fontSize="inherit" aria-hidden="true" />
          <span>{card.courtLabel || "Sân?"}</span>
        </span>
        <span className="rp-meta-sep" aria-hidden="true">
          |
        </span>
        <span className="rp-meta-item" data-testid="meta-time">
          <AccessTimeIcon className="rp-meta-icon" fontSize="inherit" aria-hidden="true" />
          <span>{card.scheduledTime || "—"}</span>
        </span>
        <span className="rp-meta-sep" aria-hidden="true">
          |
        </span>
        <span className="rp-meta-item rp-meta-competition" data-testid="competition-name">
          <EmojiEventsIcon className="rp-meta-icon" fontSize="inherit" aria-hidden="true" />
          <span>{card.competitionName}</span>
        </span>
        <span className="rp-meta-sep" aria-hidden="true">
          |
        </span>
        <span className="rp-meta-item" data-testid="status-badge">
          <FlagIcon className="rp-meta-icon" fontSize="inherit" aria-hidden="true" />
          <span className="rp-chip rp-chip-status">{statusLabel}</span>
        </span>
      </div>

      {stageRound ? (
        <p className="rp-card-stage" data-testid="stage-round">
          {stageRound}
        </p>
      ) : null}

      <div className="rp-card-vs rp-card-vs-horizontal" data-testid="participants">
        <div className="rp-card-side" data-testid="participant-a">
          {card.participantA}
        </div>
        <div className="rp-card-vs-label">VS</div>
        <div className="rp-card-side" data-testid="participant-b">
          {card.participantB}
        </div>
      </div>

      <RouterLink
        className="rp-btn rp-btn-primary rp-btn-card-action"
        to={card.href}
        data-testid="assignment-action"
        data-action={card.action}
      >
        {card.actionLabel}
      </RouterLink>
    </article>
  );
}
