import { Box, Stack, Typography } from "@mui/material";

import StatusBadge from "./StatusBadge.jsx";

export default function MatchCard({
  matchLabel,
  groupLabel,
  leftName,
  rightName,
  courtName,
  status,
  isLatest = false,
  isNew = false,
}) {
  const courtText = courtName ? courtName : "Chưa xếp sân";

  return (
    <Box
      className={`tournament-result-card${isLatest ? " tournament-result-card--latest" : ""}${
        isNew ? " tournament-result-card--new" : ""
      }`}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {matchLabel}
          {groupLabel ? ` • Bảng ${groupLabel}` : ""}
        </Typography>
        {status ? <StatusBadge label={status.label} tone={status.tone} /> : null}
      </Stack>
      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5, wordBreak: "break-word" }}>
        {leftName}
      </Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        VS
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
        {rightName}
      </Typography>
      <Typography variant="caption" color={courtName ? "text.secondary" : "warning.main"} sx={{ mt: 0.5 }}>
        {courtText}
      </Typography>
    </Box>
  );
}
