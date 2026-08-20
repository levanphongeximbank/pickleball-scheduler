import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

import { TournamentModeChip, TournamentStatusChip } from "../../../../components/tournament/TournamentStatusChip.jsx";
import { tournamentCardSx } from "../../../../components/tournament/tournamentLayout.js";

export default function TournamentIdentityBlock({
  title,
  subtitle,
  mode,
  status,
  meta = [],
}) {
  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        ...tournamentCardSx,
        p: { xs: 1.5, sm: 2.25 },
        mb: 2,
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 72%)",
        color: "#fff",
        borderColor: "transparent",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 20, sm: 26 }, fontWeight: 800, letterSpacing: "-0.03em" }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography sx={{ mt: 0.5, color: "rgba(255,255,255,0.72)", fontSize: 13 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {mode ? <TournamentModeChip mode={mode} sx={{ bgcolor: "#fff" }} /> : null}
          {status ? <TournamentStatusChip status={status} sx={{ bgcolor: "#fff" }} /> : null}
        </Stack>
      </Stack>
      {meta.length ? (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {meta.map((item) => (
            <Chip
              key={item}
              size="small"
              label={item}
              sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.28)" }}
              variant="outlined"
            />
          ))}
        </Stack>
      ) : null}
    </Paper>
  );
}
