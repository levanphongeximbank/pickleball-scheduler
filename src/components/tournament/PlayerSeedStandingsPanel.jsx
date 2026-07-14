import { Alert, Box, Chip, Paper, Stack, Typography } from "@mui/material";

/**
 * Player-facing seed + standings summary (S1-D).
 */
export default function PlayerSeedStandingsPanel({
  seedNumber = null,
  seedReason = "",
  standingRow = null,
  tieBreakExplanation = "",
}) {
  if (seedNumber == null && !standingRow) {
    return null;
  }

  const qual = standingRow?.qualificationStatus;
  const qualLabel =
    qual === "qualified_1st"
      ? "Nhất bảng — vào knockout"
      : qual === "qualified"
        ? "Vào knockout"
        : qual === "eliminated"
          ? "Chưa vào knockout"
          : null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
        Seed &amp; BXH của bạn
      </Typography>
      <Stack spacing={1}>
        {seedNumber != null ? (
          <Box>
            <Chip label={`Seed #${seedNumber}`} color="primary" size="small" sx={{ mr: 1 }} />
            {seedReason ? (
              <Typography variant="caption" color="text.secondary">
                {seedReason}
              </Typography>
            ) : null}
          </Box>
        ) : null}
        {standingRow ? (
          <Box>
            <Typography variant="body2">
              Hạng {standingRow.rank || "—"} · {standingRow.won || 0} thắng / {standingRow.lost || 0}{" "}
              thua · {standingRow.matchPoints ?? 0} điểm · Hiệu số{" "}
              {standingRow.scoreDiff > 0 ? `+${standingRow.scoreDiff}` : standingRow.scoreDiff ?? 0}
            </Typography>
            {qualLabel ? (
              <Chip
                size="small"
                sx={{ mt: 0.5 }}
                color={qual?.startsWith("qualified") ? "success" : "default"}
                label={qualLabel}
              />
            ) : null}
          </Box>
        ) : null}
        {tieBreakExplanation ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Tie-break: {tieBreakExplanation}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
