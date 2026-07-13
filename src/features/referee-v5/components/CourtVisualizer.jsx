import PlayerPositionCard from "./PlayerPositionCard.jsx";
import ServeDirectionArrow from "./ServeDirectionArrow.jsx";

export default function CourtVisualizer({ visualState, lastDomainEvents = [] }) {
  const highlightSwitch = lastDomainEvents.includes("PLAYERS_SWITCHED");

  return (
    <section className="rv5-court" aria-label="Sơ đồ sân trọng tài" data-testid="court-visualizer">
      <span className="rv5-court-end-label far">FAR END</span>
      <span className="rv5-court-end-label near">NEAR END</span>
      <div className="rv5-court-net" aria-hidden="true" />
      <div className="rv5-court-kitchen far" aria-hidden="true" />
      <div className="rv5-court-kitchen near" aria-hidden="true" />
      <div className="rv5-court-center-line" aria-hidden="true" />
      <ServeDirectionArrow arrow={visualState.arrow} />
      {visualState.players.map((player) => (
        <PlayerPositionCard
          key={player.playerId}
          player={player}
          highlightSwitch={highlightSwitch && player.isServer}
        />
      ))}
    </section>
  );
}
