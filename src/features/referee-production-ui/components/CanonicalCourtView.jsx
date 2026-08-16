import { COURT_SLOT } from "../constants.js";

function Marker({ player, slot }) {
  if (!player) return null;
  return (
    <div className={`rp-slot ${slot}`} data-testid={`court-slot-${slot}`}>
      <article
        className={`rp-marker${player.isServing ? " is-serving" : ""}`}
        data-testid={`player-marker-${player.playerId}`}
        data-permanent-number="false"
      >
        <p className="rp-marker-name">{player.displayName}</p>
        {player.isServing ? (
          <span className="rp-serve-badge" data-testid="serving-indicator">
            ĐANG GIAO
          </span>
        ) : null}
      </article>
    </div>
  );
}

export default function CanonicalCourtView({ courtProjection }) {
  const court = courtProjection?.court || {};
  return (
    <section className="rp-court" data-testid="canonical-court-view" aria-label="Sơ đồ sân trọng tài">
      <div className="rp-court-net" aria-hidden="true" />
      <div className="rp-court-center" aria-hidden="true" />
      <Marker player={court[COURT_SLOT.LEFT_TOP]} slot={COURT_SLOT.LEFT_TOP} />
      <Marker player={court[COURT_SLOT.LEFT_BOTTOM]} slot={COURT_SLOT.LEFT_BOTTOM} />
      <Marker player={court[COURT_SLOT.RIGHT_TOP]} slot={COURT_SLOT.RIGHT_TOP} />
      <Marker player={court[COURT_SLOT.RIGHT_BOTTOM]} slot={COURT_SLOT.RIGHT_BOTTOM} />
    </section>
  );
}
