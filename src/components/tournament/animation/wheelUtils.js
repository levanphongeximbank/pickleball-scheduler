export const WHEEL_SEGMENT_COLORS = [
  "#E53935",
  "#8E24AA",
  "#3949AB",
  "#1E88E5",
  "#00897B",
  "#43A047",
  "#F9A825",
  "#FB8C00",
  "#D81B60",
  "#5E35B1",
  "#039BE5",
  "#00ACC1",
  "#7CB342",
  "#C0CA33",
  "#FF7043",
  "#8D6E63",
];

export function buildWheelSegments(steps = []) {
  return steps.map((step, index) => ({
    id: step.team?.id || `segment-${index}`,
    name: step.team?.name || `Đội ${index + 1}`,
    color: WHEEL_SEGMENT_COLORS[index % WHEEL_SEGMENT_COLORS.length],
  }));
}

export function computeWheelRotation(currentRotation, targetSegmentIndex, segmentCount, minExtraSpins = 5) {
  if (segmentCount <= 0) {
    return currentRotation;
  }

  const segmentAngle = 360 / segmentCount;
  const segmentCenter = (targetSegmentIndex + 0.5) * segmentAngle;
  const landRotation = 360 - segmentCenter;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  let delta = landRotation - currentMod;

  if (delta <= 0) {
    delta += 360;
  }

  return currentRotation + 360 * minExtraSpins + delta;
}

export function shortenWheelLabel(name = "", maxLength = 10) {
  const text = String(name).trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

/** Chữ hướng từ tâm ra ngoài, dễ đọc ở nửa dưới vòng */
export function getRadialLabelLayout(midAngle, cx, cy, radius, labelRadiusRatio = 0.34) {
  const labelRadius = radius * labelRadiusRatio;
  const rad = ((midAngle - 90) * Math.PI) / 180;
  const inBottomHalf = midAngle > 90 && midAngle < 270;

  return {
    x: cx + labelRadius * Math.cos(rad),
    y: cy + labelRadius * Math.sin(rad),
    rotation: inBottomHalf ? midAngle + 90 : midAngle - 90,
    textAnchor: inBottomHalf ? "end" : "start",
  };
}
