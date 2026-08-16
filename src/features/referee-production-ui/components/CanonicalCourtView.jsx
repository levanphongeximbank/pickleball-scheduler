import { COURT_SLOT } from "../constants.js";

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
        <p className="rp-marker-name">
          {player.isServing ? <span className="rp-serve-star" aria-hidden="true">★ </span> : null}
          {player.displayName}
        </p>
        {player.isServing ? (
          <span className="rp-serve-badge" data-testid="serving-indicator">
            GIAO
          </span>
        ) : null}
        {player.isReceiving && !player.isServing ? (
          <span className="rp-receive-badge" data-testid="receiving-indicator">
            ĐỠ
          </span>
        ) : null}
      </article>
    </div>
  );
}

function SideLabel({ side, position }) {
  if (!side?.participant?.displayName) return null;
  return (
    <span className={`rp-court-side-label ${position}`} data-testid={`court-side-${position}`}>
      {side.participant.displayName}
    </span>
  );
}

export default function CanonicalCourtView({ courtProjection }) {
  const court = courtProjection?.court || {};
  const sides = courtProjection?.sides || {};
  const geometry = courtProjection?.geometry || "DOUBLES";

  return (
    <section
      className={`rp-court rp-court-${String(geometry).toLowerCase()}`}
      data-testid="canonical-court-view"
      data-geometry={geometry}
      data-orientation={courtProjection?.courtOrientation || "STANDARD"}
      aria-label="Sơ đồ sân trọng tài"
    >
      <div className="rp-court-surface" aria-hidden="true">
        <div className="rp-court-baseline far" />
        <div className="rp-court-baseline near" />
        <div className="rp-court-sideline left" />
        <div className="rp-court-sideline right" />
        <div className="rp-court-kitchen far" />
        <div className="rp-court-kitchen near" />
        <div className="rp-court-center" />
        <div className="rp-court-net" />
      </div>
      <SideLabel side={sides.left} position="left" />
      <SideLabel side={sides.right} position="right" />
      <Marker player={court[COURT_SLOT.LEFT_TOP]} slot={COURT_SLOT.LEFT_TOP} />
      <Marker player={court[COURT_SLOT.LEFT_BOTTOM]} slot={COURT_SLOT.LEFT_BOTTOM} />
      <Marker player={court[COURT_SLOT.RIGHT_TOP]} slot={COURT_SLOT.RIGHT_TOP} />
      <Marker player={court[COURT_SLOT.RIGHT_BOTTOM]} slot={COURT_SLOT.RIGHT_BOTTOM} />
    </section>
  );
}
