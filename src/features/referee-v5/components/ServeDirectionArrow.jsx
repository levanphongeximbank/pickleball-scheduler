export default function ServeDirectionArrow({ arrow }) {
  if (!arrow) {
    return null;
  }

  const { from, to, serveDirection, isDiagonal } = arrow;

  return (
    <svg
      className="rv5-serve-arrow"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden={false}
      role="img"
      aria-label={`Hướng giao chéo: ${serveDirection}`}
      data-testid="serve-direction-arrow"
      data-serve-direction={serveDirection}
      data-is-diagonal={isDiagonal ? "true" : "false"}
    >
      <defs>
        <marker
          id="rv5-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#ffeb3b" />
        </marker>
      </defs>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#ffeb3b"
        strokeWidth="1.8"
        markerEnd="url(#rv5-arrowhead)"
        data-testid="serve-arrow-line"
      />
    </svg>
  );
}
