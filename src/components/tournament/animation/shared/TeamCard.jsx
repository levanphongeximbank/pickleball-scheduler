import { Box, Stack, Typography } from "@mui/material";

import StatusBadge from "./StatusBadge.jsx";

export default function TeamCard({
  title,
  players = [],
  seed,
  avgLevel,
  balanceScore,
  side = "a",
  visible = true,
  flying = false,
  status,
  compact = false,
}) {
  const sideClass = side === "b" ? "b" : "a";

  return (
    <Box
      className={`tournament-team-card tournament-team-card--${sideClass}${
        visible ? ` tournament-team-card--visible-${sideClass}` : ""
      }${flying ? " tournament-team-card--fly" : ""}`}
      sx={{ minHeight: compact ? 120 : 160 }}
    >
      {title ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
      ) : null}
      <Stack spacing={0.5}>
        {players.map((player, index) => (
          <Typography
            key={`${player}-${index}`}
            variant={compact ? "body2" : "body1"}
            fontWeight={700}
            sx={{ wordBreak: "break-word" }}
          >
            {player}
          </Typography>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
        {seed != null && seed !== "" ? (
          <Typography variant="caption" color="text.secondary">
            Seed {seed}
          </Typography>
        ) : null}
        {avgLevel != null && avgLevel !== "" ? (
          <Typography variant="caption" color="text.secondary">
            TB Level {avgLevel}
          </Typography>
        ) : null}
        {balanceScore != null ? (
          <Typography variant="caption" color="success.main" fontWeight={700}>
            Cân bằng {balanceScore}%
          </Typography>
        ) : null}
      </Stack>
      {status ? (
        <Box sx={{ mt: 1 }}>
          <StatusBadge label={status.label} tone={status.tone} />
        </Box>
      ) : null}
    </Box>
  );
}
