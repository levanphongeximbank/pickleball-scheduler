import { useMemo, useState } from "react";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { VPR_CATEGORY_OPTIONS } from "../constants/vprCategories.js";
import { VPR_PLACEMENT_LABELS } from "../constants/vprPlacements.js";
import { getAthleteProfileSummary } from "../services/vprLeaderboardService.js";
import { getVprAthleteForClubPlayer } from "../services/vprAthleteService.js";

function MiniSparkline({ points = [] }) {
  if (!points.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        Chưa có dữ liệu biểu đồ.
      </Typography>
    );
  }
  const max = Math.max(...points.map((p) => p.points), 1);
  return (
    <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ height: 48 }}>
      {points.map((point) => (
        <Box
          key={point.at}
          sx={{
            width: 8,
            height: `${Math.max(8, (point.points / max) * 100)}%`,
            bgcolor: "primary.main",
            borderRadius: 0.5,
          }}
          title={`${point.points} — ${point.tournamentName}`}
        />
      ))}
    </Stack>
  );
}

export default function VprProfilePanel({ clubId, playerId, playerName }) {
  const [category, setCategory] = useState("men_single");
  const athlete = useMemo(
    () => getVprAthleteForClubPlayer(clubId, playerId),
    [clubId, playerId]
  );
  const summary = useMemo(() => {
    if (!athlete) {
      return null;
    }
    return getAthleteProfileSummary(athlete.id, category);
  }, [athlete, category]);

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6" fontWeight={700}>
          VPR — {playerName}
        </Typography>
        <FormControl size="small" sx={{ maxWidth: 220 }}>
          <InputLabel>Nội dung</InputLabel>
          <Select label="Nội dung" value={category} onChange={(e) => setCategory(e.target.value)}>
            {VPR_CATEGORY_OPTIONS.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!athlete && (
          <Typography variant="body2" color="text.secondary">
            VĐV chưa có hồ sơ VPR (sẽ tạo khi nhận điểm từ giải Certified).
          </Typography>
        )}
        {summary && (
          <>
            <Grid container spacing={1}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Tổng điểm
                </Typography>
                <Typography variant="h6">{summary.totalPoints}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Hạng
                </Typography>
                <Typography variant="h6">{summary.rank ?? "—"}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Số giải
                </Typography>
                <Typography variant="h6">{summary.tournamentsCount}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  TT tốt nhất
                </Typography>
                <Typography variant="h6">
                  {VPR_PLACEMENT_LABELS[summary.bestPlacement] || "—"}
                </Typography>
              </Grid>
            </Grid>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Điểm tích lũy theo thời gian
              </Typography>
              <MiniSparkline points={summary.cumulativeChart} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Lịch sử giải
              </Typography>
              {summary.history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa tham gia giải tính VPR.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {summary.history.slice(0, 8).map((entry) => (
                    <Stack
                      key={entry.id}
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Typography variant="body2">{entry.tournamentName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        +{entry.points} ({VPR_PLACEMENT_LABELS[entry.placement]})
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}
