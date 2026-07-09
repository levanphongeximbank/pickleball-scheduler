import { Box, Typography } from "@mui/material";

export default function CountdownDisplay({
  secondsLeft = 0,
  totalSeconds = 10,
  size = "large",
  showRing = true,
}) {
  const safeTotal = Math.max(1, totalSeconds);
  const progress = Math.min(1, Math.max(0, (safeTotal - secondsLeft) / safeTotal));
  const ringSize = size === "large" ? 120 : 88;
  const stroke = size === "large" ? 6 : 5;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <Box
      className={`effect-prelude-countdown effect-prelude-countdown--${size}`}
      sx={{
        position: "relative",
        width: ringSize,
        height: ringSize,
        mx: "auto",
        my: 1,
      }}
    >
      {showRing ? (
        <Box
          component="svg"
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          sx={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="#10B981"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.35s ease" }}
          />
        </Box>
      ) : null}

      <Typography
        component="span"
        className="effect-prelude-countdown__value"
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: size === "large" ? "3rem" : "2rem",
          color: "#10B981",
          lineHeight: 1,
        }}
      >
        {Math.max(0, secondsLeft)}
      </Typography>
    </Box>
  );
}
