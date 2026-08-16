import { COURT_SLOT } from "../constants.js";

function shortName(displayName) {
  const raw = String(displayName || "").trim();
  if (!raw) return "?";
  // Prefer last token for compact circle (e.g. "NGUYỄN A" → keep full when short)
  if (raw.length <= 12) return raw;
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
  return raw.slice(0, 12);
}

function Marker({ player, slot }) {
  if (!player) return null;
  return (
    <div
      className={`rp-slot ${slot}${player.isServing ? " is-serving-slot" : ""}${
        player.isReceiving ? " is-receiving-slot" : ""
      }`}
      data-testid={`court-slot-${slot}`}
    >
      <article
        className={`rp-marker${player.isServing ? " is-serving" : ""}${
          player.isReceiving ? " is-receiving" : ""
        }`}
        data-testid={`player-marker-${player.playerId}`}
        data-permanent-number="false"
        aria-label={[
          player.displayName,
          player.isServing ? "đang giao" : null,
          player.isReceiving ? "đỡ bóng" : null,
        ]
          .filter(Boolean)
          .join(", ")}
      >
        {player.isServing ? (
          <span className="rp-serve-star" data-testid="serving-indicator" aria-hidden="true">
            ★
          </span>
        ) : null}
        <p className="rp-marker-name">{shortName(player.displayName)}</p>
      </article>
    </div>
  );
}

export default function CanonicalCourtView({ courtProjection }) {
  const court = courtProjection?.court || {};
  const geometry = courtProjection?.geometry || "DOUBLES";

  return (
    <section
      className={`rp-court rp-court-${String(geometry).toLowerCase()}`}
      data-testid="canonical-court-view"
      data-geometry={geometry}
      data-orientation={courtProjection?.courtOrientation || "STANDARD"}
      aria-label="Sơ đồ sân trọng tài"
    >
      <div className="rp-court-frame" aria-hidden="true">
        <div className="rp-court-surface">
          <span className="rp-court-label sideline-left">SIDELINE</span>
          <span className="rp-court-label sideline-right">SIDELINE</span>
          <span className="rp-court-label baseline-far">BASELINE</span>
          <span className="rp-court-label baseline-near">BASELINE</span>
          <span className="rp-court-label kitchen-far">KITCHEN (NON-VOLLEY ZONE)</span>
          <span className="rp-court-label kitchen-near">KITCHEN (NON-VOLLEY ZONE)</span>
          <div className="rp-court-baseline far" />
          <div className="rp-court-baseline near" />
          <div className="rp-court-sideline left" />
          <div className="rp-court-sideline right" />
          <div className="rp-court-kitchen far" />
          <div className="rp-court-kitchen near" />
          <div className="rp-court-center" />
          <div className="rp-court-net" />
        </div>
      </div>
      <Marker player={court[COURT_SLOT.LEFT_TOP]} slot={COURT_SLOT.LEFT_TOP} />
      <Marker player={court[COURT_SLOT.LEFT_BOTTOM]} slot={COURT_SLOT.LEFT_BOTTOM} />
      <Marker player={court[COURT_SLOT.RIGHT_TOP]} slot={COURT_SLOT.RIGHT_TOP} />
      <Marker player={court[COURT_SLOT.RIGHT_BOTTOM]} slot={COURT_SLOT.RIGHT_BOTTOM} />
    </section>
  );
}
