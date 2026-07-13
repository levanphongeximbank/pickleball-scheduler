import { SCREEN_POSITION } from "../constants/viewModes.js";

const SLOT_CLASS = {
  [SCREEN_POSITION.SCREEN_TOP_LEFT]: "top-left",
  [SCREEN_POSITION.SCREEN_TOP_RIGHT]: "top-right",
  [SCREEN_POSITION.SCREEN_BOTTOM_LEFT]: "bottom-left",
  [SCREEN_POSITION.SCREEN_BOTTOM_RIGHT]: "bottom-right",
};

export default function PlayerPositionCard({
  player,
  highlightSwitch = false,
}) {
  const slotClass = SLOT_CLASS[player.screenPosition] || "bottom-left";

  return (
    <div
      className={`rv5-player-slot ${slotClass}`}
      data-testid={`player-slot-${player.playerId}`}
      data-screen-position={player.screenPosition}
    >
      <article
        className={[
          "rv5-player-card",
          player.isServer ? "is-server" : "",
          player.isReceiver ? "is-receiver" : "",
          highlightSwitch ? "switched" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`${player.displayName}, ${player.teamName}, ${player.logicalSideLabel}`}
      >
        <p className="rv5-player-name">{player.shortName || player.displayName}</p>
        <p className="rv5-player-team">{player.teamName}</p>
        <p className="rv5-player-side">{player.logicalSideLabel}</p>
        {player.isServer ? (
          <span className="rv5-role-badge server" aria-label="Đang giao">
            🎾 ĐANG GIAO
            {player.showServerNumber && player.serverNumber != null
              ? ` S${player.serverNumber}`
              : ""}
          </span>
        ) : null}
        {player.isReceiver ? (
          <span className="rv5-role-badge receiver" aria-label="Đỡ bóng">
            ĐỠ BÓNG
          </span>
        ) : null}
      </article>
    </div>
  );
}

export { SLOT_CLASS };
