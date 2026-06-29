import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

import {
  computeWheelRotation,
  getRadialLabelLayout,
  shortenWheelLabel,
} from "./wheelUtils.js";
import {
  playWheelLand,
  playWheelSpinStart,
  startSpinTicks,
  stopSpinTicks,
} from "./wheelSounds.js";

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = SIZE / 2 - 10;

function polarOnRadius(radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

function describeSegmentPath(startAngle, endAngle) {
  const start = polarOnRadius(RADIUS, endAngle);
  const end = polarOnRadius(RADIUS, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function PrizeWheel({
  segments = [],
  targetIndex = 0,
  spinToken = 0,
  spinning = false,
  spinDurationMs = 2600,
  centerLabel = "Sẵn sàng",
  onSpinEnd,
}) {
  const rotationRef = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const lastSpinTokenRef = useRef(0);

  const segmentAngle = segments.length > 0 ? 360 / segments.length : 360;

  const segmentPaths = useMemo(() => {
    return segments.map((segment, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = (index + 1) * segmentAngle;
      const midAngle = startAngle + segmentAngle / 2;
      const labelLayout = getRadialLabelLayout(midAngle, CX, CY, RADIUS);

      return {
        ...segment,
        path: describeSegmentPath(startAngle, endAngle),
        labelLayout,
      };
    });
  }, [segments, segmentAngle]);

  useEffect(() => {
    return () => stopSpinTicks();
  }, []);

  useEffect(() => {
    if (!spinning || spinToken === 0 || spinToken === lastSpinTokenRef.current) {
      return;
    }

    if (segments.length === 0 || targetIndex < 0) {
      return;
    }

    lastSpinTokenRef.current = spinToken;
    const nextRotation = computeWheelRotation(rotationRef.current, targetIndex, segments.length);
    rotationRef.current = nextRotation;

    playWheelSpinStart();
    startSpinTicks(spinDurationMs);
    setIsAnimating(true);
    setRotation(nextRotation);
  }, [spinning, spinToken, targetIndex, segments.length, spinDurationMs]);

  const handleTransitionEnd = (event) => {
    if (event.propertyName !== "transform" || !isAnimating) {
      return;
    }

    setIsAnimating(false);
    playWheelLand();
    onSpinEnd?.();
  };

  const activeSegment =
    !isAnimating && spinning === false && targetIndex >= 0
      ? segments[targetIndex]
      : segments.find((_, index) => index === targetIndex);

  return (
    <Box className="prize-wheel-wrap" sx={{ width: "100%", maxWidth: SIZE, mx: "auto" }}>
      <Box className="prize-wheel-pointer" aria-hidden />

      <Box
        className={`prize-wheel-rim${isAnimating ? " prize-wheel-rim--spinning" : ""}`}
        sx={{ width: SIZE, height: SIZE, mx: "auto" }}
      >
        <Box
          className="prize-wheel-disk"
          onTransitionEnd={handleTransitionEnd}
          sx={{
            width: SIZE,
            height: SIZE,
            transform: `rotate(${rotation}deg)`,
            transition: isAnimating
              ? `transform ${spinDurationMs}ms cubic-bezier(0.12, 0.84, 0.18, 1)`
              : "none",
          }}
        >
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img">
            <circle cx={CX} cy={CY} r={RADIUS + 4} fill="#FFD54F" />
            {segmentPaths.map((segment) => (
              <g key={segment.id}>
                <path
                  d={segment.path}
                  fill={segment.color}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                />
                <text
                  x={segment.labelLayout.x}
                  y={segment.labelLayout.y}
                  fill="#fff"
                  fontSize={segments.length > 10 ? 8.5 : segments.length > 6 ? 9.5 : 10.5}
                  fontWeight="700"
                  textAnchor={segment.labelLayout.textAnchor}
                  dominantBaseline="middle"
                  transform={`rotate(${segment.labelLayout.rotation}, ${segment.labelLayout.x}, ${segment.labelLayout.y})`}
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {shortenWheelLabel(segment.name, segments.length > 8 ? 9 : 14)}
                </text>
              </g>
            ))}
            <circle cx={CX} cy={CY} r={RADIUS * 0.22} fill="#fff" stroke="#F9A825" strokeWidth={4} />
          </svg>
        </Box>
      </Box>

      <Box className="prize-wheel-center-label">
        <Typography variant="caption" color="text.secondary" display="block" align="center">
          {isAnimating ? "Đang quay..." : "Kết quả"}
        </Typography>
        <Typography variant="subtitle1" fontWeight="bold" align="center" sx={{ px: 1 }}>
          {isAnimating ? centerLabel : activeSegment?.name || centerLabel}
        </Typography>
      </Box>
    </Box>
  );
}
