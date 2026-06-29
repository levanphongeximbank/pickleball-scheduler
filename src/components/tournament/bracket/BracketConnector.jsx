export default function BracketConnector({
  edges = [],
  width = 0,
  height = 0,
  revealProgress = 1,
}) {
  if (!edges.length) {
    return null;
  }

  return (
    <svg
      className="tournament-bracket-connectors"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      {edges.map((edge) => (
        <path
          key={edge.id}
          d={edge.path}
          className={`tournament-bracket-connectors__path${
            edge.active ? " tournament-bracket-connectors__path--active" : ""
          }${edge.dashed ? " tournament-bracket-connectors__path--dashed" : ""}`}
          pathLength={1}
          style={{
            strokeDashoffset: 1 - revealProgress,
          }}
        />
      ))}
    </svg>
  );
}
