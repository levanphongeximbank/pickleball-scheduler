import { useMemo } from "react";

import {
  Alert,
  Box,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { listEngineRuns } from "../../../../features/tournament-engine/index.js";

export default function EngineLogsTab({ tournamentId }) {
  const { activeClubId } = useClub();

  const runs = useMemo(
    () => listEngineRuns(activeClubId, tournamentId),
    [activeClubId, tournamentId]
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Nhật ký Engine
      </Typography>

      {runs.length === 0 ? (
        <Alert severity="info">Chưa có lần chạy engine nào.</Alert>
      ) : (
        <Stack spacing={1}>
          {runs.map((run) => (
            <Paper key={run.id} sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" flexWrap="wrap">
                <Typography fontWeight="medium">{run.engineType}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(run.createdAt).toLocaleString("vi-VN")}
                </Typography>
              </Stack>
              {run.warnings?.length > 0 && (
                <Typography variant="body2" color="warning.main">
                  {run.warnings.join(" · ")}
                </Typography>
              )}
              {run.explain?.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {run.explain.join(" ")}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
