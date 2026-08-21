import { COURT_SLOT } from "../constants.js";
import { isRawTechnicalId } from "../projection/formatRefereeUiLabels.js";

function shortName(displayName, playerId) {
  const raw = String(displayName || "").trim();
  if (raw && !isRawTechnicalId(raw) && raw !== "Chưa có tên" && raw !== "Chưa có tên VĐV") {
    if (raw.length <= 18) return raw;
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
      const compact = `${parts[0]} ${parts[parts.length - 1]}`;
      return compact.length <= 18 ? compact : compact.slice(0, 18);
    }
    return raw.slice(0, 18);
  }
  void playerId;
  return "Chưa có tên VĐV";
}

function Marker({ player, slot }) {
  if (!player) return null;
  const positionLabel =
    player.logicalPositionLabel ||
    (player.logicalPosition === "RIGHT"
      ? "Phải"
      : player.logicalPosition === "LEFT"
        ? "Trái"
        : player.logicalPosition) ||
    null;
  return (
    <div
      className={`rp-slot ${slot}${player.isServing ? " is-serving-slot" : ""}${
        player.isReceiving ? " is-receiving-slot" : ""
      }`}
      data-testid={`court-slot-${slot}`}
      data-logical-position={player.logicalPosition || ""}
    >
      <article
        className={`rp-marker${player.isServing ? " is-serving" : ""}${
          player.isReceiving ? " is-receiving" : ""
        }`}
        data-testid={`player-marker-${player.playerId}`}
        data-permanent-number="false"
        aria-label={[
          player.displayName,
          positionLabel,
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
        {positionLabel ? (
          <p className="rp-marker-pos" data-testid={`logical-pos-${player.playerId}`}>
            {positionLabel}
          </p>
        ) : null}
        <p className="rp-marker-name">{shortName(player.displayName, player.playerId)}</p>
        {player.isServing ? (
          <p className="rp-marker-role rp-marker-role-serve" data-testid="marker-serving-label">
            ĐANG GIAO
          </p>
        ) : null}
        {player.isReceiving ? (
          <p className="rp-marker-role rp-marker-role-receive" data-testid="marker-receiving-label">
            ĐỠ BÓNG
          </p>
        ) : null}
      </article>
    </div>
  );
}

function ServeDiagonalArrow({ arrow }) {
  if (!arrow?.from || !arrow?.to) return null;
  return (
    <svg
      className="rp-serve-arrow"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden={false}
      role="img"
      aria-label={`Hướng giao chéo: ${arrow.serveDirection || ""}`}
      data-testid="serve-direction-arrow"
      data-serve-direction={arrow.serveDirection || ""}
      data-is-diagonal="true"
    >
      <defs>
        <marker
          id="rp-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#f9a825" />
        </marker>
      </defs>
      <line
        x1={arrow.from.x}
        y1={arrow.from.y}
        x2={arrow.to.x}
        y2={arrow.to.y}
        stroke="#f9a825"
        strokeWidth="1.6"
        markerEnd="url(#rp-arrowhead)"
        data-testid="serve-arrow-line"
      />
    </svg>
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
          <span className="rp-court-label kitchen-far">KITCHEN</span>
          <span className="rp-court-label kitchen-near">KITCHEN</span>
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
      <ServeDiagonalArrow arrow={courtProjection?.serveArrow} />
      <Marker player={court[COURT_SLOT.LEFT_TOP]} slot={COURT_SLOT.LEFT_TOP} />
      <Marker player={court[COURT_SLOT.LEFT_BOTTOM]} slot={COURT_SLOT.LEFT_BOTTOM} />
      <Marker player={court[COURT_SLOT.RIGHT_TOP]} slot={COURT_SLOT.RIGHT_TOP} />
      <Marker player={court[COURT_SLOT.RIGHT_BOTTOM]} slot={COURT_SLOT.RIGHT_BOTTOM} />
    </section>
  );
}
