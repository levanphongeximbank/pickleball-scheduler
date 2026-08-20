import { Box, Paper, Stack, Typography } from "@mui/material";

import { tournamentCardSx } from "../../../../components/tournament/tournamentLayout.js";
import { SHELL } from "../../../../theme/designTokens.js";

export default function TournamentKpiCard({ label, value, hint, unavailable = false }) {
  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{ ...tournamentCardSx, p: { xs: 1.25, sm: 1.75 }, minWidth: 0 }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: 22, sm: 26 },
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: "-0.03em",
          mt: 0.5,
          color: unavailable ? "text.secondary" : "text.primary",
        }}
      >
        {unavailable ? "—" : value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
      {unavailable ? (
        <Box
          sx={{
            mt: 0.75,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: SHELL.accentLight,
            display: "inline-block",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Chưa có dữ liệu trên hồ sơ
          </Typography>
        </Box>
      ) : null}
    </Paper>
  );
}

export function TournamentRightRailCard({ title, children }) {
  return (
    <Paper variant="outlined" elevation={0} sx={{ ...tournamentCardSx, p: 1.75, mb: 1.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>{title}</Typography>
      <Stack spacing={1}>{children}</Stack>
    </Paper>
  );
}
