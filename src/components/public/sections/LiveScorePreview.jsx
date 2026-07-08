import { Box, Chip, Grid, Stack, Typography } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

import { PUBLIC_COLORS, publicCardSx, publicContainerSx, publicSectionSx } from "../publicPortalStyles.js";

export default function LiveScorePreview({ matches }) {
  return (
    <Box sx={publicSectionSx}>
      <Box sx={publicContainerSx}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <FiberManualRecordIcon sx={{ fontSize: 12, color: "#EF4444", animation: "pulse 1.5s infinite" }} />
          <Typography variant="h5" fontWeight={800}>
            Live Score
          </Typography>
        </Stack>

        <Grid container spacing={2}>
          {matches.map((match) => (
            <Grid key={match.id} size={{ xs: 12, md: 4 }}>
              <Box sx={{ ...publicCardSx, p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
                    {match.court}
                  </Typography>
                  <Chip
                    label={match.status}
                    size="small"
                    sx={{ bgcolor: "rgba(239,68,68,0.15)", color: "#F87171", fontWeight: 700 }}
                  />
                </Stack>

                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1" fontWeight={600}>
                      {match.teamA}
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color={PUBLIC_COLORS.primary}>
                      {match.scoreA}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1" fontWeight={600}>
                      {match.teamB}
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color={PUBLIC_COLORS.textMuted}>
                      {match.scoreB}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Box>
  );
}
