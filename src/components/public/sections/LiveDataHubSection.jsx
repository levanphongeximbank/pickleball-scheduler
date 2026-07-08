import { alpha } from "@mui/material/styles";
import { Box, Chip, Divider, Grid, Stack, Typography } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

import {
  MOCK_RESULTS,
  MOCK_SCHEDULE,
} from "../../../data/public/mockPublicData.js";
import {
  PUBLIC_COLORS,
  publicCardSx,
  publicContainerSx,
  sectionDarkSx,
} from "../publicPortalStyles.js";

function PanelHeader({ title, live }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
      {live && (
        <FiberManualRecordIcon
          sx={{ fontSize: 10, color: "#EF4444", animation: "pulse 1.5s infinite" }}
        />
      )}
      <Typography variant="subtitle1" fontWeight={700} letterSpacing={0.5}>
        {title}
      </Typography>
    </Stack>
  );
}

export default function LiveDataHubSection({ liveMatch }) {
  const match = liveMatch || {
    teamA: "Nguyễn Văn An / Trần Thị Bình",
    teamB: "Lê Hoàng Cường / Phạm Minh Đức",
    scoreA: 8,
    scoreB: 10,
    court: "Sân 1",
  };

  return (
    <Box sx={{ ...sectionDarkSx, py: { xs: 4, md: 6 } }}>
      <Box sx={publicContainerSx}>
        <Grid container spacing={2}>
          {/* Live Score */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...publicCardSx, p: 2.5, height: "100%" }}>
              <PanelHeader title="LIVE SCORE" live />
              <Typography variant="caption" color={PUBLIC_COLORS.textMuted} sx={{ mb: 2, display: "block" }}>
                {match.court}
              </Typography>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600} sx={{ maxWidth: "70%" }}>
                    {match.teamA}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color={PUBLIC_COLORS.lime}>
                    {match.scoreA}
                  </Typography>
                </Stack>
                <Divider sx={{ borderColor: PUBLIC_COLORS.border }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600} sx={{ maxWidth: "70%" }}>
                    {match.teamB}
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {match.scoreB}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          </Grid>

          {/* Schedule */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...publicCardSx, p: 2.5, height: "100%" }}>
              <PanelHeader title="LỊCH THI ĐẤU HÔM NAY" />
              <Stack spacing={1.5}>
                {MOCK_SCHEDULE.map((row) => (
                  <Box
                    key={`${row.time}-${row.court}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: alpha("#fff", 0.03),
                      border: `1px solid ${PUBLIC_COLORS.border}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={700} color={PUBLIC_COLORS.lime}>
                        {row.time} · {row.court}
                      </Typography>
                      <Chip
                        label={row.group}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          bgcolor: alpha(PUBLIC_COLORS.primary, 0.15),
                          color: PUBLIC_COLORS.primary,
                        }}
                      />
                    </Stack>
                    <Typography variant="body2" color={PUBLIC_COLORS.textMuted} sx={{ fontSize: "0.8rem" }}>
                      {row.match}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>

          {/* Results */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...publicCardSx, p: 2.5, height: "100%" }}>
              <PanelHeader title="KẾT QUẢ MỚI NHẤT" />
              <Stack spacing={1.5}>
                {MOCK_RESULTS.map((row) => (
                  <Box
                    key={row.match}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: alpha("#fff", 0.03),
                      border: `1px solid ${PUBLIC_COLORS.border}`,
                    }}
                  >
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                      {row.match}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color={PUBLIC_COLORS.textMuted}>
                        {row.score}
                      </Typography>
                      <Chip
                        label={`Thắng: ${row.winner}`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: "0.65rem",
                          bgcolor: alpha(PUBLIC_COLORS.lime, 0.15),
                          color: PUBLIC_COLORS.lime,
                          fontWeight: 600,
                        }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </Box>
  );
}
