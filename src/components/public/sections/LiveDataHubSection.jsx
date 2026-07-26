import { alpha } from "@mui/material/styles";
import { Box, Chip, Divider, Grid, Stack, Typography } from "@mui/material";

import {
  PUBLIC_COLORS,
  publicCardSx,
  publicContainerSx,
  sectionDarkSx,
} from "../publicPortalStyles.js";
import { PublicDataSourceNotice } from "../states/index.js";

function PanelHeader({ title }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
      <Typography component="h3" variant="subtitle1" fontWeight={700} letterSpacing={0.5}>
        {title}
      </Typography>
    </Stack>
  );
}

/**
 * Home hub for sample score / schedule / results panels.
 * EC-05: titles are honest (no LIVE / HÔM NAY / MỚI NHẤT without certified live source).
 */
export default function LiveDataHubSection({
  liveMatch = null,
  schedule = [],
  results = [],
  scoreSource = "",
  scheduleSource = "",
  resultsSource = "",
  scoreFallbackReason = null,
  scheduleFallbackReason = null,
  resultsFallbackReason = null,
}) {
  const scheduleRows = Array.isArray(schedule) ? schedule : [];
  const resultRows = Array.isArray(results) ? results : [];

  return (
    <Box sx={{ ...sectionDarkSx, py: { xs: 4, md: 6 } }}>
      <Box sx={publicContainerSx}>
        <PublicDataSourceNotice
          source={scoreSource || scheduleSource || resultsSource}
          fallbackReason={
            scoreFallbackReason || scheduleFallbackReason || resultsFallbackReason
          }
          title="Dữ liệu minh họa trên bảng tin Home"
          message="Tỷ số, lịch và kết quả trên khu vực này đang dùng dữ liệu mẫu — không phải dữ liệu trận đấu trực tiếp."
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...publicCardSx, p: 2.5, height: "100%" }}>
              <PanelHeader title="TỶ SỐ MẪU" />
              {liveMatch ? (
                <>
                  <Typography
                    variant="caption"
                    color={PUBLIC_COLORS.textMuted}
                    sx={{ mb: 2, display: "block" }}
                  >
                    {liveMatch.court}
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600} sx={{ maxWidth: "70%" }}>
                        {liveMatch.teamA}
                      </Typography>
                      <Typography variant="h5" fontWeight={800} color={PUBLIC_COLORS.lime}>
                        {liveMatch.scoreA}
                      </Typography>
                    </Stack>
                    <Divider sx={{ borderColor: PUBLIC_COLORS.border }} />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600} sx={{ maxWidth: "70%" }}>
                        {liveMatch.teamB}
                      </Typography>
                      <Typography variant="h5" fontWeight={800}>
                        {liveMatch.scoreB}
                      </Typography>
                    </Stack>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
                  Chưa có tỷ số mẫu để hiển thị.
                </Typography>
              )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...publicCardSx, p: 2.5, height: "100%" }}>
              <PanelHeader title="LỊCH MẪU" />
              <Stack spacing={1.5}>
                {scheduleRows.length ? (
                  scheduleRows.map((row) => (
                    <Box
                      key={`${row.time}-${row.court}`}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: alpha("#fff", 0.03),
                        border: `1px solid ${PUBLIC_COLORS.border}`,
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        sx={{ mb: 0.5 }}
                      >
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
                      <Typography
                        variant="body2"
                        color={PUBLIC_COLORS.textMuted}
                        sx={{ fontSize: "0.8rem" }}
                      >
                        {row.match}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
                    Chưa có lịch mẫu để hiển thị.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...publicCardSx, p: 2.5, height: "100%" }}>
              <PanelHeader title="KẾT QUẢ MẪU" />
              <Stack spacing={1.5}>
                {resultRows.length ? (
                  resultRows.map((row) => (
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
                  ))
                ) : (
                  <Typography variant="body2" color={PUBLIC_COLORS.textMuted}>
                    Chưa có kết quả mẫu để hiển thị.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
